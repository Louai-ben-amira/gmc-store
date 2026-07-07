import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.db.models import F

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):

    # ── Connection lifecycle ───────────────────────────────────────────────

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room            = f'chat_{self.conversation_id}'
        self.user            = None

        user = await self._get_user()
        if not user:
            await self.close()
            return

        self.user = user

        if not await self._is_participant():
            await self.close()
            return

        await self.channel_layer.group_add(self.room, self.channel_name)
        await self.accept()

        await self._set_presence('online')

        pending_ids = await self._mark_delivered()
        if pending_ids:
            await self.channel_layer.group_send(self.room, {
                'type':        'message_status_update',
                'message_ids': pending_ids,
                'status':      'delivered',
            })

        await self.channel_layer.group_send(self.room, {
            'type':      'presence_update',
            'user_id':   self.user.id,
            'status':    'online',
            'last_seen': None,
        })

    async def disconnect(self, close_code):
        if not hasattr(self, 'room'):
            return

        await self.channel_layer.group_discard(self.room, self.channel_name)

        if not self.user:
            return

        last_seen_iso = await self._set_offline()

        try:
            await self.channel_layer.group_send(self.room, {
                'type':      'presence_update',
                'user_id':   self.user.id,
                'status':    'offline',
                'last_seen': last_seen_iso,
            })
        except Exception:
            pass

    # ── Receive ────────────────────────────────────────────────────────────

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, Exception):
            return

        if not self.user:
            return

        msg_type = data.get('type', 'message')
        await self._set_presence('online')

        try:
            if msg_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
                return

            if msg_type == 'message':
                await self._handle_chat_message(data)

            elif msg_type == 'typing':
                await self.channel_layer.group_send(self.room, {
                    'type':      'typing_status',
                    'user_id':   self.user.id,
                    'username':  self.user.get_full_name() or self.user.username,
                    'is_typing': bool(data.get('is_typing', False)),
                })

            elif msg_type == 'read':
                updated_ids = await self._mark_read()
                if updated_ids:
                    await self.channel_layer.group_send(self.room, {
                        'type':        'read_receipt',
                        'reader_id':   self.user.id,
                        'message_ids': updated_ids,
                    })

        except Exception as e:
            logger.error('ChatConsumer.receive error (type=%s): %s', msg_type, e, exc_info=True)

    # ── Message handler ────────────────────────────────────────────────────

    async def _handle_chat_message(self, data):
        body = data.get('body', '').strip()
        if not body:
            return

        msg = await self._save_message(body)

        # Admin replied: if the client doesn't read it within ~5 min, email them
        if self.user.role == 'admin':
            try:
                from apps.chat.tasks import schedule_unread_email_check
                schedule_unread_email_check(msg['id'])
            except Exception:
                pass

        payload = {
            'type':           'chat_message',
            'id':             msg['id'],
            'body':           msg['body'],
            'sender_id':      msg['sender_id'],
            'sender_name':    msg['sender_name'],
            'attachment_url': msg['attachment_url'],
            'msg_type':       'text',
            'metadata':       {},
            'created_at':     msg['created_at'],
            'status':         'sent',
        }

        await self.channel_layer.group_send(self.room, payload)

        try:
            await self.channel_layer.group_send('admin_notifications', {
                'type':            'new_message_notification',
                'conversation_id': int(self.conversation_id),
                'body':            msg['body'],
                'sender_id':       msg['sender_id'],
                'sender_name':     msg['sender_name'],
                'created_at':      msg['created_at'],
            })
        except Exception:
            pass

    # ── Outbound channel handlers ──────────────────────────────────────────

    async def chat_message(self, event):
        try:
            payload = {
                'type':           'chat_message',
                'id':             event['id'],
                'body':           event['body'],
                'sender_id':      event['sender_id'],
                'sender_name':    event['sender_name'],
                'attachment_url': event.get('attachment_url'),
                'msg_type':       event.get('msg_type', 'text'),
                'metadata':       event.get('metadata', {}),
                'created_at':     event['created_at'],
                'status':         event.get('status', 'sent'),
            }

            # Security: strip credentials data from WebSocket payloads.
            # Admin fetches credentials via authenticated REST endpoint, never WS.
            if payload['msg_type'] == 'credentials_card':
                meta = dict(payload.get('metadata', {}))
                meta.pop('credentials_data', None)
                payload['metadata'] = meta

            await self.send(text_data=json.dumps(payload))
        except Exception as e:
            logger.error('chat_message send error: %s', e)

    async def typing_status(self, event):
        if self.user and event['user_id'] == self.user.id:
            return
        try:
            await self.send(text_data=json.dumps({
                'type':      'typing_status',
                'user_id':   event['user_id'],
                'username':  event['username'],
                'is_typing': event['is_typing'],
            }))
        except Exception:
            pass

    async def read_receipt(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type':        'read_receipt',
                'reader_id':   event['reader_id'],
                'message_ids': event['message_ids'],
            }))
        except Exception:
            pass

    async def presence_update(self, event):
        if self.user and event['user_id'] == self.user.id:
            return
        try:
            await self.send(text_data=json.dumps({
                'type':      'presence_update',
                'user_id':   event['user_id'],
                'status':    event['status'],
                'last_seen': event.get('last_seen'),
            }))
        except Exception:
            pass

    async def message_status_update(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type':        'message_status_update',
                'message_ids': event['message_ids'],
                'status':      event['status'],
            }))
        except Exception:
            pass

    # ── DB helpers ─────────────────────────────────────────────────────────

    @database_sync_to_async
    def _get_user(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from apps.users.models import User
        qs        = self.scope.get('query_string', b'').decode()
        token_val = None
        for part in qs.split('&'):
            if part.startswith('token='):
                token_val = part.split('=', 1)[1]
                break
        if not token_val:
            return None
        try:
            token = AccessToken(token_val)
            return User.objects.get(id=token['user_id'])
        except Exception:
            return None

    @database_sync_to_async
    def _is_participant(self):
        from apps.chat.models import Conversation
        try:
            conv = Conversation.objects.get(pk=self.conversation_id)
            return conv.client == self.user or self.user.role == 'admin'
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def _save_message(self, body):
        from apps.chat.models import Conversation, Message
        # Truncate to 2000 chars - matches frontend limit
        body = body[:2000]
        conv = Conversation.objects.get(pk=self.conversation_id)
        msg  = Message.objects.create(
            conversation=conv,
            sender=self.user,
            body=body,
            msg_type='text',
            status='sent',
        )
        # Atomic update - no read-then-write race condition
        Conversation.objects.filter(pk=self.conversation_id).update(
            last_message_at=timezone.now(),
            unread_count=F('unread_count') + 1,
        )
        return {
            'id':             msg.id,
            'body':           msg.body,
            'sender_id':      self.user.id,
            'sender_name':    self.user.get_full_name() or self.user.username,
            'attachment_url': msg.attachment.url if msg.attachment else None,
            'created_at':     msg.created_at.isoformat(),
        }

    @database_sync_to_async
    def _mark_delivered(self):
        from apps.chat.models import Message
        qs  = Message.objects.filter(
            conversation_id=self.conversation_id,
            status='sent',
        ).exclude(sender=self.user)
        ids = list(qs.values_list('id', flat=True))
        if ids:
            qs.update(status='delivered', delivered_at=timezone.now())
        return ids

    @database_sync_to_async
    def _mark_read(self):
        from apps.chat.models import Message, Conversation
        qs  = Message.objects.filter(
            conversation_id=self.conversation_id,
            status__in=['sent', 'delivered'],
        ).exclude(sender=self.user)
        ids = list(qs.values_list('id', flat=True))
        if ids:
            qs.update(status='read', read_at=timezone.now())
            Conversation.objects.filter(pk=self.conversation_id).update(unread_count=0)
        return ids

    # ── Presence ───────────────────────────────────────────────────────────

    async def _set_presence(self, status):
        try:
            from django.core.cache import cache
            await cache.aset(f'presence:{self.user.id}', status, timeout=300)
        except Exception:
            pass

    async def _set_offline(self):
        now = timezone.now()
        try:
            from django.core.cache import cache
            await cache.adelete(f'presence:{self.user.id}')
        except Exception:
            pass
        try:
            from apps.users.models import User
            await database_sync_to_async(
                User.objects.filter(id=self.user.id).update
            )(last_seen=now)
        except Exception:
            pass
        return now.isoformat()


# ── Admin Notification Consumer ────────────────────────────────────────────

class AdminNotificationConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = await self._get_admin()
        if not self.user:
            await self.close()
            return
        await self.channel_layer.group_add('admin_notifications', self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'channel_name'):
            try:
                await self.channel_layer.group_discard('admin_notifications', self.channel_name)
            except Exception:
                pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except Exception:
            pass

    async def new_message_notification(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type':            'new_message_notification',
                'conversation_id': event['conversation_id'],
                'body':            event['body'],
                'sender_id':       event['sender_id'],
                'sender_name':     event['sender_name'],
                'created_at':      event['created_at'],
            }))
        except Exception:
            pass

    @database_sync_to_async
    def _get_admin(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from apps.users.models import User
        qs        = self.scope.get('query_string', b'').decode()
        token_val = None
        for part in qs.split('&'):
            if part.startswith('token='):
                token_val = part.split('=', 1)[1]
                break
        if not token_val:
            return None
        try:
            token = AccessToken(token_val)
            user  = User.objects.get(id=token['user_id'])
            return user if user.role == 'admin' else None
        except Exception:
            return None
