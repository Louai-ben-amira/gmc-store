import { useState, useRef, useEffect } from 'react'
import { TbSend, TbPaperclip, TbX, TbRefresh, TbMessageCircle } from 'react-icons/tb'
import { useToast } from '../hooks/useToast'
import { formatDate, mediaUrl } from '../utils/formatters'

/**
 * Shared message-thread UI for order tickets and support tickets.
 *
 * Props:
 *  - ticket:        the ticket object (status, subject, ...)
 *  - messages:       array of message objects {id, body, attachment, sender_role, sender_username, created_at}
 *  - onSendMessage:  async ({ body, attachment }) => void
 *  - onRefresh:      () => void  (manual refetch trigger)
 *  - isAdmin:        bool - whether the current viewer is an admin (styles "own" bubble accordingly)
 *  - isRefreshing:   bool - shows a spin state on the refresh button
 */
export default function TicketThread({ ticket, messages = [], onSendMessage, onRefresh, isAdmin = false, isRefreshing = false }) {
  const toast = useToast()
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [sending, setSending] = useState(false)
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'auto' }) }, [messages.length])

  const isClosed = ticket && ['resolved', 'closed'].includes(ticket.status)

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() && !attachment) return
    setSending(true)
    try {
      await onSendMessage({ body: input.trim(), attachment })
      setInput('')
      setAttachment(null)
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.body?.[0] || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.125rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
            {ticket?.subject || 'Ticket'}
          </p>
          <p style={{ margin: '2px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            #{ticket?.id} · {(ticket?.status || '').replace('_', ' ').toUpperCase()}
          </p>
        </div>
        <button onClick={onRefresh} title="Refresh" style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)',
          cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem',
        }}>
          <TbRefresh size={13} style={{ animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '1rem 1.125rem' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', padding: '2rem' }}>
            <TbMessageCircle size={36} style={{ opacity: 0.15, marginBottom: 10 }} />
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No messages yet.</p>
          </div>
        ) : messages.map(msg => {
          // Style by sender_role, not "me vs them": admin messages vs client messages.
          const isFromAdmin = msg.sender_role === 'admin'
          const isOwn = isAdmin ? isFromAdmin : !isFromAdmin
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
              {!isOwn && (
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 3, marginLeft: 2 }}>
                  {isFromAdmin ? 'Support' : (msg.sender_username || 'Client')}
                </span>
              )}
              <div style={{
                maxWidth: '75%', padding: '9px 13px',
                borderRadius: isOwn ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                background: isOwn ? 'linear-gradient(135deg,#7C3AED,#5b21b6)' : '#1a1a28',
                border: isOwn ? 'none' : '1px solid var(--border)',
              }}>
                {msg.attachment && (
                  <img src={mediaUrl(msg.attachment)} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.body ? 6 : 0 }} />
                )}
                {msg.body && (
                  <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{msg.body}</p>
                )}
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 3 }}>{formatDate(msg.created_at)}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '0.75rem 1.125rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {attachment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 10px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8 }}>
            <TbPaperclip size={13} color="#A78BFA" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><TbX size={13} /></button>
          </div>
        )}
        {isClosed ? (
          <div style={{ textAlign: 'center', padding: 10, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              This ticket is {ticket.status} - no further replies possible.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={e => setAttachment(e.target.files[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)',
            }}>
              <TbPaperclip size={16} />
            </button>
            <textarea
              rows={1} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              style={{ flex: 1, resize: 'none', minHeight: 38, maxHeight: 100, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', padding: '8px 12px' }}
            />
            <button type="submit" disabled={sending || (!input.trim() && !attachment)} style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: input.trim() || attachment ? 'linear-gradient(135deg,#7C3AED,#5b21b6)' : 'rgba(255,255,255,0.06)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() || attachment ? 'pointer' : 'default',
            }}>
              <TbSend size={16} color={input.trim() || attachment ? 'white' : 'rgba(255,255,255,0.2)'} />
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
