import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Zap, Send, SkipForward, RotateCcw, X, Check, AlertTriangle } from 'lucide-react'
import {
  getAdminPreOrders, getPreOrderProducts, getPreOrderQueue,
  deliverPreOrder, skipPreOrder, requeuePreOrder, autoFulfillPreOrders,
} from '../../api/preorders'
import {
  PageShell, PageHeader, Panel, DataTable, StatusPill, FilterTabs,
  ClientCell, Money, IconBtn, QuickActionButton, Pagination, T, TD_STYLE,
} from '../../components/admin/AdminUI'
import { useToast } from '../../hooks/useToast'
import { formatDate } from '../../utils/formatters'

const VIEWS = [
  { value: 'by-product', label: 'By product' },
  { value: 'all',        label: 'All pre-orders' },
]
const STATUS_TABS = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'expired',   label: 'Skipped' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed',    label: 'Failed' },
]

/* ── Deliver-a-code dialog ────────────────────────────────────────────── */
function DeliverModal({ preorder, onClose, onDelivered }) {
  const toast = useToast()
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  if (!preorder) return null

  const submit = async () => {
    if (!code.trim()) return
    setLoading(true); setError(null)
    try {
      const { data } = await deliverPreOrder(preorder.id, code.trim())
      toast.success(`Delivered — order #${data.order_id} created and client charged.`)
      onDelivered()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(d?.detail || 'Delivery failed.')
      if (d?.error !== 'insufficient_balance') toast.error(d?.detail || 'Delivery failed.')
    } finally { setLoading(false) }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 22, width: '100%', maxWidth: 440, fontFamily: T.body,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: T.heading, fontWeight: 700, fontSize: 19, color: T.textPrimary }}>
              Deliver code
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {preorder.product_name}{preorder.variant_label ? ` · ${preorder.variant_label}` : ''} → {preorder.client_username}
            </div>
          </div>
          <IconBtn onClick={onClose} title="Close"><X size={14} /></IconBtn>
        </div>

        <div style={{
          background: 'rgba(155,79,237,0.07)', border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '11px 14px', marginBottom: 16,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <Line label="Locked price" value={<Money amount={preorder.total_price} color={T.warning} />} />
          <Line label="Client balance" value={<Money amount={preorder.client_balance} color={preorder.can_afford ? T.success : T.danger} />} />
          {!preorder.can_afford && (
            <Line label="Short by" value={<Money amount={preorder.shortfall} color={T.danger} />} />
          )}
        </div>

        <label style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          Code to send
        </label>
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="XXXX-XXXX-XXXX"
          autoFocus
          style={{
            width: '100%', marginTop: 6, background: T.bgInput, border: `1px solid ${T.border}`,
            borderRadius: 9, padding: '11px 13px', color: T.textPrimary,
            fontFamily: T.mono, fontSize: 14, letterSpacing: '0.05em', outline: 'none',
          }}
        />

        {error && (
          <div style={{
            marginTop: 12, background: T.dangerDim, border: `1px solid ${T.dangerBorder}`,
            borderRadius: 9, padding: '10px 13px', display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <AlertTriangle size={14} color={T.danger} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: T.danger, lineHeight: 1.55 }}>{error}</span>
          </div>
        )}

        <p style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.6, margin: '13px 0 16px' }}>
          Sending charges the client <b style={{ color: T.warning }}>{parseFloat(preorder.total_price).toFixed(2)} DT</b> and
          creates a completed order in the same action. Nothing happens if their balance is short.
        </p>

        <div style={{ display: 'flex', gap: 9 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 9, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${T.border}`, color: T.textSub, fontSize: 13.5, fontWeight: 600,
          }}>
            Cancel
          </button>
          <button onClick={submit} disabled={loading || !code.trim()} style={{
            flex: 1, padding: '11px', borderRadius: 9, border: 'none',
            background: 'linear-gradient(135deg,#6D28D9,#9B4FED)', color: '#fff',
            fontSize: 13.5, fontWeight: 700,
            cursor: (loading || !code.trim()) ? 'not-allowed' : 'pointer',
            opacity: (loading || !code.trim()) ? 0.55 : 1,
          }}>
            {loading ? 'Sending…' : 'Deliver to client'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Line({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: T.textMuted }}>
      <span>{label}</span>{value}
    </div>
  )
}

/* ── Auto-fulfill result banner ───────────────────────────────────────── */
function RunSummary({ result, onDismiss }) {
  if (!result) return null
  const { fulfilled, skipped, no_stock: noStock, details = [] } = result
  return (
    <Panel style={{ marginBottom: 16, borderColor: fulfilled > 0 ? T.successBorder : T.border }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: details.length ? 12 : 0 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Stat label="Fulfilled" value={fulfilled} color={T.success} />
          <Stat label="Skipped (balance)" value={skipped} color={T.danger} />
          <Stat label="Still waiting" value={noStock} color={T.warning} />
        </div>
        <IconBtn onClick={onDismiss} title="Dismiss"><X size={14} /></IconBtn>
      </div>
      {details.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 190, overflowY: 'auto' }}>
          {details.map(d => (
            <div key={d.preorder_id} style={{
              display: 'flex', gap: 9, alignItems: 'center', fontSize: 12,
              color: T.textSub, padding: '5px 9px', background: 'rgba(139,79,219,0.05)', borderRadius: 7,
            }}>
              <StatusPill
                status={d.status === 'fulfilled' ? 'completed' : d.status === 'skipped' ? 'failed' : 'pending'}
                label={d.status === 'no_stock' ? 'Waiting' : d.status}
              />
              <span style={{ color: T.textPrimary, fontWeight: 600 }}>{d.client}</span>
              <span style={{ color: T.textMuted }}>{d.reason}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 19, color }}>{value}</div>
    </div>
  )
}

/* ── Shared row bits ──────────────────────────────────────────────────── */
function AffordCell({ row }) {
  if (row.can_afford) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.success, fontWeight: 600, fontSize: '0.8125rem' }}>
        <Check size={13} /> Yes
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.danger, fontWeight: 600, fontSize: '0.8125rem' }}>
      <X size={13} /> Short {parseFloat(row.shortfall).toFixed(2)} DT
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function AdminPreOrdersPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [view,        setView]        = useState('by-product')
  const [productId,   setProductId]   = useState(null)
  const [statusTab,   setStatusTab]   = useState('pending')
  const [page,        setPage]        = useState(1)
  const [deliverFor,  setDeliverFor]  = useState(null)
  const [runResult,   setRunResult]   = useState(null)
  const [running,     setRunning]     = useState(false)

  const { data: products = [] } = useQuery({
    queryKey: ['admin-preorder-products'],
    queryFn: () => getPreOrderProducts().then(r => r.data),
  })

  // Default to the product with the most people waiting
  const activeProductId = productId ?? products[0]?.id ?? null

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['admin-preorder-queue', activeProductId],
    queryFn: () => getPreOrderQueue(activeProductId).then(r => r.data),
    enabled: view === 'by-product' && !!activeProductId,
  })

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['admin-preorders', statusTab, page],
    queryFn: () => getAdminPreOrders({ status: statusTab, page }).then(r => r.data),
    enabled: view === 'all',
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-preorder-products'] })
    qc.invalidateQueries({ queryKey: ['admin-preorder-queue'] })
    qc.invalidateQueries({ queryKey: ['admin-preorders'] })
    qc.invalidateQueries({ queryKey: ['admin-badge-counts'] })
  }

  const handleAutoFulfill = async () => {
    if (!activeProductId) return
    setRunning(true)
    try {
      const { data } = await autoFulfillPreOrders(activeProductId)
      setRunResult(data)
      refresh()
      if (data.fulfilled > 0) toast.success(`Delivered to ${data.fulfilled} client${data.fulfilled > 1 ? 's' : ''}.`)
      else toast.info('Nothing delivered — check the run details.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Auto-fulfill failed.')
    } finally { setRunning(false) }
  }

  const handleSkip = async (row) => {
    if (!window.confirm(`Skip ${row.client_username}? They stay flagged for you and leave the live queue.`)) return
    try {
      await skipPreOrder(row.id, 'expired')
      toast.success(`${row.client_username} skipped.`)
      refresh()
    } catch (err) { toast.error(err.response?.data?.detail || 'Could not skip.') }
  }

  const handleRequeue = async (row) => {
    try {
      await requeuePreOrder(row.id)
      toast.success(`${row.client_username} is back in the queue.`)
      refresh()
    } catch (err) { toast.error(err.response?.data?.detail || 'Could not re-queue.') }
  }

  const product   = queueData?.product
  const queue     = queueData?.queue   || []
  const history   = queueData?.history || []
  const listRows  = listData?.results  || []
  const totalPages = Math.max(1, Math.ceil((listData?.count || 0) / 20))

  return (
    <PageShell>
      <PageHeader
        title="Pre-Orders"
        subtitle="Clients waiting for out-of-stock products"
        onRefresh={refresh}
        actions={
          view === 'by-product' && queue.length > 0 && (
            <QuickActionButton primary onClick={handleAutoFulfill}>
              <Zap size={13} /> {running ? 'Running…' : 'Auto-Fulfill All'}
            </QuickActionButton>
          )
        }
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <FilterTabs tabs={VIEWS} value={view} onChange={setView} />
        {view === 'by-product' ? (
          <select
            value={activeProductId || ''}
            onChange={e => { setProductId(Number(e.target.value)); setRunResult(null) }}
            style={{
              background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 9,
              padding: '8px 12px', color: T.textPrimary, fontSize: 13, fontFamily: T.body,
              minWidth: 240, cursor: 'pointer', outline: 'none',
            }}
          >
            {products.length === 0 && <option value="">No products with pre-orders</option>}
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.pending} waiting
              </option>
            ))}
          </select>
        ) : (
          <FilterTabs tabs={STATUS_TABS} value={statusTab} onChange={v => { setStatusTab(v); setPage(1) }} />
        )}
      </div>

      {view === 'by-product' ? (
        <>
          <RunSummary result={runResult} onDismiss={() => setRunResult(null)} />

          {product && (
            <Panel style={{ marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <Stat label="In queue"        value={queue.length}            color={T.warning} />
              <Stat label="Codes available" value={product.available_codes} color={T.success} />
              <Stat label="Stock count"     value={product.stock_count}     color={T.info} />
              {!product.allows_preorder && (
                <span style={{ fontSize: 12, color: T.danger, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} /> Pre-orders are switched off for this product — no new clients can queue.
                </span>
              )}
            </Panel>
          )}

          <DataTable
            headers={['#', 'Client', 'Balance', 'Price locked', 'Can afford', 'Placed', 'Actions']}
            loading={queueLoading}
            empty="Nobody is waiting for this product."
          >
            {queue.length > 0 && queue.map((row, i) => (
              <tr key={row.id}>
                <td style={{ ...TD_STYLE, fontFamily: T.mono, fontWeight: 700, color: T.warning }}>{row.queue_position}</td>
                <td style={TD_STYLE}>
                  <ClientCell name={row.client_username} sub={row.client_email} index={i} />
                </td>
                <td style={TD_STYLE}><Money amount={row.client_balance} color={row.can_afford ? T.success : T.danger} /></td>
                <td style={TD_STYLE}><Money amount={row.total_price} color={T.warning} /></td>
                <td style={TD_STYLE}><AffordCell row={row} /></td>
                <td style={{ ...TD_STYLE, whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{formatDate(row.created_at)}</td>
                <td style={TD_STYLE}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <IconBtn onClick={() => setDeliverFor(row)} title="Deliver a code"><Send size={13} /></IconBtn>
                    <IconBtn onClick={() => handleSkip(row)} title="Skip this client"
                      color={T.danger} bg={T.dangerDim} border={T.dangerBorder}>
                      <SkipForward size={13} />
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>

          {history.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, margin: '22px 0 10px' }}>
                History
              </div>
              <DataTable headers={['Client', 'Status', 'Price', 'Placed', 'Note', 'Actions']}>
                {history.map((row, i) => (
                  <tr key={row.id}>
                    <td style={TD_STYLE}><ClientCell name={row.client_username} sub={row.client_email} index={i} /></td>
                    <td style={TD_STYLE}><StatusPill status={row.status} label={row.status === 'expired' ? 'Skipped' : undefined} /></td>
                    <td style={TD_STYLE}><Money amount={row.total_price} color={T.textSub} /></td>
                    <td style={{ ...TD_STYLE, whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{formatDate(row.created_at)}</td>
                    <td style={{ ...TD_STYLE, fontSize: '0.75rem', maxWidth: 260 }}>{row.failure_reason || '—'}</td>
                    <td style={TD_STYLE}>
                      {(row.status === 'expired' || row.status === 'failed') && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <IconBtn onClick={() => handleRequeue(row)} title="Put back in queue"><RotateCcw size={13} /></IconBtn>
                          <IconBtn onClick={() => setDeliverFor(row)} title="Deliver a code anyway"><Send size={13} /></IconBtn>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </>
          )}
        </>
      ) : (
        <>
          <DataTable
            headers={['Client', 'Product', '#', 'Price locked', 'Balance', 'Status', 'Placed']}
            loading={listLoading}
            empty="No pre-orders yet."
          >
            {listRows.length > 0 && listRows.map((row, i) => (
              <tr key={row.id}>
                <td style={TD_STYLE}><ClientCell name={row.client_username} sub={row.client_email} index={i} /></td>
                <td style={TD_STYLE}>
                  <div style={{ color: T.textPrimary, fontSize: '0.875rem' }}>{row.product_name}</div>
                  {row.variant_label && <div style={{ color: T.textMuted, fontSize: '0.7rem' }}>{row.variant_label}</div>}
                </td>
                <td style={{ ...TD_STYLE, fontFamily: T.mono }}>{row.status === 'pending' ? row.queue_position : '—'}</td>
                <td style={TD_STYLE}><Money amount={row.total_price} color={T.warning} /></td>
                <td style={TD_STYLE}><Money amount={row.client_balance} color={row.can_afford ? T.success : T.danger} /></td>
                <td style={TD_STYLE}><StatusPill status={row.status} label={row.status === 'expired' ? 'Skipped' : undefined} /></td>
                <td style={{ ...TD_STYLE, whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <DeliverModal
        preorder={deliverFor}
        onClose={() => setDeliverFor(null)}
        onDelivered={refresh}
      />
    </PageShell>
  )
}
