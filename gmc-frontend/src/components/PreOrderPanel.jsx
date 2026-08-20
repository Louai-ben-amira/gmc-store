import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  TbHourglass, TbClipboardList, TbCircleCheck, TbInfoCircle,
  TbUsers, TbLock, TbArrowRight, TbAlertTriangle,
} from 'react-icons/tb'
import { placePreOrder } from '../api/preorders'
import Modal from './Modal'
import TicketStub from './ui/TicketStub'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../store/authStore'
import { formatCurrency } from '../utils/formatters'

/* Pre-orders get their own amber identity, deliberately unlike the purple
   buy button — a client should never mistake one for a normal purchase. */
export const AMBER        = '#FFC84D'
const AMBER_DIM    = 'rgba(255,200,77,0.10)'
const AMBER_BORDER = 'rgba(255,200,77,0.35)'
const SERVICE_FEE_RATE = 0.01

/**
 * The out-of-stock replacement for the buy box: reserve a spot in the queue.
 * Only rendered when the product (or chosen variant) is at zero stock AND the
 * admin enabled pre-orders — see ProductPage.
 */
export default function PreOrderPanel({ product, variant, unverified }) {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const toast    = useToast()
  const { isAuthenticated } = useAuthStore()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading,     setLoading]     = useState(false)

  const mine = product.my_preorder && (
    // A variant product queues per option, so only a matching entry counts
    !product.has_variants || (variant && product.my_preorder.variant === variant.id)
  ) ? product.my_preorder : null

  const needsVariant = product.has_variants && !variant
  const basePrice    = parseFloat(variant ? variant.price : (product.effective_price || product.price))
  const serviceFee   = Math.round(basePrice * SERVICE_FEE_RATE * 100) / 100
  const total        = basePrice + serviceFee
  const queueCount   = product.preorder_queue || 0
  const myPosition   = queueCount + 1

  const openAuth = () => window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))

  const handleClick = () => {
    if (!isAuthenticated()) { openAuth(); return }
    if (needsVariant) { toast.error('Please select an amount to pre-order.'); return }
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const { data } = await placePreOrder({
        product_id: product.id,
        variant_id: variant?.id || null,
      })
      setConfirmOpen(false)
      qc.invalidateQueries({ queryKey: ['product'] })
      qc.invalidateQueries({ queryKey: ['preorders'] })
      toast.success(data.message || `Pre-order placed! You're #${data.queue_position} in queue.`)
      navigate('/preorders')
    } catch (err) {
      const data = err.response?.data
      toast.error(data?.detail || 'Could not place your pre-order.')
      if (data?.error === 'in_stock') qc.invalidateQueries({ queryKey: ['product'] })
    } finally { setLoading(false) }
  }

  /* ── Already in the queue ─────────────────────────────────────────── */
  if (mine) {
    return (
      <div style={{ padding: '1rem 1.5rem' }}>
        <div style={{
          width: '100%', padding: '0.9375rem', borderRadius: 10,
          background: 'rgba(61,220,132,0.10)', border: '1px solid rgba(61,220,132,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'Sora, sans-serif', fontSize: '0.9375rem', fontWeight: 700, color: '#3DDC84',
        }}>
          <TbCircleCheck size={18} />
          Pre-Ordered — You're #{mine.queue_position} in queue
        </div>
        <button
          onClick={() => navigate('/preorders')}
          style={{
            marginTop: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--accent)', padding: 4,
          }}
        >
          View your pre-order <TbArrowRight size={13} />
        </button>
      </div>
    )
  }

  /* ── Pre-order offer ──────────────────────────────────────────────── */
  return (
    <>
      <div style={{ padding: '1rem 1.5rem' }}>
        <div style={{
          background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}`,
          borderRadius: 12, padding: '1rem 1.125rem', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <TbHourglass size={16} color={AMBER} />
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase', color: AMBER,
            }}>
              Pre-Order Available
            </span>
          </div>

          {product.preorder_note && (
            <p style={{
              margin: '0 0 12px', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem',
              lineHeight: 1.6, color: 'var(--text-primary)',
            }}>
              {product.preorder_note}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Row
              label={<><TbLock size={12} style={{ marginRight: 5, verticalAlign: -1 }} />Price locked</>}
              value={formatCurrency(basePrice)}
            />
            {!needsVariant && (
              <Row label="Charged at delivery" value={formatCurrency(total)} strong />
            )}
            <Row
              label={<><TbUsers size={12} style={{ marginRight: 5, verticalAlign: -1 }} />Queue</>}
              value={queueCount === 0 ? 'No one waiting' : `${queueCount} waiting`}
            />
          </div>
        </div>

        <button
          onClick={handleClick}
          disabled={unverified || needsVariant}
          title={unverified ? 'Verify your email to enable pre-orders' : undefined}
          style={{
            width: '100%', padding: '0.9375rem', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${AMBER}, #F0A81E)`, color: '#1A1206',
            fontFamily: 'Sora, sans-serif', fontSize: '1rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: (unverified || needsVariant) ? 'not-allowed' : 'pointer',
            opacity: (unverified || needsVariant) ? 0.5 : 1,
            boxShadow: '0 6px 20px -8px rgba(255,200,77,0.7)', transition: 'opacity 0.15s',
          }}
        >
          <TbClipboardList size={17} />
          {needsVariant ? 'Select an amount first' : 'Pre-Order Now'}
        </button>

        <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'flex-start' }}>
          <TbInfoCircle size={13} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{
            fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem',
            lineHeight: 1.6, color: 'var(--text-muted)',
          }}>
            No payment until your code is ready. Cancel free within 24 hours.
          </span>
        </div>
      </div>

      {/* ── Confirmation ──────────────────────────────────────────────── */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Pre-Order" size="sm">
        <TicketStub
          top={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Product', product.name],
                ...(variant ? [['Amount', variant.label]] : []),
                ['Price locked', formatCurrency(basePrice)],
                ['Service fee', `+${formatCurrency(serviceFee)}`],
                ['Your position', `#${myPosition} in queue`],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
              <div style={{ height: 1, background: 'var(--bg-elevated)', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  Charged when ready
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.125rem', color: AMBER }}>
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          }
          bottom={
            <div style={{
              background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}`,
              borderRadius: 10, padding: '0.75rem 0.875rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                <TbAlertTriangle size={13} color={AMBER} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: AMBER }}>
                  Important
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  'No payment is taken now.',
                  `You'll be charged ${formatCurrency(total)} when your code is ready.`,
                  'Make sure your wallet has enough balance by then.',
                  'Free cancellation within 24 hours.',
                ].map(line => (
                  <li key={line} style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          }
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            onClick={() => setConfirmOpen(false)}
            className="btn-secondary"
            style={{ flex: 1, padding: '0.8125rem', justifyContent: 'center', borderRadius: 10 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '0.8125rem', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${AMBER}, #F0A81E)`, color: '#1A1206',
              fontFamily: 'Sora, sans-serif', fontSize: '0.9375rem', fontWeight: 800,
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Placing…' : 'Confirm Pre-Order'}
          </button>
        </div>
      </Modal>
    </>
  )
}

function Row({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: strong ? '0.9375rem' : '0.8125rem',
        fontWeight: strong ? 800 : 700, color: strong ? AMBER : 'var(--text-primary)',
      }}>
        {value}
      </span>
    </div>
  )
}
