import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAdminConversations,
  getAdminMessages,
  sendAdminMessage,
  markAdminMessagesRead,
} from '../api/chat'
import { useWebSocket } from '../hooks/useWebSocket'
import useAuthStore from '../store/authStore'
import { formatDate } from '../utils/formatters'
import { Send, Paperclip, MessageCircle, User, X, Search } from 'lucide-react'

// --- Small helpers ----------------------------------------------------------
function Avatar({ name, size = 36 }) {
  const initials = (name || '?').slice(0, 2).toUpperCase()
  const colors   = ['#7F77DD', '#5048c0', '#1D9E75', '#e05252', '#d97706']
  const bg       = colors[name?.charCodeAt(0) % colors.length] || colors[0]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, color: 'var(--text-primary)', fontSize: size * 0.36, flexShrink: 0,
    }}>{initials}</div>
  )
}

// --- Conversation list item -------------------------------------------------
function ConvItem({ conv, active, onClick, liveUnread }) {
  const client      = conv.client_detail
  const name        = client?.first_name
    ? `${client.first_name} ${client.last_name || ''}`.trim()
    : client?.username || 'Unknown'
  const lastMsg     = conv.last_message?.body || '-'
  const unread      = (liveUnread ?? conv.unread_count) || 0

  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      width: '100%', padding: '0.75rem 1rem', border: 'none', textAlign: 'left',
      cursor: 'pointer', background: active ? 'rgba(127,119,221,0.13)' : 'transparent',
      borderLeft: active ? '3px solid #7F77DD' : '3px solid transparent',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Avatar name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#F0EEE6', fontWeight: unread ? 700 : 500, fontSize: '0.875rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
            {name}
          </span>
          {unread > 0 && (
            <span style={{
              background: '#7F77DD', color: 'var(--text-primary)', borderRadius: '999px',
              fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px', minWidth: '18px', textAlign: 'center',
            }}>{unread > 99 ? '99+' : unread}</span>
          )}
        </div>
        <p style={{ margin: 0, color: '#5C5A54', fontSize: '0.75rem',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lastMsg}
        </p>
      </div>
    </button>
  )
}

