import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminCryptoPayments, adminCryptoAction, getSiteSettings, createSiteSetting, updateSiteSetting } from '../../api/admin'
import { formatDate } from '../../utils/formatters'
import { CheckCircle, XCircle, Settings, Copy, Check, X, ExternalLink } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { PageShell, PageHeader, FilterTabs, StatusPill, TH_STYLE, TD_STYLE, T, Pagination } from '../../components/admin/AdminUI'

const WALLET_KEYS = [
  { key: 'BINANCE_ADDRESS', label: 'Binance Address (USDT)', icon: '🟡' },
  { key: 'BNB_ADDRESS',     label: 'BNB Address',            icon: '🔶' },
]

const STATUS_STYLE = {
  pending:    { label: 'Pending',    background: 'rgba(255,200,77,0.12)',  border: '1px solid rgba(255,200,77,0.35)',  color: '#FFC84D' },
  confirming: { label: 'Confirming', background: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.35)',  color: '#3B82F6' },
  confirmed:  { label: 'Confirmed',  background: 'rgba(54,255,192,0.12)',  border: '1px solid rgba(54,255,192,0.35)',  color: '#36FFC0' },
  expired:    { label: 'Expired',    background: 'rgba(255,107,133,0.12)', border: '1px solid rgba(255,107,133,0.35)', color: '#FF6B85' },
  rejected:   { label: 'Rejected',   background: 'rgba(255,107,133,0.12)', border: '1px solid rgba(255,107,133,0.35)', color: '#FF6B85' },
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={copy} title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: copied ? '#1D9E75' : 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function DetailModal({ payment, onClose, onAction }) {
  const [actionLoading, setActionLoading] = useState(null)
  const [rejectNote,    setRejectNote]    = useState('')
  const [txHashInput,   setTxHashInput]   = useState(payment.tx_hash || '')
  const [showReject,    setShowReject]    = useState(false)

  const ss = STATUS_STYLE[payment.status] || STATUS_STYLE.pending
  const canAct = ['pending', 'confirming'].includes(payment.status)
  // Approval must be traceable to an on-chain TX / Binance order
  const hasTxHash = !!(payment.tx_hash || txHashInput.trim())

  const handle = async (action) => {
    setActionLoading(action)
    try {
      await onAction(payment.id, action, action === 'reject' ? rejectNote : '', txHashInput)
      onClose()
    } catch {
      // onAction already toasts the error; keep the modal open for a retry
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid #2a2a3e',
        borderRadius: '1rem', width: '100%', maxWidth: 540,
        padding: '1.75rem', position: 'relative',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', fontSize: '0.875rem' }}>#{payment.id}</span>
            <span style={{ ...ss, padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{ss.label}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* User info */}
        <div style={{ background: '#0d0d18', borderRadius: '0.625rem', padding: '1rem', marginBottom: '1rem' }}>
          <p style={LABEL}>User</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ color: 'var(--white-primary)', fontWeight: 600 }}>{payment.user_username}</span>
              {payment.user_email && <span style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginLeft: '0.5rem' }}>{payment.user_email}</span>}
            </div>
            <span style={{ color: 'var(--aurora)', fontSize: '0.8125rem', fontFamily: 'JetBrains Mono, monospace' }}>
              Balance: {parseFloat(payment.user_balance || 0).toFixed(2)} DT
            </span>
          </div>
        </div>

        {/* Payment details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={DETAIL_BOX}>
            <p style={LABEL}>Amount (DT)</p>
            <p style={VALUE}>{parseFloat(payment.amount_dt).toFixed(2)} DT</p>
          </div>
          <div style={DETAIL_BOX}>
            <p style={LABEL}>Will Credit</p>
            <p style={{ ...VALUE, color: '#1D9E75' }}>{parseFloat(payment.wallet_credit || payment.amount_dt).toFixed(2)} DT</p>
          </div>
          <div style={DETAIL_BOX}>
            <p style={LABEL}>Currency</p>
            <p style={{ ...VALUE, color: '#f0b90b' }}>{payment.currency}</p>
          </div>
          <div style={DETAIL_BOX}>
            <p style={LABEL}>Amount Crypto</p>
            <p style={{ ...VALUE, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem' }}>
              {parseFloat(payment.amount_crypto).toFixed(6)}
            </p>
          </div>
        </div>

        {/* Wallet address */}
        <div style={{ ...DETAIL_BOX, marginBottom: '0.75rem' }}>
          <p style={LABEL}>Wallet Address</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--lavender)', wordBreak: 'break-all' }}>{payment.wallet_address}</span>
            <CopyButton text={payment.wallet_address} />
          </div>
        </div>

        {/* TX Hash / Order ID */}
        <div style={{ ...DETAIL_BOX, marginBottom: '1rem' }}>
          <p style={LABEL}>
            {payment.currency === 'BINANCE' ? 'Binance Order ID' : 'TX Hash (BSC)'}
            {payment.status === 'pending' && <span style={{ color: '#d97706', fontWeight: 400 }}> (not submitted yet)</span>}
          </p>
          {payment.tx_hash ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--aurora)', wordBreak: 'break-all' }}>{payment.tx_hash}</span>
              <CopyButton text={payment.tx_hash} />
              {payment.currency === 'BNB' && payment.tx_hash.startsWith('0x') && (
                <a href={`https://bscscan.com/tx/${payment.tx_hash}`} target="_blank" rel="noopener noreferrer" title="View on BSCScan" style={{ color: 'var(--muted)', display: 'flex' }}>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : canAct ? (
            <input
              value={txHashInput}
              onChange={e => setTxHashInput(e.target.value)}
              placeholder={payment.currency === 'BINANCE' ? 'Paste Binance Order ID (required to approve)' : 'Paste TX hash (required to approve)'}
              style={{ width: '100%', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', background: '#0d0d14', border: `1px solid ${hasTxHash ? '#2a2a3e' : 'rgba(217,119,6,0.5)'}`, color: 'var(--white-primary)', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', boxSizing: 'border-box' }}
            />
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>-</span>
          )}
        </div>

        {/* Expires */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', color: 'var(--muted)', fontSize: '0.8125rem' }}>
          <span>Expires: {formatDate(payment.expires_at)}</span>
          <span>Created: {formatDate(payment.created_at)}</span>
        </div>

        {/* Actions */}
        {canAct && !showReject && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => handle('approve')}
              disabled={!!actionLoading || !hasTxHash}
              title={hasTxHash ? undefined : (payment.currency === 'BINANCE' ? 'Enter the Binance Order ID to approve' : 'Enter the TX hash to approve')}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: 'none', cursor: hasTxHash ? 'pointer' : 'not-allowed', background: 'rgba(29,158,117,0.2)', color: '#1D9E75', fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'background 0.15s', opacity: hasTxHash ? 1 : 0.45 }}
              onMouseEnter={e => { if (hasTxHash) e.currentTarget.style.background = 'rgba(29,158,117,0.35)' }}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(29,158,117,0.2)'}
            >
              {actionLoading === 'approve' ? 'Approving…' : <><CheckCircle size={16} /> Approve & Credit</>}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={!!actionLoading}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
            >
              <XCircle size={16} /> Reject
            </button>
          </div>
        )}

        {canAct && showReject && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Rejection reason (optional)…"
              rows={3}
              style={{ background: '#0d0d14', border: '1px solid #2a2a3e', color: 'var(--white-primary)', borderRadius: '0.5rem', padding: '0.625rem 0.75rem', fontSize: '0.875rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={() => setShowReject(false)} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #2a2a3e', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button
                onClick={() => handle('reject')}
                disabled={!!actionLoading}
                style={{ flex: 2, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {actionLoading === 'reject' ? 'Rejecting…' : <><XCircle size={15} /> Confirm Reject</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WalletSettings() {
  const qc    = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState({})
  const [saving,  setSaving]  = useState(null)

  const { data: settings = [] } = useQuery({
    queryKey: ['site-settings'],
    queryFn:  () => getSiteSettings().then(r => r.data),
    staleTime: 30000,
  })

  const getVal = (key) => {
    const s = settings.find(s => s.key === key)
    return editing[key] !== undefined ? editing[key] : (s?.value || '')
  }

  const save = async (wk) => {
    setSaving(wk.key)
    try {
      const existing = settings.find(s => s.key === wk.key)
      if (existing) {
        await updateSiteSetting(existing.id, { value: editing[wk.key] })
      } else {
        await createSiteSetting({ key: wk.key, value: editing[wk.key], label: wk.label })
      }
      qc.invalidateQueries({ queryKey: ['site-settings'] })
      setEditing(e => { const n = {...e}; delete n[wk.key]; return n })
      toast.success(`${wk.label} saved!`)
    } catch {
      toast.error('Failed to save.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid #1e1e2e', borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
        <Settings size={16} style={{ color: 'var(--magenta)' }} />
        <h3 style={{ margin: 0, color: 'var(--white-primary)', fontSize: '1rem', fontWeight: 700 }}>Wallet Addresses</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {WALLET_KEYS.map(wk => (
          <div key={wk.key} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ width: 28, textAlign: 'center', fontSize: '1.125rem', flexShrink: 0 }}>{wk.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{wk.label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  value={getVal(wk.key)}
                  onChange={e => setEditing(prev => ({ ...prev, [wk.key]: e.target.value }))}
                  placeholder={`Enter ${wk.label}`}
                  style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', background: '#0d0d14', border: '1px solid #1e1e2e', color: 'var(--white-primary)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}
                />
                {getVal(wk.key) && <CopyButton text={getVal(wk.key)} />}
              </div>
            </div>
            {editing[wk.key] !== undefined && (
              <button
                onClick={() => save(wk)}
                disabled={saving === wk.key}
                style={{ padding: '0.5rem 0.875rem', borderRadius: '0.5rem', background: 'var(--magenta)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0 }}
              >
                {saving === wk.key ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CryptoPage() {
  const [statusFilter,  setStatusFilter]  = useState('')
  const [page,          setPage]          = useState(1)
  const [selected,      setSelected]      = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const qc    = useQueryClient()
  const toast = useToast()

  const PAGE_SIZE = 20
  const { data: rawData = {}, isLoading } = useQuery({
    queryKey: ['admin-crypto', statusFilter, page],
    queryFn:  () => getAdminCryptoPayments({ ...(statusFilter ? { status: statusFilter } : {}), page, page_size: PAGE_SIZE }).then(r => r.data),
    refetchInterval: 20000,
  })
  const data       = rawData?.results ?? (Array.isArray(rawData) ? rawData : [])
  const totalPages = Math.ceil((rawData?.count ?? data.length) / PAGE_SIZE)

  const handleAction = async (id, action, note = '', txHash = '') => {
    setActionLoading(id)
    try {
      await adminCryptoAction(id, { action, admin_note: note, tx_hash: txHash })
      qc.invalidateQueries({ queryKey: ['admin-crypto'] })
      qc.invalidateQueries({ queryKey: ['admin-recharges'] })
      toast.success(action === 'approve' ? 'Approved! Balance credited.' : 'Payment rejected.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed.')
      throw err // let the detail modal know the action did not go through
    } finally {
      setActionLoading(null)
    }
  }

  const tabs = [
    { value: '',          label: 'All' },
    { value: 'pending',   label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'expired',   label: 'Expired' },
  ]

  return (
    <PageShell>
      <PageHeader title="Crypto Payments" />

      <WalletSettings />

      <FilterTabs
        tabs={tabs}
        value={statusFilter}
        onChange={v => { setStatusFilter(v); setPage(1) }}
        style={{ marginBottom: '1.25rem' }}
      />

      <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'User', 'Currency', 'Amount DT', 'Will Credit', 'TX Hash', 'Status', 'Expires', 'Actions'].map(h => (
                <th key={h} style={TH_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem' }}>Loading…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem' }}>No crypto payments found.</td></tr>
            ) : data.map(p => {
              const canAct   = ['pending', 'confirming'].includes(p.status)
              const isActing = actionLoading === p.id
              return (
                <tr key={p.id}
                  onClick={() => setSelected(p)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,79,219,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...TD_STYLE, color: T.textMuted }}>#{p.id}</td>
                  <td style={{ ...TD_STYLE, color: T.textPrimary, fontWeight: 500 }}>
                    <span>{p.user_username || p.recharge_request}</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: T.textMuted }}>id:{p.user_id}</span>
                  </td>
                  <td style={{ ...TD_STYLE, color: '#f0b90b', fontFamily: T.mono }}>{p.currency}</td>
                  <td style={{ ...TD_STYLE, color: T.textPrimary, fontWeight: 600, fontFamily: T.mono }}>{parseFloat(p.amount_dt).toFixed(2)} DT</td>
                  <td style={{ ...TD_STYLE, color: T.success, fontWeight: 600, fontFamily: T.mono }}>{parseFloat(p.wallet_credit || p.amount_dt).toFixed(2)} DT</td>
                  <td style={{ ...TD_STYLE, maxWidth: 100 }}>
                    {p.tx_hash ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: T.mono, fontSize: '0.7rem', color: T.info, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
                          {p.tx_hash}
                        </span>
                        <CopyButton text={p.tx_hash} />
                      </div>
                    ) : (
                      <span style={{ color: T.warning, fontSize: '0.75rem' }}>awaiting</span>
                    )}
                  </td>
                  <td style={TD_STYLE}><StatusPill status={p.status} /></td>
                  <td style={{ ...TD_STYLE, color: T.textMuted, fontSize: '0.75rem' }}>{formatDate(p.expires_at)}</td>
                  <td style={TD_STYLE} onClick={e => e.stopPropagation()}>
                    {canAct && (
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button
                          onClick={() => p.tx_hash ? handleAction(p.id, 'approve') : setSelected(p)}
                          disabled={isActing}
                          title={p.tx_hash ? 'Approve & credit balance' : 'TX hash required - open details to enter it'}
                          style={{ background: T.successDim, border: `1px solid ${T.successBorder}`, color: T.success, borderRadius: '0.375rem', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}
                        >
                          <CheckCircle size={12} /> {isActing ? '…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => setSelected(p)}
                          title="Review details"
                          style={{ background: T.dangerDim, border: `1px solid ${T.dangerBorder}`, color: T.danger, borderRadius: '0.375rem', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); window.scrollTo(0, 0) }} />
      </div>

      {selected && (
        <DetailModal
          payment={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}
    </PageShell>
  )
}
const LABEL = { margin: '0 0 4px', color: 'var(--muted)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }
const VALUE = { margin: 0, color: 'var(--white-primary)', fontWeight: 600, fontSize: '1rem' }
const DETAIL_BOX = { background: '#0d0d18', borderRadius: '0.5rem', padding: '0.75rem' }
