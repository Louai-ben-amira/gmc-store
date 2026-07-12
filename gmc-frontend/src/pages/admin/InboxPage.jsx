import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAdminConversations, getAdminMessages, sendAdminMessage, markAdminMessagesRead,
  getCannedResponses, useCannedResponse, getUserContext,
} from '../../api/chat'
import { useWebSocket } from '../../hooks/useWebSocket'
import useAuthStore from '../../store/authStore'
import { formatDate, formatCurrency, mediaUrl } from '../../utils/formatters'
import {
  Send, Paperclip, MessageCircle, X, Search,
  Check, CheckCheck, Zap, ShoppingBag, Wallet, Clock, User,
} from 'lucide-react'
import { T } from '../../components/admin/AdminUI'

// ── Utilities ──────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }) {
  const initials = (name || '?').slice(0, 2).toUpperCase()
  const colors   = ['#7F77DD', '#5048c0', '#1D9E75', '#e05252', '#d97706']
  const bg       = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-primary)', fontSize: size * 0.36, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function MessageTicks({ status }) {
  if (status === 'read')
    return <CheckCheck size={13} style={{ color: '#a0e0ff', flexShrink: 0 }} />
  if (status === 'delivered')
    return <CheckCheck size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
  return <Check size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
}

function TypingBubble({ name }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{ color: '#5C5A54', fontSize: '0.6875rem', marginBottom: '3px' }}>{name}</span>
      <div style={{ padding: '0.625rem 1rem', borderRadius: '1rem 1rem 1rem 0.25rem', background: '#1a1a24', border: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <style>{`@keyframes typingDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}`}</style>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5C5A54', animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite`, display: 'inline-block' }} />
        ))}
      </div>
    </div>
  )
}

// ── Conversation list item ─────────────────────────────────────────────────

