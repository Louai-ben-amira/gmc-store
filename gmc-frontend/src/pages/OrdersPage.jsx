import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getOrders, reorder } from '../api/orders'
import { StatusBadge } from '../components/Badge'
import Modal from '../components/Modal'
import Topbar from '../components/Topbar'
import Footer from '../components/Footer'
import { formatDate, formatCurrency, mediaUrl } from '../utils/formatters'
import { useToast } from '../hooks/useToast'
import {
  TbPackage, TbCopy, TbCheck, TbShoppingBag, TbRefresh,
  TbMessageCircle, TbBolt, TbClock, TbCircleCheck, TbX,
  TbReceipt, TbChevronDown, TbChevronUp, TbStar,
} from 'react-icons/tb'

/* ── Status configs ──────────────────────────────────────────────────── */
const STATUS_CFG = {
  completed: { label: 'Completed', color: '#3DDC84', Icon: TbCircleCheck },
  pending:   { label: 'Pending',   color: '#f59e0b', Icon: TbClock },
  cancelled: { label: 'Cancelled', color: '#ff4d6d', Icon: TbX },
}
const SERVICE_CFG = {
  pending:     { label: 'Pending',     color: '#f59e0b', Icon: TbClock },
  in_progress: { label: 'In Progress', color: '#38BDF8', Icon: TbRefresh },
  completed:   { label: 'Completed',   color: '#3DDC84', Icon: TbCircleCheck },
}

/* ── Code display ────────────────────────────────────────────────────── */
function CodeBox({ code }) {
  const { t } = useTranslation('orders')
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 8px' }}>{t('modal.yourCode')}</p>
      <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', marginBottom: 10 }}>
        <code style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)', wordBreak: 'break-all', flex: 1 }}>{code}</code>
        <button onClick={copy} style={{
          flexShrink: 0, background: copied ? 'rgba(61,220,132,0.15)' : 'rgba(124,58,237,0.15)',
          border: copied ? '1px solid rgba(61,220,132,0.3)' : '1px solid rgba(124,58,237,0.3)',
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          color: copied ? '#3DDC84' : 'var(--accent)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700,
          transition: 'all 0.15s',
        }}>
          {copied ? <TbCheck size={13} /> : <TbCopy size={13} />}
          {copied ? t('modal.copied') : t('modal.copy')}
        </button>
      </div>
    </div>
  )
}

/* ── View Code Modal ─────────────────────────────────────────────────── */
function ViewCodeModal({ isOpen, onClose, order }) {
  const { t } = useTranslation('orders')
  if (!order) return null
  const cfg = STATUS_CFG[order.status] || STATUS_CFG.pending
  const StatusIcon = cfg.Icon
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modal.orderDetails')} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Product header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#181825', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {order.product_detail?.image
              ? <img src={mediaUrl(order.product_detail.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <TbShoppingBag size={22} color="rgba(255,255,255,0.15)" />
            }
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{order.product_detail?.name || order.bundle_name || 'Bundle Order'}</p>
            <p style={{ margin: '2px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)' }}>{t('labels.orderId')}{order.id}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: cfg.color + '14', border: '1px solid ' + cfg.color + '30', borderRadius: 8, padding: '5px 10px' }}>
            <StatusIcon size={12} color={cfg.color} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
          </div>
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            [t('labels.total'), formatCurrency(order.amount_paid), '#3DDC84'],
            [t('labels.earned'), '+' + order.points_earned + ' ' + t('labels.points'), '#f59e0b'],
            [t('table.date'), formatDate(order.created_at), 'rgba(255,255,255,0.5)'],
            [t('table.payment') || 'Payment', order.payment_method || 'Wallet', 'rgba(255,255,255,0.5)'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color }}>{value}</p>
            </div>
          ))}
        </div>

        {order.code_value && <CodeBox code={order.code_value} />}
      </div>
    </Modal>
  )
}

