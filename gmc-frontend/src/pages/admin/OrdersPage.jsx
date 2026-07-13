import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminOrders, getOrderCredentials, updateServiceStatus, adminCancelOrder, markAdminOrdersSeen } from '../../api/admin'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { Eye, EyeOff, MessageCircle, Ban, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../hooks/useToast'
import { PageShell, PageHeader, FilterTabs, DataTable, StatusPill, Pagination, TH_STYLE, TD_STYLE, T } from '../../components/admin/AdminUI'

const SERVICE_STATUS_CONFIG = {
  pending:     { label: '⏳ Pending',     color: '#FFB800' },
  in_progress: { label: '🔄 In Progress', color: '#38BDF8' },
  completed:   { label: '✅ Completed',   color: '#22C55E' },
}

function CredentialCard({ orderId }) {
  const [revealed, setRevealed] = useState(false)
  const [creds, setCreds]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const toast = useToast()

  const handleReveal = async () => {
    if (creds) { setRevealed(r => !r); return }
    setLoading(true)
    try {
      const { data } = await getOrderCredentials(orderId)
      setCreds(data)
      setRevealed(true)
    } catch {
      toast.error('Could not load credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button
        onClick={handleReveal}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.3)',
          color: '#FFB800', borderRadius: '0.375rem', padding: '4px 10px',
          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
        }}
      >
        {loading ? '…' : revealed ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> View Credentials</>}
      </button>

      {revealed && creds?.data && (
        <div style={{
          marginTop: '0.5rem', background: '#0d0d14', border: '1px solid rgba(255,184,0,0.2)',
          borderRadius: '0.5rem', padding: '0.75rem',
        }}>
          {Object.entries(creds.data).map(([key, val]) => val && (
            <div key={key} style={{ display: 'flex', gap: '0.5rem', marginBottom: '4px' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 80 }}>{key}:</span>
              <span style={{ color: '#FFB800', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{String(val)}</span>
            </div>
          ))}
          {creds.access_log?.length > 0 && (
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '0.6875rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
              Accessed {creds.access_log.length} time(s). Last: {formatDate(creds.access_log[creds.access_log.length - 1]?.accessed_at)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ServiceStatusControl({ order, onUpdated }) {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const advance = async () => {
    const next = order.service_status === 'pending' ? 'in_progress'
               : order.service_status === 'in_progress' ? 'completed' : null
    if (!next) return
    setLoading(true)
    try {
      await updateServiceStatus(order.id, { service_status: next })
      onUpdated()
      toast.success(`Status → ${SERVICE_STATUS_CONFIG[next].label}`)
    } catch {
      toast.error('Failed to update status.')
    } finally {
      setLoading(false)
    }
  }

  const ssc = SERVICE_STATUS_CONFIG[order.service_status] || SERVICE_STATUS_CONFIG.pending
  const nextLabel = order.service_status === 'pending'     ? 'Mark In Progress'
                  : order.service_status === 'in_progress' ? 'Mark Complete'    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: ssc.color }}>{ssc.label}</span>
      {nextLabel && (
        <button
          onClick={advance}
          disabled={loading}
          style={{
            background: 'rgba(232,37,120,0.12)', border: '1px solid rgba(232,37,120,0.3)',
            color: '#e82578', borderRadius: '0.375rem', padding: '3px 8px',
            cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
          }}
        >
          {loading ? '…' : nextLabel}
        </button>
      )}
    </div>
  )
}

function AdminCancelButton({ order, onDone }) {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handle = async () => {
    if (!window.confirm(`Cancel order #${order.id} and refund ${order.user_username}?`)) return
    setLoading(true)
    try {
      await adminCancelOrder(order.id)
      toast.success(`Order #${order.id} cancelled. Balance refunded.`)
      onDone()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not cancel.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); handle() }}
      disabled={loading}
      title="Cancel & Refund"
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        color: '#f87171', borderRadius: '0.375rem', padding: '4px 8px',
        cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
      }}
    >
      <Ban size={11} /> {loading ? '…' : 'Cancel'}
    </button>
  )
}

/* ── Group multi-quantity purchases (same batch_id) into one row ───────── */
function groupOrders(orders) {
  const groups = []
  const indexByBatch = new Map()
  for (const order of orders) {
    if (order.batch_id) {
      if (indexByBatch.has(order.batch_id)) {
        groups[indexByBatch.get(order.batch_id)].orders.push(order)
      } else {
        indexByBatch.set(order.batch_id, groups.length)
        groups.push({ isGroup: true, batch_id: order.batch_id, orders: [order] })
      }
    } else {
      groups.push({ isGroup: false, order })
    }
  }
  return groups
}

export default function OrdersPage() {
  const [page,         setPage]       = useState(1)
  const [status,       setStatus]     = useState('')
  const [reqAcc,       setReqAcc]     = useState(false)
  const [expandedId,   setExpandedId] = useState(null)
  const [openBatches,  setOpenBatches] = useState(() => new Set())
  const [search,       setSearch]     = useState('')
  const [searchInput,  setSearchInput] = useState('')

  // Debounce: apply the typed value 350ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])
  const qc       = useQueryClient()
  const navigate = useNavigate()

  // Opening this page marks all orders as seen and clears the sidebar badge
  useEffect(() => {
    markAdminOrdersSeen()
      .then(() => qc.invalidateQueries({ queryKey: ['admin-badge-counts'] }))
      .catch(() => {})
  }, [qc])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', page, status, reqAcc, search],
    queryFn:  () => getAdminOrders({
      page,
      status:           status || undefined,
      requires_account: reqAcc || undefined,
      search:           search || undefined,
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const orders     = data?.results || []
  const totalPages = data ? Math.ceil(data.count / 12) : 1

  const tabs = [
    { label: 'All',       value: '' },
    { label: 'Completed', value: 'completed' },
    { label: 'Pending',   value: 'pending' },
    { label: 'Failed',    value: 'failed' },
  ]

  return (
    <PageShell>
      <PageHeader title="Orders" />

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <FilterTabs
          tabs={tabs}
          value={status}
          onChange={v => { setStatus(v); setPage(1) }}
        />

        <button
          onClick={() => { setReqAcc(r => !r); setPage(1) }}
          style={{
            padding: '0.375rem 0.875rem', borderRadius: '0.625rem',
            background: reqAcc ? T.warningDim : T.bgPanel,
            border: `1px solid ${reqAcc ? T.warningBorder : T.border}`,
            color: reqAcc ? T.warning : T.purpleText,
            cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
          }}
        >
          🔑 Account Required {reqAcc ? '✓' : ''}
        </button>

        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search #order or user…"
            style={{
              padding: '0.375rem 0.75rem 0.375rem 2rem', borderRadius: '0.625rem',
              background: T.bgPanel, border: `1px solid ${T.border}`,
              color: T.textPrimary, fontSize: '0.8125rem', outline: 'none', width: 200,
            }}
          />
        </div>
      </div>

      <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', overflow: 'hidden', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'User', 'Product', 'Amount', 'Points', 'Date', 'Status', 'Service', 'Actions'].map(h => (
                <th key={h} style={TH_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>No orders found.</td></tr>
            ) : groupOrders(orders).map(item => {
              if (item.isGroup && item.orders.length > 1) return renderBatchRows(item)
              return renderOrderRow(item.isGroup ? item.orders[0] : item.order)
            })}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </PageShell>
  )

  function renderOrderRow(o, indent = false) {
    const expanded = expandedId === o.id
    const canExpand = o.requires_account || (o.code_value && o.is_revealed)
    return [
                <tr key={o.id}
                  onClick={() => canExpand && setExpandedId(expanded ? null : o.id)}
                  style={{ cursor: canExpand ? 'pointer' : 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,79,219,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...TD_STYLE, color: T.textMuted, ...(indent ? { paddingLeft: '2.25rem' } : {}) }}>
                    {indent && <span style={{ color: T.textMuted, marginRight: 4 }}>└</span>}
                    #{o.id}
                    {o.requires_account && <span title="Requires account" style={{ marginLeft: 4, fontSize: '0.75rem' }}>🔑</span>}
                  </td>
                  <td style={{ ...TD_STYLE, color: T.textPrimary, fontWeight: 500 }}>{o.user_username || o.user}</td>
                  <td style={{ ...TD_STYLE, maxWidth: '220px' }}>
                    <span style={{ display: 'block', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {o.product_name || o.product}
                      {o.quantity > 1 && (
                        <span style={{
                          marginLeft: 6, padding: '1px 6px', borderRadius: '0.375rem',
                          background: 'rgba(155,79,237,0.15)', border: `1px solid ${T.border}`,
                          color: T.purpleText, fontSize: '0.6875rem', fontWeight: 700,
                        }}>×{o.quantity}</span>
                      )}
                    </span>
                    {o.variant_label && (
                      <span style={{ display: 'inline-block', marginTop: 3, padding: '1px 6px', borderRadius: '0.375rem', background: 'rgba(155,79,237,0.12)', border: `1px solid ${T.border}`, color: T.purpleText, fontSize: '0.6875rem', fontWeight: 600 }}>
                        {o.variant_label}
                      </span>
                    )}
                  </td>
                  <td style={{ ...TD_STYLE, color: T.success, fontWeight: 600, fontFamily: T.mono }}>{formatCurrency(o.amount_paid)}</td>
                  <td style={{ ...TD_STYLE, color: T.purpleText }}>{o.points_earned ?? 0} pts</td>
                  <td style={TD_STYLE}>{formatDate(o.created_at)}</td>
                  <td style={TD_STYLE}>
                    <StatusPill status={o.status} />
                    {/* Code reveal indicator */}
                    {o.code_value && !o.requires_account && (
                      <div style={{ marginTop: 3 }}>
                        {o.is_revealed
                          ? <span style={{ fontSize: '0.5625rem', color: '#22C55E', fontFamily: 'JetBrains Mono, monospace' }}>👁 Revealed {o.code_viewed_at ? formatDate(o.code_viewed_at) : ''}</span>
                          : <span style={{ fontSize: '0.5625rem', color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>🔒 Not revealed</span>
                        }
                      </div>
                    )}
                  </td>
                  <td style={TD_STYLE}>
                    {o.requires_account
                      ? <ServiceStatusControl order={o} onUpdated={() => qc.invalidateQueries({ queryKey: ['admin-orders'] })} />
                      : <span style={{ color: T.textMuted, fontSize: '0.75rem' }}>-</span>
                    }
                  </td>
                  <td style={{ ...TD_STYLE, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    {o.requires_account && o.conversation_id && (
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/admin/inbox?conversation=${o.conversation_id}`) }}
                        title="Open chat"
                        style={{ background: 'rgba(155,79,237,0.1)', border: `1px solid ${T.border}`, color: T.purpleText, borderRadius: '0.375rem', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                      >
                        <MessageCircle size={12} /> Chat
                      </button>
                    )}
                    {o.status === 'completed' && (
                      <AdminCancelButton
                        order={o}
                        onDone={() => qc.invalidateQueries({ queryKey: ['admin-orders'] })}
                      />
                    )}
                  </td>
                </tr>,

                expanded && (
                  <tr key={`detail-${o.id}`}>
                    <td colSpan={9} style={{ padding: '0 1rem 1rem 2.5rem', background: T.warningDim, borderBottom: `1px solid ${T.border}` }}>
                      {o.requires_account && (
                        <>
                          <p style={{ color: T.textMuted, fontSize: '0.75rem', margin: '0.5rem 0 0.25rem', fontWeight: 600 }}>CLIENT CREDENTIALS</p>
                          <CredentialCard orderId={o.id} />
                        </>
                      )}
                      {o.code_value && !o.requires_account && (
                        <div style={{ paddingTop: '0.5rem' }}>
                          <p style={{ color: T.textMuted, fontSize: '0.6875rem', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {(o.code_values?.length || 1) > 1 ? `Codes ×${o.code_values.length} (admin view)` : 'Code (admin view)'}
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {(o.code_values?.length ? o.code_values : [o.code_value]).map((c, i) => (
                              <code key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem', color: '#22C55E' }}>{c}</code>
                            ))}
                          </div>
                          {o.is_revealed && (
                            <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: T.textMuted }}>
                              Revealed: {formatDate(o.code_viewed_at)} · IP: {o.code_view_ip || '-'}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
    ]
  }

  function renderBatchRows(group) {
    const members  = group.orders
    const first    = members[0]
    const open     = openBatches.has(group.batch_id)
    const total    = members.reduce((s, o) => s + Number(o.amount_paid || 0), 0)
    const points   = members.reduce((s, o) => s + (o.points_earned ?? 0), 0)
    const revealed = members.filter(o => o.is_revealed).length
    const statuses = new Set(members.map(o => o.status))
    const toggle = () => setOpenBatches(prev => {
      const next = new Set(prev)
      if (next.has(group.batch_id)) next.delete(group.batch_id)
      else next.add(group.batch_id)
      return next
    })

    const summaryRow = (
      <tr key={'batch-' + group.batch_id}
        onClick={toggle}
        style={{ cursor: 'pointer', background: open ? 'rgba(139,79,219,0.06)' : 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,79,219,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = open ? 'rgba(139,79,219,0.06)' : 'transparent'}
      >
        <td style={{ ...TD_STYLE, color: T.textMuted, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            #{members[members.length - 1].id}
          </span>
        </td>
        <td style={{ ...TD_STYLE, color: T.textPrimary, fontWeight: 500 }}>{first.user_username || first.user}</td>
        <td style={{ ...TD_STYLE, maxWidth: '220px' }}>
          <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{first.product_name || first.product}</span>
          <span style={{
            marginLeft: 6, padding: '1px 6px', borderRadius: '0.375rem',
            background: 'rgba(155,79,237,0.15)', border: `1px solid ${T.border}`,
            color: T.purpleText, fontSize: '0.6875rem', fontWeight: 700,
          }}>×{members.length}</span>
          {first.variant_label && (
            <span style={{ display: 'inline-block', marginTop: 3, padding: '1px 6px', borderRadius: '0.375rem', background: 'rgba(155,79,237,0.12)', border: `1px solid ${T.border}`, color: T.purpleText, fontSize: '0.6875rem', fontWeight: 600 }}>
              {first.variant_label}
            </span>
          )}
        </td>
        <td style={{ ...TD_STYLE, color: T.success, fontWeight: 600, fontFamily: T.mono }}>{formatCurrency(total)}</td>
        <td style={{ ...TD_STYLE, color: T.purpleText }}>{points} pts</td>
        <td style={TD_STYLE}>{formatDate(first.created_at)}</td>
        <td style={TD_STYLE}>
          {statuses.size === 1
            ? <StatusPill status={first.status} />
            : <span style={{ color: T.textMuted, fontSize: '0.75rem' }}>Mixed</span>
          }
          {!first.requires_account && (
            <div style={{ marginTop: 3 }}>
              <span style={{ fontSize: '0.5625rem', color: revealed === members.length ? '#22C55E' : '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>
                👁 {revealed}/{members.length} revealed
              </span>
            </div>
          )}
        </td>
        <td style={TD_STYLE}><span style={{ color: T.textMuted, fontSize: '0.75rem' }}>-</span></td>
        <td style={{ ...TD_STYLE, color: T.textMuted, fontSize: '0.6875rem' }}>{open ? 'Hide items' : 'View items'}</td>
      </tr>
    )

    return open ? [summaryRow, ...members.map(o => renderOrderRow(o, true))] : [summaryRow]
  }
}