// --- Main page --------------------------------------------------------------
export default function AdminInboxPage() {
  const { user }      = useAuthStore()
  const queryClient   = useQueryClient()
  const [selectedId, setSelectedId]     = useState(null)   // active conversation id
  const [messages, setMessages]         = useState([])
  const [input, setInput]               = useState('')
  const [attachment, setAttachment]     = useState(null)
  const [sending, setSending]           = useState(false)
  const [search, setSearch]             = useState('')
  // live unread counters for conversations not currently open
  const [liveUnreads, setLiveUnreads]   = useState({})     // { [convId]: number }
  const bottomRef = useRef(null)
  const fileRef   = useRef(null)

  // -- Conversation list ----------------------------------------------------
  const { data: conversations = [], refetch: refetchConvs } = useQuery({
    queryKey:        ['admin-conversations'],
    queryFn:         () => getAdminConversations().then(r => r.data),
    refetchInterval: 15000,   // passive refresh every 15s for new conversations
  })

  const filtered = conversations.filter(c => {
    if (!search) return true
    const name = (c.client_detail?.username || '') + ' ' +
                 (c.client_detail?.first_name || '') + ' ' +
                 (c.client_detail?.last_name  || '')
    return name.toLowerCase().includes(search.toLowerCase())
  })

  // -- Load messages when conversation selected -----------------------------
  useEffect(() => {
    if (!selectedId) return
    setMessages([])
    getAdminMessages(selectedId).then(r => {
      const data = r.data?.results || r.data || []
      setMessages(Array.isArray(data) ? data : [])
    })
    markAdminMessagesRead(selectedId).catch(() => {})
    // Clear live unread for this conv
    setLiveUnreads(prev => ({ ...prev, [selectedId]: 0 }))
  }, [selectedId])

  // -- Auto-scroll ----------------------------------------------------------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // -- WebSocket: real-time messages for the open conversation --------------
  const onWsMessage = useCallback((msg) => {
    setMessages(prev => {
      if (prev.find(m => m.id === msg.id)) return prev
      return [...prev, {
        id:            msg.id,
        body:          msg.body,
        sender:        msg.sender_id,
        sender_detail: { id: msg.sender_id, username: msg.sender_name },
        attachment:    msg.attachment_url,
        created_at:    msg.created_at,
        is_read:       msg.is_read,
      }]
    })
    // Update last_message preview in conversation list
    queryClient.setQueryData(['admin-conversations'], (old = []) =>
      old.map(c => c.id === msg.conversation_id || c.id === selectedId
        ? { ...c, last_message: { body: msg.body, created_at: msg.created_at }, last_message_at: msg.created_at }
        : c
      )
    )
  }, [selectedId, queryClient])

  const { sendMessage: wsSend } = useWebSocket(selectedId, onWsMessage)

  // -- Send message ---------------------------------------------------------
  const handleSend = async (e) => {
    e.preventDefault()
    if ((!input.trim() && !attachment) || !selectedId) return
    setSending(true)
    try {
      if (attachment) {
        // Attachment > REST
        const fd = new FormData()
        fd.append('body', input.trim())
        fd.append('attachment', attachment)
        fd.append('conversation_id', selectedId)
        const { data: msg } = await sendAdminMessage(fd)
        setMessages(prev => [...prev, msg])
        setInput(''); setAttachment(null)
      } else {
        // Text > WebSocket (consumer saves + broadcasts to client in real-time)
        const body  = input.trim()
        const tempId = `temp-${Date.now()}`
        setMessages(prev => [...prev, {
          id: tempId, body,
          sender: user?.id,
          sender_detail: { id: user?.id, username: user?.username },
          attachment: null, created_at: new Date().toISOString(), is_read: false,
        }])
        setInput('')
        const sent = wsSend({ body })
        if (!sent) {
          // WS unavailable > fallback to REST
          const fd = new FormData()
          fd.append('body', body)
          fd.append('conversation_id', selectedId)
          const { data: msg } = await sendAdminMessage(fd)
          setMessages(prev => prev.map(m => m.id === tempId ? msg : m))
        }
      }
    } catch {}
    setSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
  }

  // -- Derive selected conversation details ---------------------------------
  const selectedConv = conversations.find(c => c.id === selectedId)
  const clientName   = selectedConv
    ? (selectedConv.client_detail?.first_name
        ? `${selectedConv.client_detail.first_name} ${selectedConv.client_detail.last_name || ''}`.trim()
        : selectedConv.client_detail?.username || 'Unknown')
    : null

  // -- Render ---------------------------------------------------------------
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d0d14' }}>

      {/* -- Left panel: conversation list ------------------------------- */}
      <div style={{
        width: '300px', minWidth: '300px', borderRight: '1px solid #1e1e2e',
        display: 'flex', flexDirection: 'column', background: '#13131a',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1rem 0.75rem', borderBottom: '1px solid #1e1e2e' }}>
          <p style={{ margin: '0 0 0.75rem', color: '#F0EEE6', fontWeight: 700, fontSize: '1rem' }}>
            Customer Inbox
          </p>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#5C5A54', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..."
              style={{ width: '100%', paddingLeft: '2rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', fontSize: '0.8125rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#5C5A54', padding: '2rem 1rem', fontSize: '0.8125rem' }}>
              No conversations yet.
            </div>
          ) : (
            filtered.map(conv => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === selectedId}
                liveUnread={liveUnreads[conv.id]}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* -- Right panel: chat -------------------------------------------- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedId && selectedConv ? (
          <>
            {/* Chat header */}
            <div style={{
              padding: '0.875rem 1.5rem', borderBottom: '1px solid #1e1e2e',
              display: 'flex', alignItems: 'center', gap: '0.875rem',
              background: '#13131a', flexShrink: 0,
            }}>
              <Avatar name={clientName} size={38} />
              <div>
                <p style={{ margin: 0, color: '#F0EEE6', fontWeight: 600, fontSize: '0.9375rem' }}>{clientName}</p>
                <p style={{ margin: 0, color: '#5C5A54', fontSize: '0.75rem' }}>
                  {selectedConv.client_detail?.email || ''}
                </p>
              </div>
              <span style={{
                marginLeft: 'auto', padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600,
                background: selectedConv.status === 'open' ? 'rgba(29,158,117,0.15)' : 'rgba(92,90,84,0.2)',
                color: selectedConv.status === 'open' ? '#1D9E75' : '#5C5A54',
              }}>
                {selectedConv.status === 'open' ? 'Open' : 'Resolved'}
              </span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem', padding: '1rem 1.5rem 0.5rem' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#5C5A54', marginTop: '4rem' }}>
                  <MessageCircle size={44} style={{ marginBottom: '1rem', opacity: 0.1 }} />
                  <p style={{ fontSize: '0.875rem' }}>No messages yet.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn  = msg.sender === user?.id || msg.sender_detail?.id === user?.id
                  const isTemp = typeof msg.id === 'string' && msg.id.startsWith('temp-')
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                      {!isOwn && (
                        <span style={{ color: '#5C5A54', fontSize: '0.6875rem', marginBottom: '3px' }}>
                          {msg.sender_detail?.username || clientName}
                        </span>
                      )}
                      <div style={{
                        maxWidth: '65%', padding: '0.625rem 0.875rem',
                        borderRadius: isOwn ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                        background: isOwn ? '#7F77DD' : '#1a1a24',
                        border: isOwn ? 'none' : '1px solid #1e1e2e',
                        opacity: isTemp ? 0.6 : 1, transition: 'opacity 0.2s',
                      }}>
                        {msg.attachment && (
                          <img src={typeof msg.attachment === 'string' ? msg.attachment : URL.createObjectURL(msg.attachment)}
                            alt="" style={{ maxWidth: '100%', borderRadius: '0.5rem', marginBottom: msg.body ? '0.5rem' : 0 }} />
                        )}
                        {msg.body && (
                          <p style={{ margin: 0, color: isOwn ? 'white' : '#F0EEE6', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                            {msg.body}
                          </p>
                        )}
                      </div>
                      <span style={{ color: '#5C5A54', fontSize: '0.6875rem', marginTop: '3px' }}>
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} style={{ padding: '0.875rem 1.5rem 1.25rem', borderTop: '1px solid #1e1e2e', flexShrink: 0 }}>
              {attachment && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: '#1a1a24', border: '1px solid #1e1e2e', borderRadius: '0.5rem' }}>
                  <span style={{ color: '#9E9C94', fontSize: '0.8125rem', flex: 1 }}>{attachment.name}</span>
                  <button type="button" onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E9C94' }}>
                    <X size={14} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={e => setAttachment(e.target.files[0])} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  style={{ background: '#1a1a24', border: '1px solid #1e1e2e', borderRadius: '0.5rem', padding: '0.625rem', cursor: 'pointer', color: '#9E9C94', flexShrink: 0 }}>
                  <Paperclip size={18} />
                </button>
                <textarea
                  rows={1} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Reply to ${clientName}...`}
                  style={{ resize: 'none', flex: 1, minHeight: '42px', maxHeight: '120px' }}
                />
                <button type="submit" disabled={sending || (!input.trim() && !attachment)}
                  className="btn-primary" style={{ padding: '0.625rem 1rem', flexShrink: 0 }}>
                  <Send size={16} />
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#5C5A54' }}>
            <MessageCircle size={56} style={{ marginBottom: '1rem', opacity: 0.08 }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#9E9C94' }}>Select a conversation</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>Choose a customer from the left to start replying.</p>
          </div>
        )}
      </div>
    </div>
  )
}

