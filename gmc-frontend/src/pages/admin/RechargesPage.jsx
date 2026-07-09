import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminRecharges, approveAdminRecharge, rejectAdminRecharge } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate, mediaUrl } from '../../utils/formatters'
import { CheckCircle, XCircle, Image } from 'lucide-react'
import { PageShell, PageHeader, FilterTabs, StatusPill, T } from '../../components/admin/AdminUI'

const METHOD_META = {
  ooredoo_ticket: { label: 'Ooredoo Ticket',    color: '#e53e3e', type: 'ticket'   },
  orange_ticket:  { label: 'Orange Ticket',     color: '#f97316', type: 'ticket'   },
  d17_number:     { label: 'D17 – Phone',       color: '#7C3AED', type: 'transfer' },
  d17_address:    { label: 'D17 – Address',     color: '#7C3AED', type: 'transfer' },
  bank_transfer:  { label: 'Bancaire',          color: '#3b82f6', type: 'transfer' },
  edinar:         { label: 'E-Dinar',           color: '#10b981', type: 'transfer' },
  flouci:         { label: 'Flouci',            color: '#f59e0b', type: 'transfer' },
  // Legacy
  d17:             { label: 'D17 (legacy)',        color: '#7C3AED', type: 'legacy' },
  baridimob:       { label: 'BaridiMob',            color: '#22c55e', type: 'legacy' },
  dahabia:         { label: 'Dahabia / E-DINAR',    color: '#3b82f6', type: 'legacy' },
  bank:            { label: 'Bank Transfer (old)',   color: '#0ea5e9', type: 'legacy' },
  cash:            { label: 'Cash',                  color: '#f59e0b', type: 'legacy' },
  tunisie_telecom: { label: 'Tunisie Telecom',       color: '#3b82f6', type: 'legacy' },
}

function MethodBadge({ method }) {
  const meta = METHOD_META[method] || { label: method, color: '#6B6B8A' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 5,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700,
      background: meta.color + '18', color: meta.color, border: '1px solid ' + meta.color + '35',
    }}>{meta.label}</span>
  )
}

function CreditBreakdown({ r }) {
  const isTicket = r.method === 'ooredoo_ticket' || r.method === 'orange_ticket'
  const isD17    = r.method === 'd17_number' || r.method === 'd17_address'

  if (isTicket && r.ticket_items?.length) {
    const pct = Math.round(parseFloat(r.tax_rate) * 100)
    const totalValue = r.ticket_items.reduce((s, it) => s + parseFloat(it.value), 0)
    const count = r.ticket_items.length
    return (
      <div>
        <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {count > 1 && <span>{count} tickets · </span>}
          {totalValue.toFixed(2)} DT <span style={{ color: '#ff4d6d' }}>–{pct}%</span>
        </p>
        <p style={{ margin: '2px 0 0', fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: '#3DDC84' }}>
          {parseFloat(r.wallet_credit).toFixed(2)} DT
        </p>
      </div>
    )
  }
  if (isTicket && r.ticket_value) {
    const pct = Math.round(parseFloat(r.tax_rate) * 100)
    return (
      <div>
        <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {parseFloat(r.ticket_value).toFixed(2)} DT <span style={{ color: '#ff4d6d' }}>–{pct}%</span>
        </p>
        <p style={{ margin: '2px 0 0', fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: '#3DDC84' }}>
          {parseFloat(r.wallet_credit).toFixed(2)} DT
        </p>
      </div>
    )
  }
  if (isD17 && r.amount_sent) {
    return (
      <div>
        <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {parseFloat(r.amount_sent).toFixed(2)} DT{' '}
          {parseFloat(r.tax_rate) > 0
            ? <span style={{ color: '#ff4d6d' }}>–{Math.round(parseFloat(r.tax_rate) * 100)}%</span>
            : <span style={{ color: '#3DDC84' }}>no fee</span>}
        </p>
        <p style={{ margin: '2px 0 0', fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: '#3DDC84' }}>
          {parseFloat(r.wallet_credit).toFixed(2)} DT
        </p>
        {r.reference_code && (
          <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--accent)' }}>
            Ref: <span style={{ fontWeight: 700 }}>{r.reference_code}</span>
          </p>
        )}
      </div>
    )
  }
  // Legacy / unknown
  return (
    <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: '#3DDC84' }}>
      {parseFloat(r.wallet_credit || 0).toFixed(2)} DT
    </p>
  )
}

