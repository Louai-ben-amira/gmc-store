import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useBasketStore, { selectTotalPrice, selectTotalPoints } from '../store/basketStore'
import { basketCheckout, validatePromo } from '../api/orders'
import { getWallet } from '../api/wallet'
import useAuthStore from '../store/authStore'
import Topbar from '../components/Topbar'
import { useToast } from '../hooks/useToast'
import { mediaUrl } from '../utils/formatters'
import { TbShoppingBag, TbLock, TbX, TbAlertTriangle } from 'react-icons/tb'

const fieldStyle = {
  width: '100%', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
  borderRadius: 7, padding: '8px 12px', color: 'var(--text-primary)',
  outline: 'none',
}

function FieldInput({ field, value, onChange }) {
  const { key, label, type = 'text', placeholder } = field
  const common = {
    value: value || '',
    onChange: e => onChange(key, e.target.value),
    placeholder: placeholder || label,
  }
  if (type === 'textarea') return <textarea {...common} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
  return <input type={type} {...common} style={{ ...fieldStyle, height: 38 }} />
}

// Inline per-item credentials form (adapted from AccountRequiredModal.jsx)
function InlineCredentialsForm({ item, onChange }) {
  const fields = item.required_fields || []
  if (fields.length === 0) return null
  return (
    <div style={{ marginTop: 10, padding: '0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TbLock size={12} color="var(--accent)" />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account details required</span>
      </div>
      {fields.map(f => (
        <div key={f.key}>
          <label style={{ display: 'block', marginBottom: 4, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {f.label}{f.required && <span style={{ color: 'var(--urgent)', marginLeft: 3 }}>*</span>}
          </label>
          <FieldInput field={f} value={item.credentials?.[f.key]} onChange={(k, v) => onChange(item.id, { [k]: v })} />
        </div>
      ))}
    </div>
  )
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const items = useBasketStore(s => s.items)
  const setCredentials = useBasketStore(s => s.setCredentials)
  const clearBasket = useBasketStore(s => s.clearBasket)
  const totalPrice = useBasketStore(selectTotalPrice)
  const totalPointsEarned = useBasketStore(selectTotalPoints)

  const [pointsToUse, setPointsToUse] = useState(0)
  const [promoInput, setPromoInput] = useState('')
  const [promoResult, setPromoResult] = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => getWallet().then(r => r.data),
  })

  const maxRedeemable = user ? Math.min(user.points || 0, Math.floor(totalPrice * 50)) : 0
  const maxRounded = Math.floor(maxRedeemable / 100) * 100
  const promoDiscount = promoResult ? parseFloat(promoResult.discount_amount) : 0
  const pointsDiscount = pointsToUse / 100
  const remaining = Math.max(0, totalPrice - promoDiscount - pointsDiscount)
  const currentBalance = parseFloat(walletData?.balance || 0)
  const balanceAfter = currentBalance - remaining

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    try {
      const { data } = await validatePromo({ code: promoInput.trim(), price: totalPrice })
      setPromoResult(data)
      toast.success(`Promo applied: -${data.discount_amount} DT`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid promo code.')
      setPromoResult(null)
    } finally { setPromoLoading(false) }
  }

  const handleConfirm = async () => {
    setError('')
    // Validate required credentials are filled
    for (const item of items) {
      if (item.requires_account) {
        for (const f of (item.required_fields || [])) {
          if (f.required && !item.credentials?.[f.key]?.trim()) {
            toast.error(`Please fill "${f.label}" for ${item.product_name}`)
            return
          }
        }
      }
    }
    setLoading(true)
    try {
      const payload = {
        items: items.map(i => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
          credentials: i.credentials || {},
        })),
        points_to_use: pointsToUse,
        promo_code: promoResult ? promoResult.code : '',
      }
      const { data } = await basketCheckout(payload)
      clearBasket()
      navigate('/checkout/success', { state: { orders: data.orders || [], failed_items: data.failed_items || [] } })
    } catch (err) {
      const msg = err.response?.data?.detail
        || Object.values(err.response?.data || {}).flat().join(' ')
        || 'Checkout failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
        <Topbar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <TbShoppingBag size={40} color="rgba(255,255,255,0.2)" />
          <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-muted)' }}>Your basket is empty.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Continue Shopping</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />
      <div className="pb-nav" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
          <h1 style={{ margin: '0 0 1.25rem', fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Checkout</h1>

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
            {items.map(item => (
              <div key={item.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.125rem' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#181825', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.thumbnail
                      ? <img src={mediaUrl(item.thumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <TbShoppingBag size={18} color="rgba(255,255,255,0.2)" />
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{item.product_name}</p>
                    {item.variant_label && <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.variant_label}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty {item.quantity}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)' }}>{(item.price * item.quantity).toFixed(2)} DT</span>
                    </div>
                  </div>
                </div>
                {item.requires_account && (
                  <InlineCredentialsForm item={item} onChange={setCredentials} />
                )}
              </div>
            ))}
          </div>

          {/* Promo code */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.125rem', marginBottom: '1rem' }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.625rem' }}>Promo Code</p>
            {promoResult ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--accent)' }}>{promoResult.code}</span>
                <button onClick={() => { setPromoResult(null); setPromoInput('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><TbX size={14} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="GMC10" style={{ flex: 1, height: 36 }} />
                <button onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()} className="btn-secondary">{promoLoading ? '…' : 'Apply'}</button>
              </div>
            )}
          </div>

          {/* Points slider */}
          {user && maxRounded > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.125rem', marginBottom: '1rem' }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.625rem' }}>Redeem Points</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Balance: {user.points || 0} pts</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--accent)' }}>{pointsToUse} pts = -{pointsDiscount.toFixed(2)} DT</span>
              </div>
              <input type="range" min={0} max={maxRounded} step={100} value={pointsToUse} onChange={e => setPointsToUse(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          )}

          {/* Breakdown */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.125rem', marginBottom: '1.25rem' }}>
            {[
              ['Current balance', `${currentBalance.toFixed(2)} DT`],
              ['Order total', `-${remaining.toFixed(2)} DT`],
              ['Points earned', `+${totalPointsEarned} pts`],
            ].map(([label, value], i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>Remaining</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.0625rem', color: balanceAfter >= 0 ? 'var(--accent)' : 'var(--urgent)' }}>{balanceAfter.toFixed(2)} DT</span>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <TbAlertTriangle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#f87171' }}>{error}</span>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={loading || user?.is_email_verified === false}
            title={user?.is_email_verified === false ? 'Verify your email to enable purchases' : undefined}
            style={{
              width: '100%', justifyContent: 'center', padding: '0.9375rem', fontSize: '1rem',
              ...(user?.is_email_verified === false ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            }}
          >
            {loading ? 'Processing…' : `Confirm Order — ${remaining.toFixed(2)} DT`}
          </button>
        </div>
      </div>
    </div>
  )
}
