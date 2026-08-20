import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  TbClipboardList, TbClock, TbCircleCheck, TbX, TbAlertTriangle,
  TbHourglass, TbUsers, TbLock, TbArrowRight, TbLifebuoy, TbWallet,
} from 'react-icons/tb'
import { getPreOrders, cancelPreOrder } from '../api/preorders'
import Topbar from '../components/Topbar'
import Footer from '../components/Footer'
import Modal from '../components/Modal'
import { formatCurrency, formatDate, mediaUrl } from '../utils/formatters'
import { useToast } from '../hooks/useToast'

const AMBER = '#FFC84D'

const STATUS_CFG = {
  pending:   { label: 'Pending',   color: AMBER,     bg: 'rgba(255,200,77,0.12)',  border: 'rgba(255,200,77,0.35)',  Icon: TbClock },
  fulfilled: { label: 'Fulfilled', color: '#3DDC84', bg: 'rgba(61,220,132,0.12)',  border: 'rgba(61,220,132,0.35)',  Icon: TbCircleCheck },
  cancelled: { label: 'Cancelled', color: '#8A7AAE', bg: 'rgba(138,122,174,0.12)', border: 'rgba(138,122,174,0.3)',  Icon: TbX },
  expired:   { label: 'Skipped',   color: '#FF6B85', bg: 'rgba(255,107,133,0.12)', border: 'rgba(255,107,133,0.35)', Icon: TbAlertTriangle },
  failed:    { label: 'Failed',    color: '#FF6B85', bg: 'rgba(255,107,133,0.12)', border: 'rgba(255,107,133,0.35)', Icon: TbAlertTriangle },
}

/** "3h 20m" — how much of the free-cancellation window is left. */
function formatWindow(seconds) {
  if (seconds <= 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending
  const { Icon } = cfg
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      borderRadius: 999, padding: '4px 11px',
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 800,
      letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <Icon size={12} /> {cfg.label}
    </span>
  )
}