function ConvItem({ conv, active, online, onClick }) {
  const client  = conv.client_detail
  const name    = client?.first_name ? `${client.first_name} ${client.last_name || ''}`.trim() : client?.username || 'Unknown'
  const unread  = conv.unread_count || 0
  const lastMsg = conv.last_message?.body || '-'
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
      padding: '0.75rem 1rem', border: 'none', textAlign: 'left', cursor: 'pointer',
      background: active ? 'rgba(127,119,221,0.13)' : 'transparent',
      borderLeft: active ? '3px solid #7F77DD' : '3px solid transparent', transition: 'background 0.15s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ position: 'relative' }}>
        <Avatar name={name} />
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: '10px', height: '10px', borderRadius: '50%',
          background: online ? '#1D9E75' : '#3a3a4a',
          border: '2px solid #13131a',
          boxShadow: online ? '0 0 6px #1D9E75' : 'none',
          transition: 'all 0.3s',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#F0EEE6', fontWeight: unread ? 700 : 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{name}</span>
          {unread > 0 && (
            <span style={{ background: '#7F77DD', color: 'var(--text-primary)', borderRadius: '999px', fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px' }}>{unread > 99 ? '99+' : unread}</span>
          )}
        </div>
        <p style={{ margin: 0, color: '#5C5A54', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastMsg}</p>
      </div>
    </button>
  )
}

// ── Canned Responses popup ─────────────────────────────────────────────────

function CannedPicker({ query, responses, onSelect }) {
  const filtered = responses.filter(r =>
    r.shortcut.toLowerCase().includes(query.toLowerCase()) ||
    r.body.toLowerCase().includes(query.toLowerCase())
  )
  if (filtered.length === 0) return null

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '6px',
      background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: '0.75rem',
      overflow: 'hidden', zIndex: 100,
      boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #2a2a38', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Zap size={12} color="#7F77DD" />
        <span style={{ color: '#7F77DD', fontSize: '0.75rem', fontWeight: 600 }}>Quick Replies</span>
      </div>
      {filtered.map(r => (
        <button key={r.id} onClick={() => onSelect(r)} style={{
          display: 'flex', gap: '0.75rem', width: '100%', padding: '10px 14px',
          border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(127,119,221,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ color: '#7F77DD', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>/{r.shortcut}</span>
          <span style={{ color: '#9E9C94', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.body}</span>
        </button>
      ))}
    </div>
  )
}

// ── Context Panel ──────────────────────────────────────────────────────────

function ContextPanel({ clientId, clientName }) {
  const { data: ctx, isLoading } = useQuery({
    queryKey: ['user-context', clientId],
    queryFn:  () => getUserContext(clientId).then(r => r.data),
    enabled:  !!clientId,
    staleTime: 30000,
  })

  return (
    <div style={{ width: '240px', minWidth: '240px', borderLeft: '1px solid #1e1e2e', background: '#0f0f16', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #1e1e2e' }}>
        <p style={{ margin: 0, color: '#9E9C94', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Client Profile</p>
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#5C5A54', fontSize: '0.8125rem' }}>Loading…</div>
      ) : !ctx ? null : (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Identity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name={clientName} size={32} />
              <div>
                <p style={{ margin: 0, color: '#F0EEE6', fontWeight: 600, fontSize: '0.875rem' }}>{ctx.username}</p>
                <p style={{ margin: 0, color: '#5C5A54', fontSize: '0.75rem' }}>{ctx.email}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: ctx.presence === 'online' ? '#1D9E75' : '#3a3a4a', boxShadow: ctx.presence === 'online' ? '0 0 6px #1D9E75' : 'none' }} />
              <span style={{ color: ctx.presence === 'online' ? '#1D9E75' : '#5C5A54', fontSize: '0.75rem' }}>
                {ctx.presence === 'online' ? 'Online now' : ctx.last_seen ? `Last seen ${ctx.last_seen}` : 'Offline'}
              </span>
            </div>
            <p style={{ margin: 0, color: '#5C5A54', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={11} /> Joined {ctx.joined}
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { icon: Wallet, label: 'Balance', value: `${parseFloat(ctx.balance).toFixed(2)} DT`, color: '#1D9E75' },
              { icon: ShoppingBag, label: 'Orders', value: ctx.order_count, color: '#7F77DD' },
              { icon: ShoppingBag, label: 'Spent', value: `${parseFloat(ctx.total_spent).toFixed(0)} DT`, color: '#d97706' },
              { icon: Zap, label: 'Points', value: ctx.points, color: '#e05252' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{ background: '#1a1a24', borderRadius: '0.5rem', padding: '8px 10px', border: '1px solid #1e1e2e' }}>
                <p style={{ margin: '0 0 3px', color: '#5C5A54', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <p style={{ margin: 0, color, fontWeight: 700, fontSize: '0.9375rem', fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Recent orders */}
          {ctx.orders?.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', color: '#9E9C94', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent Orders</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ctx.orders.map(o => (
                  <div key={o.id} style={{ background: '#1a1a24', border: '1px solid #1e1e2e', borderRadius: '0.5rem', padding: '8px 10px' }}>
                    <p style={{ margin: '0 0 3px', color: '#F0EEE6', fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.product}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#9E9C94', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>{parseFloat(o.amount_paid).toFixed(2)} DT</span>
                      <span style={{ color: '#1D9E75', fontSize: '0.6875rem', fontWeight: 600 }}>✓</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main InboxPage ─────────────────────────────────────────────────────────

export default function InboxPage() {
  const { user }    = useAuthStore()
  const qc          = useQueryClient()
  const [selectedId,   setSelectedId]   = useState(null)
  const [input,        setInput]        = useState('')
  const [attachment,   setAttachment]   = useState(null)
  const [sending,      setSending]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [isTyping,     setIsTyping]     = useState(false)
  const [onlineUsers,  setOnlineUsers]  = useState(new Set())
  const [cannedQuery,  setCannedQuery]  = useState('')
  const [showCanned,   setShowCanned]   = useState(false)
  const [showContext,  setShowContext]  = useState(true)
  const [mobileView,   setMobileView]  = useState('list') // 'list' | 'chat'
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep link: /admin/inbox?conversation=<id> opens that conversation directly
  useEffect(() => {
    const cid = searchParams.get('conversation')
    if (cid) {
      setSelectedId(Number(cid))
      setMobileView('chat')
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bottomRef      = useRef(null)
  const messagesBoxRef = useRef(null)
  const fileRef        = useRef(null)
  const typingTimer    = useRef(null)
  const lastTypingSent = useRef(false)
  const inputRef       = useRef(null)

  const isNearBottom = () => {
    const el = messagesBoxRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  const { data: conversations = [], refetch: refetchConvs } = useQuery({
    queryKey: ['admin-conversations'],
    queryFn:  () => getAdminConversations().then(r => r.data),
    refetchInterval: 8000,
  })

  // Global admin notification WS - receives new messages from ANY conversation
  const onAdminNotification = useCallback((msg) => {
    if (msg.type !== 'new_message_notification') return
    // Bump the conversation to top + refresh list
    qc.setQueryData(['admin-conversations'], (old = []) => {
      const existing = old.find(c => c.id === msg.conversation_id)
      if (!existing) { refetchConvs(); return old }
      const updated = {
        ...existing,
        last_message:  { body: msg.body, created_at: msg.created_at },
        unread_count:  selectedId === msg.conversation_id ? existing.unread_count : (existing.unread_count || 0) + 1,
      }
      return [updated, ...old.filter(c => c.id !== msg.conversation_id)]
    })
    // If the notification is for the currently open conversation, refetch messages
    // immediately so the admin sees the client's message even if the per-conversation
    // WebSocket missed it (e.g. still connecting).
    if (msg.conversation_id === selectedId) {
      qc.invalidateQueries({ queryKey: ['admin-messages', selectedId] })
    }
  }, [selectedId, qc, refetchConvs])

  const { wsStatus: adminWsStatus } = useWebSocket('admin', onAdminNotification)

  const { data: cannedResponses = [] } = useQuery({
    queryKey: ['canned-responses'],
    queryFn:  () => getCannedResponses().then(r => r.data),
  })

  // Poll messages every 4 seconds for the selected conversation
  const { data: messagesData } = useQuery({
    queryKey: ['admin-messages', selectedId],
    queryFn:  () => getAdminMessages(selectedId).then(r => {
      const d = r.data?.results || r.data || []
      return Array.isArray(d) ? d : []
    }),
    enabled:         !!selectedId,
    refetchInterval: 4000,
    staleTime:       2000,
  })
  const messages = messagesData || []

  const filtered = conversations.filter(c => {
    if (!search) return true
    const n = `${c.client_detail?.username || ''} ${c.client_detail?.first_name || ''} ${c.client_detail?.last_name || ''}`
    return n.toLowerCase().includes(search.toLowerCase())
  })

  const onWsMessage = useCallback((msg) => {
    if (msg.type === 'typing_status') {
      setIsTyping(msg.is_typing)
      if (msg.is_typing) {
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setIsTyping(false), 3500)
      }
      return
    }
    if (msg.type === 'presence_update') {
      setOnlineUsers(prev => {
        const next = new Set(prev)
        if (msg.status === 'online') next.add(msg.user_id)
        else next.delete(msg.user_id)
        return next
      })
      return
    }
    if (msg.type === 'read_receipt' || msg.type === 'message_status_update') {
      qc.setQueryData(['admin-messages', selectedId], (old = []) =>
        old.map(m => msg.message_ids?.includes(m.id) ? { ...m, status: msg.status || 'read' } : m)
      )
      return
    }
    if (msg.type === 'chat_message') {
      qc.setQueryData(['admin-messages', selectedId], (old = []) => {
        if (!old) return old
        if (old.find(m => m.id === msg.id)) return old
        const realMsg = {
          id:            msg.id,
          body:          msg.body,
          sender:        msg.sender_id,
          sender_detail: { id: msg.sender_id, username: msg.sender_name },
          attachment:    msg.attachment_url,
          created_at:    msg.created_at,
          status:        msg.status,
        }
        // Replace optimistic temp if we sent this message
        if (msg.sender_id === user?.id) {
          const tempIdx = old.findIndex(m => typeof m.id === 'string' && m.id.startsWith('temp-') && m.body === msg.body)
          if (tempIdx !== -1) {
            const next = [...old]
            next[tempIdx] = realMsg
            return next
          }
        }
        return [...old, realMsg]
      })
      qc.setQueryData(['admin-conversations'], (old = []) =>
        old.map(c => c.id === selectedId
          ? { ...c, last_message: { body: msg.body, created_at: msg.created_at }, unread_count: 0 }
          : c
        )
      )
    }
  }, [selectedId, qc, user?.id])

  const { sendMessage: wsSend, wsStatus } = useWebSocket(selectedId, onWsMessage)

  // Mark as read via WS (instant ticks) when switching conv or new messages arrive
  useEffect(() => {
    if (!selectedId) return
    setIsTyping(false)
    const sent = wsSend({ type: 'read' })
    if (!sent) markAdminMessagesRead(selectedId).catch(() => {})
  }, [selectedId, messages.length])

  // Scroll to bottom on conversation switch (instant)
  useEffect(() => { scrollToBottom(false) }, [selectedId])
  // Smart scroll: only follow new messages/typing if already at bottom
  useEffect(() => { if (isNearBottom()) scrollToBottom() }, [messages.length, isTyping])

  // Input handling + canned responses trigger
  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)

    // Canned responses: show when input starts with "/"
    if (val.startsWith('/')) {
      setCannedQuery(val.slice(1))
      setShowCanned(true)
    } else {
      setShowCanned(false)
      setCannedQuery('')
    }

    // Typing indicator
    if (!lastTypingSent.current) {
      wsSend({ type: 'typing', is_typing: true })
      lastTypingSent.current = true
    }
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      wsSend({ type: 'typing', is_typing: false })
      lastTypingSent.current = false
    }, 2000)
  }

  const handleCannedSelect = async (response) => {
    setInput(response.body)
    setShowCanned(false)
    setCannedQuery('')
    inputRef.current?.focus()
    useCannedResponse(response.id).catch(() => {})
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if ((!input.trim() && !attachment) || !selectedId) return
    setShowCanned(false)
    clearTimeout(typingTimer.current)
    wsSend({ type: 'typing', is_typing: false })
    lastTypingSent.current = false

    setSending(true)
    try {
      if (attachment) {
        const fd = new FormData()
        fd.append('body', input.trim()); fd.append('attachment', attachment); fd.append('conversation_id', selectedId)
        const { data: msg } = await sendAdminMessage(fd)
        qc.setQueryData(['admin-messages', selectedId], (old = []) => [...(old || []), msg])
        setInput(''); setAttachment(null)
        scrollToBottom()
      } else {
        const body   = input.trim()
        const tempId = `temp-${Date.now()}`

        await qc.cancelQueries({ queryKey: ['admin-messages', selectedId] })
        qc.setQueryData(['admin-messages', selectedId], (old = []) => [...(old || []), {
          id: tempId, body, sender: user?.id,
          sender_detail: { id: user?.id, username: user?.username },
          attachment: null, created_at: new Date().toISOString(), status: 'sent',
        }])
        setInput('')
        scrollToBottom()

        // Always save via HTTP - reliable acknowledgment. The backend broadcasts
        // the saved message via WebSocket so the client receives it in real-time.
        const fd = new FormData()
        fd.append('body', body)
        fd.append('conversation_id', selectedId)
        const { data: msg } = await sendAdminMessage(fd)
        qc.setQueryData(['admin-messages', selectedId], (old = []) =>
          (old || []).map(m => m.id === tempId ? msg : m)
        )
      }
    } catch {}
    setSending(false)
  }

  const handleKeyDown = (e) => {
    if (showCanned && e.key === 'Escape') { setShowCanned(false); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
  }

  const selectedConv = conversations.find(c => c.id === selectedId)
  const clientName   = selectedConv
    ? (selectedConv.client_detail?.first_name
        ? `${selectedConv.client_detail.first_name} ${selectedConv.client_detail.last_name || ''}`.trim()
        : selectedConv.client_detail?.username || 'Unknown')
    : null
  const clientId     = selectedConv?.client_detail?.id

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: T.bgPage }}>

      {/* ── Conversation list ─────────────────────────────── */}
      <div className={`inbox-conv-list${mobileView === 'chat' ? ' inbox-hidden-mobile' : ''}`} style={{ width: '260px', minWidth: '260px', borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', background: T.bgStrip }}>
        <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <p style={{ margin: 0, color: T.textPrimary, fontWeight: 700, fontSize: '0.9375rem' }}>Inbox</p>
            <span style={{ background: 'rgba(155,79,237,0.15)', color: T.purpleText, borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px' }}>
              {conversations.filter(c => c.unread_count > 0).length} new
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: T.textMuted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…" style={{ paddingLeft: '2rem', fontSize: '0.8125rem', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, color: T.textPrimary, outline: 'none', width: '100%', padding: '6px 8px 6px 2rem' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <div style={{ textAlign: 'center', color: T.textMuted, padding: '2rem 1rem', fontSize: '0.8125rem' }}>No conversations.</div>
            : filtered.map(c => (
              <ConvItem
                key={c.id} conv={c} active={c.id === selectedId}
                online={onlineUsers.has(c.client_detail?.id)}
                onClick={() => { setSelectedId(c.id); setMobileView('chat') }}
              />
            ))
          }
        </div>
      </div>

      {/* ── Chat area ────────────────────────────────────── */}
      <div className={`inbox-chat-area${mobileView === 'list' ? ' inbox-hidden-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedId && selectedConv ? (
          <>
            {/* Header */}
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', gap: '0.875rem', background: '#13131a', flexShrink: 0 }}>
              {/* Back button - only on mobile */}
              <button className="inbox-back-btn" onClick={() => setMobileView('list')} style={{ background: 'rgba(127,119,221,0.12)', border: '1px solid #2a2a38', borderRadius: 8, cursor: 'pointer', color: '#7F77DD', display: 'none', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, flexShrink: 0 }}>
                ‹
              </button>
              <div style={{ position: 'relative' }}>
                <Avatar name={clientName} size={36} />
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: onlineUsers.has(clientId) ? '#1D9E75' : '#3a3a4a',
                  border: '2px solid #13131a',
                  boxShadow: onlineUsers.has(clientId) ? '0 0 6px #1D9E75' : 'none',
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: '#F0EEE6', fontWeight: 600, fontSize: '0.9375rem' }}>{clientName}</p>
                <p style={{ margin: 0, color: '#5C5A54', fontSize: '0.75rem' }}>
                  {onlineUsers.has(clientId) ? 'Online now' : selectedConv.client_detail?.email || ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600, background: selectedConv.status === 'open' ? 'rgba(29,158,117,0.15)' : 'rgba(92,90,84,0.2)', color: selectedConv.status === 'open' ? '#1D9E75' : '#5C5A54' }}>
                  {selectedConv.status}
                </span>
                <button
                  onClick={() => setShowContext(v => !v)}
                  title="Toggle client profile"
                  style={{ background: showContext ? 'rgba(127,119,221,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid #1e1e2e', borderRadius: '0.375rem', padding: '5px 8px', cursor: 'pointer', color: showContext ? '#7F77DD' : '#9E9C94', display: 'flex', alignItems: 'center' }}
                >
                  <User size={14} />
                </button>
              </div>
            </div>

            {/* Messages + context panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {wsStatus !== 'connected' && (
                  <div style={{ padding: '6px 16px', background: wsStatus === 'connecting' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', borderBottom: `1px solid ${wsStatus === 'connecting' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: wsStatus === 'connecting' ? '#f59e0b' : '#ef4444', animation: 'wsPulse 1.4s ease-in-out infinite' }} />
                    <span style={{ fontSize: '0.75rem', color: wsStatus === 'connecting' ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                      {wsStatus === 'connecting' ? 'Reconnecting to live chat…' : 'Disconnected - messages may be delayed'}
                    </span>
                    <style>{`@keyframes wsPulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
                  </div>
                )}
                <div ref={messagesBoxRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem', padding: '1rem 1.25rem 0.5rem' }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#5C5A54', marginTop: '4rem', fontSize: '0.875rem' }}>
                      <MessageCircle size={40} style={{ opacity: 0.1, display: 'block', margin: '0 auto 0.75rem' }} />
                      No messages yet.
                    </div>
                  ) : messages.map(msg => {
                    const isOwn  = msg.sender === user?.id || msg.sender_detail?.id === user?.id
                    const isTemp = typeof msg.id === 'string' && msg.id.startsWith('temp-')
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                        {!isOwn && <span style={{ color: '#5C5A54', fontSize: '0.6875rem', marginBottom: '3px' }}>{msg.sender_detail?.username || clientName}</span>}
                        <div style={{ maxWidth: '65%', padding: '0.625rem 0.875rem', borderRadius: isOwn ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem', background: isOwn ? '#7F77DD' : '#1a1a24', border: isOwn ? 'none' : '1px solid #1e1e2e', opacity: isTemp ? 0.6 : 1 }}>
                          {msg.attachment && <img src={typeof msg.attachment === 'string' ? msg.attachment : URL.createObjectURL(msg.attachment)} alt="" style={{ maxWidth: '100%', borderRadius: '0.5rem', marginBottom: msg.body ? '0.5rem' : 0 }} />}
                          {msg.body && <p style={{ margin: 0, color: isOwn ? 'white' : '#F0EEE6', fontSize: '0.9375rem', lineHeight: 1.5 }}>{msg.body}</p>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                          <span style={{ color: '#5C5A54', fontSize: '0.6875rem' }}>{formatDate(msg.created_at)}</span>
                          {isOwn && <MessageTicks status={isTemp ? 'sent' : (msg.status || 'sent')} />}
                        </div>
                      </div>
                    )
                  })}
                  {isTyping && <TypingBubble name={clientName} />}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} style={{ padding: '0.875rem 1.25rem 1rem', borderTop: '1px solid #1e1e2e', flexShrink: 0, position: 'relative' }}>
                  {showCanned && (
                    <CannedPicker
                      query={cannedQuery}
                      responses={cannedResponses}
                      onSelect={handleCannedSelect}
                    />
                  )}
                  {attachment && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: '#1a1a24', border: '1px solid #1e1e2e', borderRadius: '0.5rem' }}>
                      <span style={{ color: '#9E9C94', fontSize: '0.8125rem', flex: 1 }}>{attachment.name}</span>
                      <button type="button" onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E9C94' }}><X size={14} /></button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={e => setAttachment(e.target.files[0])} />
                    <button type="button" onClick={() => fileRef.current?.click()} style={{ background: '#1a1a24', border: '1px solid #1e1e2e', borderRadius: '0.5rem', padding: '0.625rem', cursor: 'pointer', color: '#9E9C94', flexShrink: 0 }}>
                      <Paperclip size={18} />
                    </button>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <textarea
                        ref={inputRef}
                        rows={1} value={input}
                        onChange={handleInputChange} onKeyDown={handleKeyDown}
                        placeholder={`Reply to ${clientName}… (type / for quick replies)`}
                        style={{ resize: 'none', width: '100%', minHeight: '42px', maxHeight: '120px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button type="submit" disabled={sending || (!input.trim() && !attachment)} className="btn-primary" style={{ padding: '0.625rem 1rem', flexShrink: 0 }}>
                      <Send size={16} />
                    </button>
                  </div>
                </form>
              </div>

              {/* Context panel - hidden on mobile */}
              {showContext && <div className="inbox-context-panel"><ContextPanel clientId={clientId} clientName={clientName} /></div>}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.textMuted, background: T.bgPanel }}>
            <MessageCircle size={56} style={{ marginBottom: '1rem', opacity: 0.08 }} />
            <p style={{ margin: 0, fontWeight: 600, color: T.textSub }}>Select a conversation</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>Choose a customer from the left.</p>
          </div>
        )}
      </div>
    </div>
  )
}