function TicketInfo({ r }) {
  if (r.ticket_items?.length) {
    return (
      <div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Ticket Code{r.ticket_items.length > 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {r.ticket_items.map(it => (
            <p key={it.id} style={{ margin: 0, color: 'var(--success)', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'JetBrains Mono, monospace' }}>
              {it.code} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— {parseFloat(it.value).toFixed(2)} DT</span>
            </p>
          ))}
        </div>
      </div>
    )
  }
  if (!r.ticket_code) return null
  return (
    <div>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ticket Code</p>
      <p style={{ margin: 0, color: 'var(--success)', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'JetBrains Mono, monospace' }}>{r.ticket_code}</p>
    </div>
  )
}

function ProofImage({ src }) {
  const [open, setOpen] = useState(false)
  const url = src?.startsWith('http') ? src : mediaUrl(src)
  if (!src) return <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>No proof</span>
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '0.375rem', padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Image size={12} /> View Proof
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={url} alt="Payment proof" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '0.75rem', objectFit: 'contain' }} />
        </div>
      )}
    </>
  )
}

export default function RechargesPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [tab,     setTab]     = useState('pending')
  const [noteMap, setNoteMap] = useState({})
  const [loading, setLoading] = useState({})

  const { data } = useQuery({
    queryKey: ['admin-recharges', tab],
    queryFn:  () => getAdminRecharges({ status: tab }).then(r => r.data),
    refetchInterval: tab === 'pending' ? 15000 : false,
  })
  const recharges = data?.results || data || []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-recharges'] })
    qc.invalidateQueries({ queryKey: ['admin-stats'] })
  }

  const handleApprove = async (id) => {
    setLoading(l => ({ ...l, [id]: true }))
    try {
      await approveAdminRecharge(id, { admin_note: noteMap[id] || '' })
      toast.success('Recharge approved ✓ – balance credited.')
      invalidate()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approval failed.')
    }
    setLoading(l => ({ ...l, [id]: false }))
  }

  const handleReject = async (id) => {
    const note = (noteMap[id] || '').trim()
    if (!note) { toast.error('Admin note is required when rejecting.'); return }
    setLoading(l => ({ ...l, [id]: true }))
    try {
      await rejectAdminRecharge(id, { admin_note: note })
      toast.success('Recharge rejected.')
      invalidate()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Rejection failed.')
    }
    setLoading(l => ({ ...l, [id]: false }))
  }

  const tabs = [
    { value: 'pending',  label: 'Pending',  color: '#d97706' },
    { value: 'approved', label: 'Approved', color: '#1D9E75' },
    { value: 'rejected', label: 'Rejected', color: '#ef4444' },
  ]

  return (
    <PageShell>
      <PageHeader title="Recharge Requests" />

      <FilterTabs
        tabs={tabs}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: '1.5rem' }}
      />

      {recharges.length === 0 ? (
        <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', padding: '3rem', textAlign: 'center', color: T.textMuted, fontSize: '0.875rem' }}>
          No {tab} recharges.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {recharges.map(r => (
            <div key={r.id} style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', padding: '1.25rem 1.5rem' }}>
              <div className="admin-recharge-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                    <div style={{ background: 'linear-gradient(135deg,#6D28D9,#9B4FED)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: '0.8125rem', flexShrink: 0 }}>
                      {(r.user_username || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, color: T.textPrimary, fontWeight: 600, fontSize: '0.9375rem' }}>{r.user_username}</p>
                      <p style={{ margin: 0, color: T.textMuted, fontSize: '0.75rem' }}>{formatDate(r.created_at)}</p>
                    </div>
                    <MethodBadge method={r.method} />
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, color: T.textMuted, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credit</p>
                      <CreditBreakdown r={r} />
                    </div>
                    <TicketInfo r={r} />
                    {r.reviewed_by_username && (
                      <div>
                        <p style={{ margin: 0, color: T.textMuted, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reviewed by</p>
                        <p style={{ margin: 0, color: T.textSub, fontWeight: 600, fontSize: '0.875rem' }}>{r.reviewed_by_username}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-recharge-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <ProofImage src={r.proof} />

                  {tab === 'pending' && (
                    <>
                      <input
                        value={noteMap[r.id] || ''}
                        onChange={e => setNoteMap(m => ({ ...m, [r.id]: e.target.value }))}
                        placeholder="Admin note (required to reject)…"
                        style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem', width: '100%', minWidth: 0, boxSizing: 'border-box', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, color: T.textPrimary, outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleReject(r.id)} disabled={loading[r.id]}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', border: `1px solid ${T.dangerBorder}`, background: T.dangerDim, color: T.danger, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                          <XCircle size={15} /> Reject
                        </button>
                        <button onClick={() => handleApprove(r.id)} disabled={loading[r.id]}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', border: 'none', background: T.success, color: '#001A0F', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700 }}>
                          <CheckCircle size={15} /> {loading[r.id] ? '…' : 'Approve'}
                        </button>
                      </div>
                    </>
                  )}

                  {tab !== 'pending' && r.admin_note && (
                    <div style={{ background: 'rgba(139,79,219,0.06)', border: `1px solid ${T.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', maxWidth: '280px' }}>
                      <p style={{ margin: 0, color: T.textSub, fontSize: '0.8125rem' }}><em>{r.admin_note}</em></p>
                    </div>
                  )}

                  {tab !== 'pending' && <StatusPill status={tab} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}