function PreOrderCard({ preorder, onCancel }) {
  const navigate = useNavigate()
  const timeLeft = formatWindow(preorder.cancel_seconds_left)
  const isOpen   = preorder.status === 'pending'
  const skipped  = preorder.status === 'expired' || preorder.status === 'failed'

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', gap: 14, padding: '1.125rem 1.25rem' }}>
        {preorder.product_image && (
          <img
            src={mediaUrl(preorder.product_image)}
            alt={preorder.product_name}
            style={{ width: 58, height: 58, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                margin: 0, fontFamily: 'Sora, sans-serif', fontSize: '1rem', fontWeight: 700,
                color: 'var(--text-primary)', lineHeight: 1.35,
              }}>
                {preorder.product_name}
                {preorder.variant_label && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {preorder.variant_label}</span>
                )}
              </h3>
              <p style={{ margin: '3px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Placed {formatDate(preorder.created_at)}
              </p>
            </div>
            <StatusBadge status={preorder.status} />
          </div>

          {/* Facts row */}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
            <Fact
              icon={<TbLock size={12} />}
              label="Price locked"
              value={formatCurrency(preorder.total_price)}
              color={AMBER}
            />
            {isOpen && (
              <Fact
                icon={<TbUsers size={12} />}
                label="Queue"
                value={`You're #${preorder.queue_position}`}
              />
            )}
          </div>

          {isOpen && preorder.preorder_note && (
            <div style={{
              marginTop: 12, background: 'rgba(255,200,77,0.08)', border: '1px solid rgba(255,200,77,0.25)',
              borderRadius: 9, padding: '9px 12px', display: 'flex', gap: 7, alignItems: 'flex-start',
            }}>
              <TbHourglass size={13} color={AMBER} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {preorder.preorder_note}
              </span>
            </div>
          )}

          {skipped && (
            <div style={{
              marginTop: 12, background: 'rgba(255,107,133,0.08)', border: '1px solid rgba(255,107,133,0.25)',
              borderRadius: 9, padding: '9px 12px', display: 'flex', gap: 7, alignItems: 'flex-start',
            }}>
              <TbAlertTriangle size={13} color="#FF6B85" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                Insufficient balance at delivery time — you were <b>not</b> charged.
                Top up your wallet and contact support to get back in the queue.
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {isOpen && preorder.can_cancel && (
              <>
                <button
                  onClick={() => onCancel(preorder)}
                  style={{
                    background: 'rgba(255,107,133,0.10)', border: '1px solid rgba(255,107,133,0.35)',
                    color: '#FF6B85', borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600,
                  }}
                >
                  Cancel Pre-Order
                </button>
                {timeLeft && (
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Free cancellation — {timeLeft} left
                  </span>
                )}
              </>
            )}

            {isOpen && !preorder.can_cancel && (
              <button
                onClick={() => navigate('/support')}
                style={{
                  background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-muted)',
                  borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <TbLifebuoy size={14} /> Contact support to cancel
              </button>
            )}

            {preorder.status === 'fulfilled' && preorder.order_id && (
              <button
                onClick={() => navigate(`/orders/${preorder.order_id}`)}
                className="btn-primary"
                style={{ padding: '7px 14px', borderRadius: 9, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                View Order <TbArrowRight size={14} />
              </button>
            )}

            {skipped && (
              <button
                onClick={() => navigate('/wallet')}
                style={{
                  background: `linear-gradient(135deg, ${AMBER}, #F0A81E)`, border: 'none', color: '#1A1206',
                  borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <TbWallet size={14} /> Top Up Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Fact({ icon, label, value, color }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 700,
        letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>
        {icon} {label}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9375rem', fontWeight: 800,
        color: color || 'var(--text-primary)', marginTop: 2,
      }}>
        {value}
      </div>
    </div>
  )
}

export default function PreOrdersPage() {
  const qc       = useQueryClient()
  const toast    = useToast()
  const navigate = useNavigate()
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling,   setCancelling]   = useState(false)

  const { data: preorders = [], isLoading } = useQuery({
    queryKey: ['preorders'],
    queryFn: () => getPreOrders().then(r => r.data),
  })

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelPreOrder(cancelTarget.id)
      toast.success('Pre-order cancelled. Nothing was charged.')
      setCancelTarget(null)
      qc.invalidateQueries({ queryKey: ['preorders'] })
      qc.invalidateQueries({ queryKey: ['product'] })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not cancel your pre-order.')
    } finally { setCancelling(false) }
  }

  const pending = preorders.filter(p => p.status === 'pending')
  const past    = preorders.filter(p => p.status !== 'pending')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="page-padding" style={{ maxWidth: 880, margin: '0 auto', padding: '1.75rem 1.25rem 3rem' }}>

          {/* Header */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
              <TbClipboardList size={22} color={AMBER} />
              <h1 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                My Pre-Orders
              </h1>
            </div>
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              You're only charged when your code is ready — keep enough balance in your wallet.
            </p>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem' }}>
              Loading…
            </div>
          ) : preorders.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--bg-surface)',
              border: '1px dashed var(--border-strong)', borderRadius: 14,
            }}>
              <TbClipboardList size={36} color="var(--text-muted)" style={{ opacity: 0.5 }} />
              <p style={{ margin: '14px 0 6px', fontFamily: 'Sora, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                No pre-orders yet
              </p>
              <p style={{ margin: '0 0 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                When a product is out of stock, you can reserve your spot in the queue.
              </p>
              <button onClick={() => navigate('/')} className="btn-primary" style={{ padding: '10px 22px', borderRadius: 10, fontSize: '0.875rem' }}>
                Browse the shop
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {pending.length > 0 && (
                <Section title={`In queue (${pending.length})`}>
                  {pending.map(p => <PreOrderCard key={p.id} preorder={p} onCancel={setCancelTarget} />)}
                </Section>
              )}
              {past.length > 0 && (
                <Section title={`History (${past.length})`}>
                  {past.map(p => <PreOrderCard key={p.id} preorder={p} onCancel={setCancelTarget} />)}
                </Section>
              )}
            </div>
          )}
        </div>
        <Footer />
      </div>

      {/* Cancel confirmation */}
      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel pre-order?" size="sm">
        {cancelTarget && (
          <>
            <p style={{ margin: '0 0 8px', fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
              You'll lose position <b>#{cancelTarget.queue_position}</b> in the queue for{' '}
              <b>{cancelTarget.product_name}</b>.
            </p>
            <p style={{ margin: '0 0 20px', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Nothing was ever charged, so there's no refund to make. You can pre-order again later,
              but you'd go to the back of the queue at the price shown then.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCancelTarget(null)} className="btn-secondary" style={{ flex: 1, padding: '0.8125rem', justifyContent: 'center', borderRadius: 10 }}>
                Keep my spot
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  flex: 1, padding: '0.8125rem', borderRadius: 10, border: '1px solid rgba(255,107,133,0.4)',
                  background: 'rgba(255,107,133,0.12)', color: '#FF6B85',
                  fontFamily: 'Sora, sans-serif', fontSize: '0.9375rem', fontWeight: 700,
                  cursor: cancelling ? 'default' : 'pointer', opacity: cancelling ? 0.6 : 1,
                }}
              >
                {cancelling ? 'Cancelling…' : 'Cancel pre-order'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 800,
        letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--text-muted)',
        margin: '0 0 11px',
      }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}
