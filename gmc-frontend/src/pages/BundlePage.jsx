import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getBundle } from '../api/products'
import { placeOrder, validatePromo } from '../api/orders'
import Topbar from '../components/Topbar'
import Modal from '../components/Modal'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../store/authStore'
import { formatCurrency, CATEGORY_LABELS, mediaUrl } from '../utils/formatters'
import { ArrowLeft, Package, Shield, Zap, Tag, X, Check } from 'lucide-react'

const CARD_ICONS = { valorant: '', steam: '', epic: '', battle_pass: '⚔️', ooredoo: '', gift_cards: '', other: '' }

export default function BundlePage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const toast      = useToast()

  const [confirmOpen, setConfirmOpen]   = useState(false)
  const [loading, setLoading]           = useState(false)
  const [promoInput,  setPromoInput]    = useState('')
  const [promoResult, setPromoResult]   = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)

  const { data: bundle, isLoading } = useQuery({
    queryKey: ['bundle', id],
    queryFn: () => getBundle(id).then(r => r.data),
  })

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Topbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading bundle...</div>
    </div>
  )
  if (!bundle) return null

  const basePrice     = parseFloat(bundle.bundle_price)
  const originalPrice = parseFloat(bundle.original_price)
  const promoDiscount = promoResult ? parseFloat(promoResult.discount_amount) : 0
  const subtotal      = Math.max(0, basePrice - promoDiscount)
  const serviceFee    = Math.round(subtotal * 0.01 * 100) / 100
  const finalPrice    = subtotal + serviceFee

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    try {
      const { data } = await validatePromo({ code: promoInput.trim(), price: basePrice })
      setPromoResult(data)
      toast.success(`Promo applied: -${data.discount_amount} DT saved!`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid promo code.')
      setPromoResult(null)
    } finally {
      setPromoLoading(false)
    }
  }

  const openAuth = () => window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))

  const handleBuy = async () => {
    if (!isAuthenticated()) { openAuth(); return }
    setLoading(true)
    try {
      await placeOrder({ bundle_id: bundle.id, promo_code: promoResult ? promoResult.code : '' })
      setConfirmOpen(false)
      toast.success('Bundle purchased successfully!')
      navigate('/orders')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Purchase failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', padding: 0, fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--white-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
          >
            <ArrowLeft size={17} /> Back to Shop
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem', animation: 'fadeSlideUp 0.4s ease both' }}>
            {/* Bundle image / products preview */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(123,47,255,0.35)', borderRadius: '1.125rem', overflow: 'hidden', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {bundle.image ? (
                <img src={mediaUrl(bundle.image)} alt={bundle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(bundle.products_detail || []).map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-elevated)', borderRadius: '0.625rem', padding: '0.625rem 0.875rem', border: '1px solid var(--bg-border)' }}>
                      <span style={{ fontSize: '1.5rem' }}>{CARD_ICONS[p.category] || ''}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, color: 'var(--white-primary)', fontSize: '0.875rem', fontWeight: 600 }}>{p.name}</p>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.75rem' }}>{CATEGORY_LABELS[p.category]}</p>
                      </div>
                      <span style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem' }}>{formatCurrency(p.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Purchase panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(123,47,255,0.12)', border: '1px solid rgba(123,47,255,0.3)', color: 'var(--violet-light)', fontSize: '0.6875rem', fontWeight: 700, padding: '3px 12px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                  <Package size={11} /> Bundle Deal
                </span>
                <h1 style={{ margin: '0 0 0.625rem', color: 'var(--white-primary)', fontWeight: 700, fontSize: '1.625rem', lineHeight: 1.2 }}>{bundle.name}</h1>
                {bundle.description && <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>{bundle.description}</p>}
              </div>

              {/* Pricing */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(123,47,255,0.25)', borderRadius: '0.875rem', padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0', borderBottom: '1px solid var(--bg-border)' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Bundle Price</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    {originalPrice > 0 && <span style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', textDecoration: 'line-through' }}>{formatCurrency(originalPrice)}</span>}
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--violet-light)' }}>{formatCurrency(basePrice)}</span>
                    {bundle.discount_percentage > 0 && <span style={{ background: 'rgba(123,47,255,0.2)', color: 'var(--violet-light)', border: '1px solid rgba(123,47,255,0.4)', fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>-{bundle.discount_percentage}%</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Items included</span>
                  <span style={{ color: 'var(--lavender)', fontWeight: 600 }}>{bundle.products_detail?.length || 0} products</span>
                </div>
              </div>

              {/* Promo code */}
              {isAuthenticated() && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '0.875rem', padding: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--lavender)', fontSize: '0.8125rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                    <Tag size={13} /> Promo Code
                  </label>
                  {promoResult ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,255,148,0.08)', border: '1px solid rgba(0,255,148,0.3)', borderRadius: '0.5rem', padding: '0.5rem 0.875rem' }}>
                      <div>
                        <span style={{ color: 'var(--aurora)', fontWeight: 700, fontSize: '0.875rem', fontFamily: 'JetBrains Mono, monospace' }}>{promoResult.code}</span>
                        <span style={{ color: 'var(--success)', fontSize: '0.8125rem', marginLeft: '0.625rem' }}>-{formatCurrency(promoResult.discount_amount)} off</span>
                      </div>
                      <button onClick={() => { setPromoResult(null); setPromoInput('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', display: 'flex' }}><X size={14} /></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleApplyPromo()} placeholder="Enter promo code" style={{ flex: 1, fontSize: '0.875rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }} />
                      <button onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()} className="btn-secondary" style={{ padding: '0 1rem', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{promoLoading ? '...' : 'Apply'}</button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,165,0,0.2)', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {promoDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>Promo discount</span>
                    <span style={{ color: 'var(--success)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>-{formatCurrency(promoDiscount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#f59e0b', fontSize: '0.875rem' }}>Service fee (1%)</span>
                  <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>+{formatCurrency(serviceFee)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--bg-border)' }}>
                  <span style={{ color: 'var(--lavender)', fontSize: '0.875rem', fontWeight: 600 }}>Total</span>
                  <span style={{ color: 'var(--aurora)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{finalPrice.toFixed(2)} DT</span>
                </div>
              </div>

              <button className="btn-primary" style={{ width: '100%', padding: '0.9375rem', fontSize: '1rem', fontWeight: 700, justifyContent: 'center' }} disabled={loading} onClick={() => { if (!isAuthenticated()) { openAuth(); return }; setConfirmOpen(true) }}>
                {loading ? 'Processing...' : `Get Bundle - ${formatCurrency(finalPrice)}`}
              </button>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[{ icon: Zap, text: 'Instant delivery' }, { icon: Shield, text: 'Secure payment' }, { icon: Package, text: 'Multiple codes' }].map(({ icon: Icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Icon size={13} style={{ color: 'var(--violet-light)' }} />
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Bundle Purchase" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {[
            ['Bundle', bundle.name],
            ['Items', `${bundle.products_detail?.length || 0} products`],
            ['Bundle Price', formatCurrency(basePrice)],
            ...(promoDiscount > 0 ? [['Promo Discount', `-${formatCurrency(promoDiscount)}`]] : []),
            ['Service Fee (1%)', `+${formatCurrency(serviceFee)}`],
            ['Total', `${finalPrice.toFixed(2)} DT`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--bg-border)' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{label}</span>
              <span style={{ color: 'var(--white-primary)', fontWeight: 600, fontSize: '0.875rem' }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={() => setConfirmOpen(false)} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-primary" onClick={handleBuy} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>{loading ? 'Processing...' : 'Confirm Purchase'}</button>
        </div>
      </Modal>
    </div>
  )
}

