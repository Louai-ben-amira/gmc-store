import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getConversation, getMessages, sendMessage, markMessagesRead } from '../api/chat'
import { confirmDelivery, openDispute, revealCredentials, updateServiceStatus } from '../api/orders'
import { useWebSocket } from '../hooks/useWebSocket'
import useAuthStore from '../store/authStore'
import Topbar from '../components/Topbar'
import Badge from '../components/ui/Badge'
import Modal from '../components/Modal'
import { useToast } from '../hooks/useToast'
import { formatDate } from '../utils/formatters'
import {
  TbSend, TbPaperclip, TbMessageCircle, TbX, TbCheck, TbChecks,
  TbLock, TbEye, TbEyeOff, TbShoppingBag, TbAlertTriangle,
  TbCircleCheck, TbClock, TbRefresh, TbShieldLock, TbBolt,
} from 'react-icons/tb'

/* ── Message ticks ───────────────────────────────────────────────────── */
function MessageTicks({ status }) {
  if (status === 'read')      return <TbChecks size={13} style={{ color: '#7C3AED', flexShrink: 0 }} />
  if (status === 'delivered') return <TbChecks size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
  return <TbCheck size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
}

/* ── Typing bubble ───────────────────────────────────────────────────── */
function TypingBubble() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 4, marginLeft: 46 }}>Support is typing…</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* avatar */}
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#4C1D95)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '0.5rem', color: 'var(--text-primary)' }}>GMC</span>
        </div>
        <div style={{ padding: '10px 16px', borderRadius: '4px 18px 18px 18px', background: '#1a1a28', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', display: 'inline-block', animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Order card ──────────────────────────────────────────────────────── */
function OrderCard({ metadata }) {
  const statusMap = {
    paid_escrow: { label: 'Paid — In Escrow', color: '#f59e0b' },
    in_progress: { label: 'In Progress',       color: '#38BDF8' },
    completed:   { label: 'Completed',          color: '#3DDC84' },
    disputed:    { label: 'Disputed',           color: '#ff4d6d' },
    closed:      { label: 'Closed',             color: 'var(--text-muted)' },
  }
  const s = statusMap[metadata?.status] || { label: metadata?.status || 'Pending', color: '#f59e0b' }
  return (
    <div style={{ background: '#1a1a28', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', minWidth: 260, maxWidth: 340, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,' + s.color + ',transparent)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TbShoppingBag size={14} color="var(--text-primary)" />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>ORDER</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, background: s.color + '18', border: '1px solid ' + s.color + '35', borderRadius: 6, padding: '2px 8px' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, color: s.color, letterSpacing: '0.06em' }}>{s.label.toUpperCase()}</span>
        </div>
      </div>
      <p style={{ margin: '0 0 8px', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
        {metadata?.product_name || 'Unknown product'}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)' }}>#{metadata?.order_id}</span>
        <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#3DDC84' }}>{metadata?.amount_paid} DT</span>
      </div>
    </div>
  )
}

/* ── Credentials card ────────────────────────────────────────────────── */
function CredentialsCard({ metadata, isAdmin, orderId }) {
  const [revealed,   setRevealed]   = useState(false)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [revealedAt, setRevealedAt] = useState(null)
  const toast = useToast()

  const handleReveal = async () => {
    if (revealed) { setRevealed(false); return }
    setLoading(true)
    try {
      const id = orderId || metadata?.order_id
      const { data: resp } = await revealCredentials(id)
      setData(resp.credentials_data)
      setRevealedAt(new Date().toLocaleString())
      setRevealed(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not reveal credentials.')
    } finally { setLoading(false) }
  }

  if (!isAdmin) return (
    <div style={{ background: '#1a1a28', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 14, padding: '0.875rem 1rem', minWidth: 240, maxWidth: 320, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <TbShieldLock size={16} color="#7C3AED" />
      </div>
      <div>
        <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Credentials delivered to seller</p>
        <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Encrypted · Deleted after service</p>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#1a1a28', border: '1px solid ' + (revealed ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)'), borderRadius: 14, padding: '1rem', minWidth: 260, maxWidth: 360 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TbLock size={13} color={revealed ? '#A78BFA' : 'var(--text-muted)'} />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>CREDENTIALS</span>
        <div style={{ marginLeft: 'auto', background: revealed ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (revealed ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)'), borderRadius: 6, padding: '2px 8px' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, color: revealed ? '#A78BFA' : 'var(--text-muted)' }}>{revealed ? 'REVEALED' : 'LOCKED'}</span>
        </div>
      </div>
      {revealed && data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {Object.entries(data).filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', wordBreak: 'break-all' }}>
                {k === 'password' ? '••••••••' : v}
              </span>
            </div>
          ))}
          {revealedAt && <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: 'var(--text-muted)', margin: '4px 0 0', letterSpacing: '0.06em' }}>VIEWED {revealedAt}</p>}
        </div>
      ) : (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>Click below to decrypt and view credentials. This action is logged.</p>
      )}
      <button onClick={handleReveal} disabled={loading} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
        background: revealed ? 'transparent' : 'rgba(124,58,237,0.12)',
        border: '1px solid ' + (revealed ? 'rgba(255,255,255,0.1)' : 'rgba(124,58,237,0.3)'),
        color: revealed ? 'rgba(255,255,255,0.4)' : 'var(--accent)',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 700,
        cursor: loading ? 'wait' : 'pointer', transition: 'all 0.14s', letterSpacing: '0.06em',
      }}>
        {revealed ? <><TbEyeOff size={12} /> HIDE</> : <><TbEye size={12} /> {loading ? 'DECRYPTING…' : 'REVEAL'}</>}
      </button>
    </div>
  )
}

/* ── Status update card ──────────────────────────────────────────────── */
function StatusCard({ body, metadata, createdAt }) {
  const s = metadata?.service_status
  const color = s === 'completed' ? '#3DDC84' : s === 'disputed' ? '#ff4d6d' : '#38BDF8'
  const Icon  = s === 'completed' ? TbCircleCheck : s === 'disputed' ? TbAlertTriangle : TbRefresh
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: color + '10', border: '1px solid ' + color + '25', borderRadius: 10, padding: '8px 14px', maxWidth: 400 }}>
      <Icon size={14} color={color} />
      <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>{body}</p>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(createdAt)}</span>
    </div>
  )
}