/* ── Reorder success modal ───────────────────────────────────────────── */
function ReorderSuccessModal({ isOpen, onClose, order }) {
  if (!order) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order Placed!" size="md">
      <div style={{ textAlign: 'center', padding: '1rem 0 1.5rem' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(61,220,132,0.12)', border: '1px solid rgba(61,220,132,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <TbCircleCheck size={28} color="#3DDC84" />
        </div>
        <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)', margin: '0 0 6px' }}>{order.product_detail?.name}</p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          {formatCurrency(order.amount_paid)} deducted · <span style={{ color: '#f59e0b' }}>+{order.points_earned} pts earned</span>
        </p>
      </div>
      {order.code_value && <CodeBox code={order.code_value} />}
    </Modal>
  )
}

/* ── Order row ───────────────────────────────────────────────────────── */
function OrderRow({ order, idx, onView, onReorder, reorderingId }) {
  const { t } = useTranslation('orders')
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CFG[order.status] || STATUS_CFG.pending
  const svcCfg = SERVICE_CFG[order.service_status] || SERVICE_CFG.pending
  const StatusIcon = cfg.Icon
  const SvcIcon = svcCfg.Icon
  const isReordering = reorderingId === order.id
  const canReorder = order.status === 'completed' && order.product_detail && !order.requires_account

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
      animation: 'fadeSlideUp 0.35s ' + (idx * 0.04) + 's ease both',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.25)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,58,237,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Main row */}
      <div className="order-main-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '1rem 1.25rem' }}>

        {/* Thumbnail */}
        <div style={{ width: 50, height: 50, borderRadius: 12, flexShrink: 0, overflow: 'hidden', background: '#181825', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {order.product_detail?.image
            ? <img src={mediaUrl(order.product_detail.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <TbShoppingBag size={20} color="rgba(255,255,255,0.15)" />
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {order.product_detail?.name || order.bundle_name || 'Bundle Order'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)' }}>#{order.id}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(order.created_at)}</span>
            {order.requires_account && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: svcCfg.color + '14', border: '1px solid ' + svcCfg.color + '28', borderRadius: 6, padding: '2px 7px' }}>
                <SvcIcon size={10} color={svcCfg.color} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, color: svcCfg.color, letterSpacing: '0.06em' }}>{svcCfg.label.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Price + status */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
          <p style={{ margin: '0 0 5px', fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#3DDC84' }}>{formatCurrency(order.amount_paid)}</p>
          <div className="order-status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cfg.color + '12', border: '1px solid ' + cfg.color + '28', borderRadius: 7, padding: '3px 8px' }}>
            <StatusIcon size={10} color={cfg.color} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 700, color: cfg.color, letterSpacing: '0.05em' }}>{t('status.' + order.status, cfg.label).toUpperCase()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="order-actions" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {order.requires_account && order.conversation_id && (
            <button onClick={e => { e.stopPropagation(); window.location.href = '/messenger' }} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(27,154,238,0.1)', border: '1px solid rgba(27,154,238,0.25)',
              color: '#1b9aee', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.13s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(27,154,238,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(27,154,238,0.1)'}
            >
              <TbMessageCircle size={13} /> {t('actions.support')}
            </button>
          )}
          {canReorder && (
            <button onClick={e => { e.stopPropagation(); onReorder(e, order) }} disabled={!!reorderingId} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(61,220,132,0.08)', border: '1px solid rgba(61,220,132,0.2)',
              color: '#3DDC84', cursor: reorderingId ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600,
              opacity: reorderingId && !isReordering ? 0.4 : 1, transition: 'all 0.13s',
            }}
              onMouseEnter={e => { if (!reorderingId) e.currentTarget.style.background = 'rgba(61,220,132,0.15)' }}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(61,220,132,0.08)'}
            >
              <TbRefresh size={13} style={{ animation: isReordering ? 'spin 0.7s linear infinite' : 'none' }} />
              {isReordering ? t('actions.placing') || 'Placing…' : t('modal.reorder')}
            </button>
          )}
          {!order.requires_account && (
            <button onClick={() => onView(order)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
              color: 'var(--accent)', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.13s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.1)'}
            >
              <TbReceipt size={13} /> {t('actions.viewCode')}
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)} style={{
            width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer',
            color: 'var(--text-muted)', transition: 'all 0.13s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
          >
            {expanded ? <TbChevronUp size={14} /> : <TbChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded detail strip */}
      {expanded && (
        <div className="order-detail-strip" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.15)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[
            [t('labels.orderId'),  '#' + order.id],
            [t('table.date'),      formatDate(order.created_at)],
            [t('labels.total'),    formatCurrency(order.amount_paid)],
            [t('labels.earned'),   '+' + order.points_earned + ' ' + t('labels.points')],
            [t('table.payment'),   order.payment_method || 'Wallet'],
            [t('table.status'),    t('status.' + order.status, cfg.label)],
          ].map(([label, value]) => (
            <div key={label}>
              <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{value}</p>
            </div>
          ))}
          {order.code_value && (
            <div style={{ flex: '1 1 100%' }}>
              <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Code</p>
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)' }}>{order.code_value}</code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function OrdersPage() {
  const { t } = useTranslation('orders')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [reorderResult, setReorderResult] = useState(null)
  const [reorderingId,  setReorderingId]  = useState(null)
  const [filter, setFilter] = useState('all')
  const qc      = useQueryClient()
  const toast   = useToast()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrders().then(r => r.data),
  })
  const allOrders = data?.results || data || []
  const orders = filter === 'all' ? allOrders : allOrders.filter(o => o.status === filter)

  const handleReorder = async (e, order) => {
    e.stopPropagation()
    if (reorderingId) return
    setReorderingId(order.id)
    try {
      const { data: newOrder } = await reorder(order.id)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setReorderResult(newOrder)
      toast.success('Order placed instantly!')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not reorder. Check your balance.')
    }
    setReorderingId(null)
  }

  /* ── Stats ── */
  const totalSpent   = allOrders.reduce((s, o) => s + parseFloat(o.amount_paid || 0), 0)
  const totalPoints  = allOrders.reduce((s, o) => s + (o.points_earned || 0), 0)
  const completed    = allOrders.filter(o => o.status === 'completed').length

  const TABS = [
    { key: 'all',       label: t('status.all'),       count: allOrders.length },
    { key: 'completed', label: t('status.completed'), count: allOrders.filter(o => o.status === 'completed').length },
    { key: 'pending',   label: t('status.pending'),   count: allOrders.filter(o => o.status === 'pending').length },
    { key: 'cancelled', label: t('status.cancelled'), count: allOrders.filter(o => o.status === 'cancelled').length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />

      <div className='pb-nav' style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>

        {/* ── Page header ─────────────────────────────── */}
        <div className="orders-header" style={{ padding: '2rem 2rem 0', maxWidth: 960, margin: '0 auto' }}>
          <div style={{ marginBottom: '1.75rem', animation: 'fadeSlideUp 0.35s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TbPackage size={18} color="#A78BFA" />
              </div>
              <h1 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '1.625rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{t('title')}</h1>
            </div>
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('subtitle') || 'Track your purchases, view codes, and buy again'}</p>
          </div>

          {/* ── Stats row ── */}
          {allOrders.length > 0 && (
            <div className="orders-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '1.75rem', animation: 'fadeSlideUp 0.35s 0.05s ease both' }}>
              {[
                { label: t('labels.total'),   value: formatCurrency(totalSpent),                              color: '#3DDC84', Icon: TbReceipt },
                { label: t('labels.placedOn') || 'Orders Placed', value: completed + ' ' + t('status.completed'), color: '#7C3AED', Icon: TbCircleCheck },
                { label: t('labels.earned'),  value: totalPoints + ' ' + t('labels.points'),                     color: '#f59e0b', Icon: TbStar },
              ].map(({ label, value, color, Icon }) => (
                <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid ' + color + '20', borderRadius: 14, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '14', border: '1px solid ' + color + '28', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
                    <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1rem', color }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Filter tabs ── */}
          <div className="orders-tab-strip" style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
            {TABS.map(tab => {
              const active = filter === tab.key
              const dotColor = tab.key === 'completed' ? '#3DDC84' : tab.key === 'pending' ? '#f59e0b' : tab.key === 'cancelled' ? '#ff4d6d' : 'var(--accent)'
              return (
                <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 14px', borderRadius: 9,
                  background: active ? 'rgba(124,58,237,0.18)' : 'transparent',
                  border: active ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'all 0.13s',
                }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: active ? 600 : 400, color: active ? '#A78BFA' : 'var(--text-muted)' }}>{tab.label}</span>
                  {tab.count > 0 && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700, background: active ? dotColor + '25' : 'rgba(255,255,255,0.06)', color: active ? dotColor : 'var(--text-muted)', borderRadius: 5, padding: '1px 6px' }}>{tab.count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Orders list ─────────────────────────────── */}
        <div className="orders-body" style={{ padding: '0 2rem 4rem', maxWidth: 960, margin: '0 auto' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Array(4).fill(0).map((_, i) => (
                <div key={i} style={{ height: 78, borderRadius: 16, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 2rem', animation: 'fadeSlideUp 0.35s ease both' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <TbPackage size={34} color="rgba(124,58,237,0.4)" />
              </div>
              <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                {filter === 'all' ? t('empty.title') : `${t('status.' + filter)} — ${t('empty.title')}`}
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
                {filter === 'all' ? t('empty.subtitle') : t('empty.subtitle')}
              </p>
              {filter === 'all' && (
                <button onClick={() => navigate('/')} className="btn-primary" style={{ padding: '0.625rem 1.5rem' }}>
                  <TbBolt size={14} /> {t('empty.cta')}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {orders.map((order, i) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  idx={i}
                  onView={setSelectedOrder}
                  onReorder={handleReorder}
                  reorderingId={reorderingId}
                />
              ))}
            </div>
          )}
        </div>

        <Footer />
      </div>

      <ViewCodeModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} order={selectedOrder} />
      <ReorderSuccessModal isOpen={!!reorderResult} onClose={() => setReorderResult(null)} order={reorderResult} />

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}




