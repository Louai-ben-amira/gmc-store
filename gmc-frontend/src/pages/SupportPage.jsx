import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  createSupportTicket, getOrderTickets, getSupportTickets,
} from '../api/tickets'
import Topbar from '../components/Topbar'
import { useToast } from '../hooks/useToast'
import { formatDate } from '../utils/formatters'
import {
  TbPlus, TbPackage, TbTool, TbX,
} from 'react-icons/tb'

const CATEGORIES = [
  { value: 'account', label: 'Account Issue' },
  { value: 'payment', label: 'Payment Problem' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'refund', label: 'Refund Request' },
  { value: 'other', label: 'Other' },
]

function TicketStatusBadge({ status }) {
  const cfg = {
    open: { label: 'Open', color: '#f59e0b' },
    in_progress: { label: 'In Progress', color: '#38BDF8' },
    resolved: { label: 'Resolved', color: '#3DDC84' },
    closed: { label: 'Closed', color: 'var(--text-muted)' },
  }[status] || { label: status, color: 'var(--text-muted)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.color + '18', border: `1px solid ${cfg.color}40`, borderRadius: 7,
      padding: '2px 9px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: cfg.color,
    }}>
      {cfg.label.toUpperCase()}
    </span>
  )
}

function NewTicketForm({ onClose, onCreated }) {
  const toast = useToast()
  const [category, setCategory] = useState('account')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (description.trim().length < 20) {
      toast.error('Description must be at least 20 characters.')
      return
    }
    if (!subject.trim()) { toast.error('Please enter a subject.'); return }
    setLoading(true)
    try {
      const { data } = await createSupportTicket({ category, subject: subject.trim(), description: description.trim(), attachment })
      toast.success('Ticket created!')
      onCreated(data)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not create ticket.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>New Support Ticket</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><TbX size={18} /></button>
        </div>

        <label style={{ display: 'block', marginBottom: 5, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', marginBottom: 14, height: 38 }}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <label style={{ display: 'block', marginBottom: 5, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary" style={{ width: '100%', marginBottom: 14, height: 38 }} />

        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          <span>Description</span>
          <span style={{ color: description.trim().length >= 20 ? '#3DDC84' : 'var(--text-muted)' }}>{description.trim().length}/20 min</span>
        </label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Describe the issue in detail…" style={{ width: '100%', marginBottom: 14, resize: 'vertical' }} />

        <label style={{ display: 'block', marginBottom: 5, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Screenshot (optional)</label>
        <input type="file" accept="image/*" onChange={e => setAttachment(e.target.files[0])} style={{ width: '100%', marginBottom: 18, fontSize: '0.8125rem' }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function SupportPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('order') // 'order' | 'support'
  const [showForm, setShowForm] = useState(false)

  const { data: orderTicketsData, isLoading: loadingOrder } = useQuery({
    queryKey: ['order-tickets'],
    queryFn: () => getOrderTickets().then(r => r.data?.results || r.data || []),
  })
  const { data: supportTicketsData, isLoading: loadingSupport } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => getSupportTickets().then(r => r.data?.results || r.data || []),
  })

  const orderTickets = orderTicketsData || []
  const supportTickets = supportTicketsData || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />
      <div className="pb-nav" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Support</h1>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <TbPlus size={15} /> New Support Ticket
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
            {[
              { key: 'order', label: '📦 Order Tickets', count: orderTickets.length },
              { key: 'support', label: '🛠️ Support Tickets', count: supportTickets.length },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 9,
                background: tab === t.key ? 'rgba(124,58,237,0.18)' : 'transparent',
                border: tab === t.key ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
                fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? '#A78BFA' : 'var(--text-muted)',
              }}>
                {t.label} {t.count > 0 && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>({t.count})</span>}
              </button>
            ))}
          </div>

          {/* Lists */}
          {tab === 'order' ? (
            loadingOrder ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            : orderTickets.length === 0 ? (
              <EmptyState />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orderTickets.map(t => (
                  <div key={t.id} onClick={() => navigate(`/support/order/${t.id}`)} style={rowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <TbPackage size={15} color="#A78BFA" />
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Order #{t.order} - {t.product_name || 'Product'}</span>
                      <TicketStatusBadge status={t.status} />
                    </div>
                    {t.last_message?.body && (
                      <p style={{ margin: '0 0 6px', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last_message.body}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{formatDate(t.created_at)}</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>View Ticket →</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            loadingSupport ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            : supportTickets.length === 0 ? (
              <EmptyState />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {supportTickets.map(t => (
                  <div key={t.id} onClick={() => navigate(`/support/general/${t.id}`)} style={rowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <TbTool size={15} color="#A78BFA" />
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t.subject}</span>
                      <TicketStatusBadge status={t.status} />
                    </div>
                    <p style={{ margin: '0 0 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {CATEGORIES.find(c => c.value === t.category)?.label || t.category}
                    </p>
                    {t.last_message?.body && (
                      <p style={{ margin: '0 0 6px', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last_message.body}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{formatDate(t.created_at)}</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>View Ticket →</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {showForm && (
        <NewTicketForm
          onClose={() => setShowForm(false)}
          onCreated={(ticket) => { setShowForm(false); navigate(`/support/general/${ticket.id}`) }}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', margin: 0 }}>No tickets yet. Need help? Open a support ticket.</p>
    </div>
  )
}

const rowStyle = {
  background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14,
  padding: '0.875rem 1.125rem', cursor: 'pointer',
}