/* ── Action bar ──────────────────────────────────────────────────────── */
function ActionBar({ orderId, orderStatus, serviceStatus, isAdmin, onAction }) {
  const [confirmModal,   setConfirmModal]   = useState(null)
  const [disputeReason,  setDisputeReason]  = useState('')
  const [note,           setNote]           = useState('')
  const [busy,           setBusy]           = useState(false)
  const toast = useToast()

  const act = async (fn, successMsg) => {
    setBusy(true)
    try { await fn(); toast.success(successMsg); onAction?.() }
    catch (err) { toast.error(err.response?.data?.detail || 'Action failed.') }
    finally { setBusy(false) }
  }

  if (isAdmin) {
    const canMarkInProgress = serviceStatus === 'pending' || orderStatus === 'paid_escrow'
    const canMarkCompleted  = serviceStatus === 'in_progress' || orderStatus === 'in_progress'
    if (!canMarkInProgress && !canMarkCompleted) return null
    return (
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', flexShrink: 0, borderRadius: '0 0 16px 16px', alignItems: 'center' }}>
        {canMarkInProgress && (
          <button onClick={() => act(() => updateServiceStatus(orderId, { service_status: 'in_progress', note }), 'Marked in progress')}
            disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38BDF8', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.13s' }}>
            <TbRefresh size={13} /> In Progress
          </button>
        )}
        {canMarkCompleted && (
          <button onClick={() => act(() => updateServiceStatus(orderId, { service_status: 'completed', note }), 'Marked completed')}
            disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(61,220,132,0.1)', border: '1px solid rgba(61,220,132,0.25)', color: '#3DDC84', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.13s' }}>
            <TbCircleCheck size={13} /> Mark Completed
          </button>
        )}
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)…"
          style={{ flex: 1, height: 34, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', color: 'var(--text-primary)' }} />
      </div>
    )
  }

  const canConfirm = ['completed', 'in_progress'].includes(orderStatus)
  const canDispute = ['paid_escrow', 'in_progress', 'completed'].includes(orderStatus)
  if (!canConfirm && !canDispute) return null

  return (
    <>
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', flexShrink: 0, borderRadius: '0 0 16px 16px' }}>
        {canDispute && (
          <button onClick={() => setConfirmModal('dispute')} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.22)', color: '#ff4d6d', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.13s' }}>
            <TbAlertTriangle size={13} /> Dispute
          </button>
        )}
        {canConfirm && (
          <button onClick={() => setConfirmModal('confirm')} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', padding: '9px', borderRadius: 9, background: 'linear-gradient(135deg,#7C3AED,#5b21b6)', border: 'none', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
            <TbCircleCheck size={15} /> Confirm Delivery
          </button>
        )}
      </div>

      {confirmModal === 'confirm' && (
        <Modal isOpen title="Confirm Delivery" onClose={() => setConfirmModal(null)} size="sm">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(61,220,132,0.1)', border: '1px solid rgba(61,220,132,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <TbCircleCheck size={26} color="#3DDC84" />
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Confirm you have received your service in full. This <strong style={{ color: 'var(--text-primary)' }}>releases payment to the seller</strong> — this action is permanent.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setConfirmModal(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button className="btn-primary" disabled={busy}
              onClick={() => { setConfirmModal(null); act(() => confirmDelivery(orderId), 'Order confirmed! Payment released.') }}
              style={{ flex: 1, justifyContent: 'center' }}>
              Yes, Confirm
            </button>
          </div>
        </Modal>
      )}

      {confirmModal === 'dispute' && (
        <Modal isOpen title="Open Dispute" onClose={() => setConfirmModal(null)} size="sm">
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '0.875rem' }}>
            Describe the issue. Payment stays in escrow until an admin resolves it.
          </p>
          <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
            placeholder="What went wrong?" rows={3}
            style={{ width: '100%', resize: 'vertical', marginBottom: '1rem', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setConfirmModal(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button disabled={busy || !disputeReason.trim()}
              onClick={() => { setConfirmModal(null); act(() => openDispute(orderId, { reason: disputeReason }), 'Dispute opened.') }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, background: 'rgba(255,77,109,0.15)', border: '1px solid rgba(255,77,109,0.3)', color: '#ff4d6d', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              <TbAlertTriangle size={14} /> Open Dispute
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function MessengerPage() {
  const { t } = useTranslation('messenger')
  const { user } = useAuthStore()
  const qc       = useQueryClient()
  const toast    = useToast()
  const isAdmin  = user?.role === 'admin'

  const [input,        setInput]       = useState('')
  const [attachment,   setAttachment]  = useState(null)
  const [sending,      setSending]     = useState(false)
  const [isTyping,     setIsTyping]    = useState(false)
  const [adminOnline,  setAdminOnline] = useState(false)
  const bottomRef      = useRef(null)
  const messagesBoxRef = useRef(null)
  const fileRef        = useRef(null)
  const typingTimer    = useRef(null)
  const lastTypingSent = useRef(false)
  const textareaRef    = useRef(null)

  const isNearBottom = () => {
    const el = messagesBoxRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }
  const scrollToBottom = (smooth = true) =>
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })

  const { data: conversation } = useQuery({
    queryKey: ['conversation'],
    queryFn:  () => getConversation().then(r => r.data),
  })
  const { data: messagesData } = useQuery({
    queryKey: ['messages', conversation?.id],
    queryFn:  () => getMessages().then(r => {
      const d = r.data?.results || r.data || []
      return Array.isArray(d) ? d : []
    }),
    enabled: !!conversation, refetchInterval: 4000, staleTime: 2000,
  })
  const messages = messagesData || []

  const latestOrderCard     = [...messages].reverse().find(m => m.msg_type === 'order_card')
  const activeOrderId       = latestOrderCard?.metadata?.order_id
  const activeStatus        = latestOrderCard?.metadata?.status
  const activeServiceStatus = latestOrderCard?.metadata?.service_status

  const onWsMessage = useCallback((msg) => {
    if (msg.type === 'typing_status') {
      setIsTyping(msg.is_typing)
      if (msg.is_typing) { clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => setIsTyping(false), 3500) }
      return
    }
    if (msg.type === 'presence_update') { setAdminOnline(msg.status === 'online'); return }
    if (msg.type === 'read_receipt' || msg.type === 'message_status_update') {
      qc.setQueryData(['messages', conversation?.id], (old = []) =>
        old.map(m => msg.message_ids?.includes(m.id) ? { ...m, status: msg.status || 'read' } : m)
      ); return
    }
    if (msg.type === 'chat_message') {
      qc.setQueryData(['messages', conversation?.id], (old = []) => {
        if (!old) return old
        if (old.find(m => m.id === msg.id)) return old
        const realMsg = { id: msg.id, body: msg.body, sender: msg.sender_id, sender_detail: { id: msg.sender_id, username: msg.sender_name }, attachment: msg.attachment_url, msg_type: msg.msg_type || 'text', metadata: msg.metadata || {}, created_at: msg.created_at, status: msg.status }
        if (msg.sender_id === user?.id) {
          const tempIdx = old.findIndex(m => typeof m.id === 'string' && m.id.startsWith('temp-') && m.body === msg.body)
          if (tempIdx !== -1) { const next = [...old]; next[tempIdx] = realMsg; return next }
        }
        return [...old, realMsg]
      })
    }
  }, [conversation?.id, qc, user?.id])

  const { sendMessage: wsSend, wsStatus } = useWebSocket(conversation?.id, onWsMessage)

  useEffect(() => {
    if (!conversation) return
    const sent = wsSend({ type: 'read' })
    if (!sent) markMessagesRead({}).catch(() => {})
  }, [conversation?.id, messages.length])

  // Initial scroll on conversation load (instant)
  useEffect(() => { scrollToBottom(false) }, [conversation?.id])
  // Smart scroll: only follow new messages/typing if already near bottom
  useEffect(() => { if (isNearBottom()) scrollToBottom() }, [messages.length, isTyping])

  const handleInputChange = (e) => {
    setInput(e.target.value)
    // auto-grow textarea
    const el = textareaRef.current
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }
    if (!lastTypingSent.current) { wsSend({ type: 'typing', is_typing: true }); lastTypingSent.current = true }
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => { wsSend({ type: 'typing', is_typing: false }); lastTypingSent.current = false }, 2000)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() && !attachment) return
    clearTimeout(typingTimer.current)
    wsSend({ type: 'typing', is_typing: false }); lastTypingSent.current = false
    setSending(true)
    try {
      if (attachment) {
        const fd = new FormData()
        fd.append('body', input.trim()); fd.append('attachment', attachment); fd.append('conversation', conversation.id)
        const { data: msg } = await sendMessage(fd)
        qc.setQueryData(['messages', conversation?.id], (old = []) => [...old, msg])
        setInput(''); setAttachment(null)
      } else {
        const body = input.trim(); const tempId = `temp-${Date.now()}`
        await qc.cancelQueries({ queryKey: ['messages', conversation?.id] })
        qc.setQueryData(['messages', conversation?.id], (old = []) => [...(old || []), {
          id: tempId, body, sender: user?.id, sender_detail: { id: user?.id, username: user?.username },
          attachment: null, msg_type: 'text', metadata: {}, created_at: new Date().toISOString(), status: 'sent',
        }])
        setInput('')
        if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
        scrollToBottom()
        const sent = wsSend({ type: 'message', body })
        if (!sent) {
          const fd = new FormData(); fd.append('body', body); fd.append('conversation', conversation.id)
          const { data: msg } = await sendMessage(fd)
          qc.setQueryData(['messages', conversation?.id], (old = []) => (old || []).map(m => m.id === tempId ? msg : m))
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.body?.[0] || 'Failed to send message.')
    }
    setSending(false)
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }
  const isThreadClosed = conversation?.status === 'resolved'

  // group messages by date
  const grouped = []
  let lastDate = null
  messages.forEach(msg => {
    const d = new Date(msg.created_at).toDateString()
    if (d !== lastDate) { grouped.push({ type: 'date', date: d, id: 'date-' + d }); lastDate = d }
    grouped.push({ type: 'msg', msg })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />

      {/* On mobile: no outer padding so the chat fills the full screen.
          On desktop: contained card with rounded corners and padding. */}
      <div className="messenger-outer" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.25rem 1.5rem 1.5rem' }}>
        <div className="messenger-card" style={{ maxWidth: 820, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20 }}>

          {/* ── Chat header ─── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {/* GMC avatar */}
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#7C3AED,#4C1D95)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(124,58,237,0.35)', position: 'relative' }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '0.5625rem', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>GMC</span>
              {/* online dot */}
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: '50%', background: adminOnline ? '#3DDC84' : 'rgba(255,255,255,0.2)', border: '2px solid #111119', transition: 'background 0.3s' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{t('support.name')}</p>
              <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: adminOnline ? '#3DDC84' : 'var(--text-muted)', transition: 'color 0.3s' }}>
                {adminOnline ? t('support.online') : t('support.offline')}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isThreadClosed && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 7, padding: '3px 9px' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>ARCHIVED</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 8, padding: '5px 10px' }}>
                <TbBolt size={11} color="#A78BFA" />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{t('support.badge')}</span>
              </div>
            </div>
          </div>

          {/* ── Connection status banner ─── */}
          {conversation && wsStatus !== 'connected' && (
            <div style={{ padding: '5px 16px', background: wsStatus === 'connecting' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', borderBottom: `1px solid ${wsStatus === 'connecting' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: wsStatus === 'connecting' ? '#f59e0b' : '#ef4444', animation: 'wsPulse 1.4s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: wsStatus === 'connecting' ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                {wsStatus === 'connecting' ? 'Reconnecting…' : 'Connection lost — messages saved when reconnected'}
              </span>
            </div>
          )}

          {/* ── Messages area ─── */}
          <div ref={messagesBoxRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '1.25rem 1.25rem 0.5rem' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', padding: '3rem' }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <TbMessageCircle size={30} color="rgba(124,58,237,0.4)" />
                </div>
                <p style={{ margin: '0 0 6px', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-muted)' }}>{t('chat.empty')}</p>
                <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('chat.emptyHint')}</p>
              </div>
            ) : (
              grouped.map(item => {
                if (item.type === 'date') return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--bg-elevated)' }} />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.date}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--bg-elevated)' }} />
                  </div>
                )

                const { msg } = item
                const isOwn  = msg.sender === user?.id || msg.sender_detail?.id === user?.id
                const isTemp = typeof msg.id === 'string' && msg.id.startsWith('temp-')
                const mtype  = msg.msg_type || 'text'

                if (mtype === 'order_card') return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start', animation: 'msgIn 0.25s ease both' }}>
                    <OrderCard metadata={msg.metadata} />
                  </div>
                )
                if (mtype === 'credentials_card') return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start', animation: 'msgIn 0.25s ease both' }}>
                    <CredentialsCard metadata={msg.metadata} isAdmin={isAdmin} orderId={msg.metadata?.order_id} />
                  </div>
                )
                if (mtype === 'status_update') return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', animation: 'msgIn 0.25s ease both' }}>
                    <StatusCard body={msg.body} metadata={msg.metadata} createdAt={msg.created_at} />
                  </div>
                )

                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', animation: 'msgIn 0.2s ease both' }}>
                    {/* avatar row for incoming */}
                    {!isOwn && (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7C3AED,#4C1D95)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 18 }}>
                          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '0.4rem', color: 'var(--text-primary)' }}>GMC</span>
                        </div>
                        <div>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 2, display: 'block', marginBottom: 3 }}>Support</span>
                          <div style={{ maxWidth: 480, padding: '10px 14px', borderRadius: '4px 18px 18px 18px', background: '#1a1a28', border: '1px solid var(--border)' }}>
                            {msg.attachment && <img src={typeof msg.attachment === 'string' ? msg.attachment : URL.createObjectURL(msg.attachment)} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.body ? 6 : 0 }} />}
                            {msg.body && <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', lineHeight: 1.55, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{msg.body}</p>}
                          </div>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: 'var(--text-muted)', marginLeft: 4, display: 'block', marginTop: 3 }}>{formatDate(msg.created_at)}</span>
                        </div>
                      </div>
                    )}

                    {/* own bubble */}
                    {isOwn && (
                      <>
                        <div style={{ maxWidth: 480, padding: '10px 14px', borderRadius: '18px 4px 18px 18px', background: 'linear-gradient(135deg,#7C3AED,#5b21b6)', opacity: isTemp ? 0.6 : 1, boxShadow: isTemp ? 'none' : '0 4px 16px rgba(124,58,237,0.25)' }}>
                          {msg.attachment && <img src={typeof msg.attachment === 'string' ? msg.attachment : URL.createObjectURL(msg.attachment)} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.body ? 6 : 0 }} />}
                          {msg.body && <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', lineHeight: 1.55, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{msg.body}</p>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, marginRight: 2 }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: 'var(--text-muted)' }}>{formatDate(msg.created_at)}</span>
                          <MessageTicks status={isTemp ? 'sent' : (msg.status || 'sent')} />
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
            {isTyping && <TypingBubble />}
            <div ref={bottomRef} />
          </div>

          {/* ── Action bar ─── */}
          {activeOrderId && !isThreadClosed && (
            <ActionBar orderId={activeOrderId} orderStatus={activeStatus} serviceStatus={activeServiceStatus} isAdmin={isAdmin}
              onAction={() => { qc.invalidateQueries({ queryKey: ['messages', conversation?.id] }); qc.invalidateQueries({ queryKey: ['conversation'] }) }}
            />
          )}

          {/* ── Input area ─── */}
          <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            {/* attachment preview */}
            {attachment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 12px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8 }}>
                <TbPaperclip size={13} color="#A78BFA" />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
                <button type="button" onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                  <TbX size={13} />
                </button>
              </div>
            )}

            {isThreadClosed ? (
              <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Thread archived · Order closed</span>
              </div>
            ) : (
              <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={e => setAttachment(e.target.files[0])} />
                <button type="button" onClick={() => fileRef.current?.click()} style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.14s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.color = '#A78BFA' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
                >
                  <TbPaperclip size={17} />
                </button>

                <div style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'flex-end', padding: '8px 12px', transition: 'border-color 0.15s', minHeight: 42 }}
                  onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'}
                  onBlurCapture={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  <textarea
                    ref={textareaRef}
                    rows={1} value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    enterKeyHint="send"
                    placeholder={t('chat.inputPlaceholder')}
                    style={{ flex: 1, resize: 'none', background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', lineHeight: 1.5, maxHeight: 120, overflow: 'auto', padding: 0 }}
                  />
                </div>

                <button type="submit" disabled={sending || (!input.trim() && !attachment)} style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: input.trim() || attachment ? 'linear-gradient(135deg,#7C3AED,#5b21b6)' : 'rgba(255,255,255,0.06)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: input.trim() || attachment ? 'pointer' : 'default',
                  boxShadow: input.trim() || attachment ? '0 4px 16px rgba(124,58,237,0.3)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  <TbSend size={17} color={input.trim() || attachment ? 'white' : 'rgba(255,255,255,0.2)'} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}




