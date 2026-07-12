import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getProduct, getReviews, submitReview, getReviewEligibility } from '../api/products'
import { placeOrder, validatePromo, revealCode, cancelOrder } from '../api/orders'
import Topbar from '../components/Topbar'
import Modal from '../components/Modal'
import AccountRequiredModal from '../components/AccountRequiredModal'
import TicketStub from '../components/ui/TicketStub'
import Badge from '../components/ui/Badge'
import BlockRating from '../components/ui/BlockRating'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../store/authStore'
import { formatCurrency, mediaUrl } from '../utils/formatters'
import { StarPicker } from '../components/StarRating'
import {
  TbCopy, TbCheck, TbArrowLeft, TbArrowRight, TbX, TbCircleCheck,
  TbShieldCheck, TbBolt, TbStar, TbChevronRight,
  TbLock, TbTrophy, TbCoins, TbCreditCard,
} from 'react-icons/tb'

/* ── Flash countdown ─────────────────────────────────────────────────── */
function useCountdown(endTime) {
  const calc = () => {
    const diff = endTime ? new Date(endTime) - Date.now() : 0
    if (diff <= 0) return null
    return { h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) }
  }
  const [time, setTime] = useState(calc)
  useEffect(() => {
    if (!endTime) return
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [endTime])
  return time
}

/* ── Code modal ──────────────────────────────────────────────────────── */
function CodeModal({ isOpen, onClose, orderId, orderData }) {
  const { t }    = useTranslation('shop')
  const toast    = useToast()
  const qc       = useQueryClient()
  const [step,    setStep]    = useState('locked')  // locked | warn | revealed
  const [code,    setCode]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) { setStep('locked'); setCode(null); setCopied(false) }
  }, [isOpen])

  const handleReveal = async () => {
    setLoading(true)
    try {
      const { data } = await revealCode(orderId)
      setCode(data.code)
      setStep('revealed')
      qc.invalidateQueries({ queryKey: ['orders'] })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not reveal code.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? Your balance will be refunded.')) return
    setCancelLoading(true)
    try {
      await cancelOrder(orderId)
      toast.success('Order cancelled. Balance refunded.')
      qc.invalidateQueries({ queryKey: ['orders'] })
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not cancel order.')
    } finally {
      setCancelLoading(false)
    }
  }

  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('product.codeReady')} size="md">
      <div style={{ textAlign: 'center' }}>

        {step !== 'revealed' ? (
          /* ─ Pre-reveal ─ */
          <div>
            {/* Lock icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0.5rem auto 1.25rem',
              background: 'rgba(124,58,237,0.1)', border: '2px solid rgba(124,58,237,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TbLock size={32} color="var(--accent)" />
            </div>
            <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Your code is ready
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              {orderData && <><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatCurrency(orderData.amount_paid)}</span> paid · </>}
              Code is locked until you reveal it.
            </p>

            {step === 'warn' ? (
              /* Confirmation step */
              <div>
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12, padding: '1rem', marginBottom: '1.25rem', textAlign: 'left',
                }}>
                  <p style={{ margin: '0 0 6px', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.8125rem', color: '#f87171' }}>
                    ⚠️ Read before revealing
                  </p>
                  <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'rgba(248,113,113,0.85)', lineHeight: 1.55 }}>
                    Once you reveal the code, <strong>this order cannot be cancelled or refunded</strong>.
                    Make sure you are ready to use it now.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn-secondary" onClick={() => setStep('locked')} style={{ flex: 1 }}>
                    Go Back
                  </button>
                  <button className="btn-primary" onClick={handleReveal} disabled={loading} style={{ flex: 1, justifyContent: 'center', background: '#7C3AED' }}>
                    {loading ? 'Revealing…' : 'Confirm & Reveal'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={() => setStep('warn')}
                  style={{ width: '100%', justifyContent: 'center', padding: '0.875rem' }}
                >
                  <TbLock size={15} /> Reveal Code
                </button>
                {orderData?.is_refund_eligible && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    style={{
                      width: '100%', padding: '0.625rem', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600,
                    }}
                  >
                    {cancelLoading ? 'Cancelling…' : '✕ Cancel Order & Get Refund'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ─ Post-reveal ─ */
          <div>
            <TicketStub
              top={
                <div>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{t('product.digitalCode')}</p>
                  <code style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', wordBreak: 'break-all', display: 'block', letterSpacing: '0.06em' }}>
                    {code}
                  </code>
                </div>
              }
              bottom={
                orderData && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{t('product.paid')}</p>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>{formatCurrency(orderData.amount_paid)}</span>
                    </div>
                    <Badge variant="accent">{t('product.delivered')}</Badge>
                  </div>
                )
              }
            />
            <button className="btn-primary" onClick={copy} style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem', marginBottom: '0.75rem', padding: '0.75rem' }}>
              {copied ? <><TbCheck size={15} /> {t('product.copied')}</> : <><TbCopy size={15} /> {t('product.copyCode')}</>}
            </button>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', margin: 0 }}>
              {t('product.alsoIn')} <span style={{ color: 'var(--accent)' }}>{t('product.myOrders')}</span>.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Section label ───────────────────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
      {children}
    </p>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function ProductPage() {
  const { t }    = useTranslation('shop')
  const { slug } = useParams()
  const id = slug  // kept for backward-compat with queryKeys below
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const toast    = useToast()
  const qc       = useQueryClient()
  const isRTL    = document.documentElement.dir === 'rtl'

  const [pointsToUse,       setPointsToUse]       = useState(0)
  const [confirmOpen,       setConfirmOpen]       = useState(false)
  const [loading,           setLoading]           = useState(false)
  const [codeModal,         setCodeModal]         = useState({ open: false, orderId: null, order: null })
  const [promoInput,        setPromoInput]        = useState('')
  const [promoResult,       setPromoResult]       = useState(null)
  const [promoLoading,      setPromoLoading]      = useState(false)
  const [credModalOpen,     setCredModalOpen]     = useState(false)
  const [pendingCredentials, setPendingCredentials] = useState(null)
  const [topupModal,        setTopupModal]         = useState({ open: false, phone: '', product: '' })
  const [selectedVariant,   setSelectedVariant]   = useState(null)
  const [quantity,          setQuantity]          = useState(1)
  const [reviewRating,      setReviewRating]      = useState(0)
  const [reviewBody,        setReviewBody]        = useState('')
  const [reviewLoading,     setReviewLoading]     = useState(false)

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id).then(r => r.data),
  })
  // Review endpoints only accept a numeric product id, while the page URL may
  // be a slug — so wait for the product to load and use its real id.
  const productId = product?.id
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => getReviews(productId).then(r => r.data?.results || r.data || []),
    enabled: !!productId,
  })
  const { data: eligibility } = useQuery({
    queryKey: ['review-eligibility', productId],
    queryFn: () => getReviewEligibility(productId).then(r => r.data),
    enabled: !!productId && isAuthenticated(),
  })

  const timer = useCountdown(product?.flash_sale_end)

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Topbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', letterSpacing: '0.05em' }}>
        {t('product.loading')}
      </div>
    </div>
  )
  if (!product) return null

  const flashActive    = product.flash_sale_active
  const activeVariants = (product.variants || []).filter(v => v.is_active)

  // If a variant is selected use its price; else effective_price (or min variant)
  const effectivePrice = selectedVariant
    ? parseFloat(selectedVariant.price)
    : parseFloat(product.effective_price || product.price)
  const originalPrice  = parseFloat(product.price)
  const promoDiscount  = promoResult ? parseFloat(promoResult.discount_amount) : 0
  const maxRedeemable  = user ? Math.min(user.points || 0, Math.floor(effectivePrice * 50)) : 0
  const maxRounded     = Math.floor(maxRedeemable / 100) * 100
  const pointsDiscount = pointsToUse / 100
  const subtotal       = Math.max(0, effectivePrice - promoDiscount - pointsDiscount)
  const serviceFee     = Math.round(subtotal * 0.01 * 100) / 100
  const finalPrice     = subtotal + serviceFee
  const inStock        = activeVariants.length > 0
    ? (selectedVariant ? selectedVariant.stock_count > 0 : activeVariants.some(v => v.stock_count > 0))
    : product.available_stock > 0
  const fmt            = n => String(n).padStart(2, '0')

  // Multi-unit purchases (gift cards, game keys, etc.) — not for services/account
  // orders, which are always a single delivery.
  const hasRequiredFields = product.required_fields?.length > 0
  const allowQuantity  = !product.requires_account && !hasRequiredFields
  const maxQty          = Math.min(20, selectedVariant
    ? selectedVariant.stock_count
    : (activeVariants.length > 0 ? 0 : product.available_stock))
  const qty              = allowQuantity ? Math.min(Math.max(quantity, 1), Math.max(maxQty, 1)) : 1
  const totalFinalPrice = finalPrice * qty

  // Breadcrumb
  const crumbs = [
    product.category_detail?.parent?.name,
    product.category_detail?.name,
    product.name,
  ].filter(Boolean)

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    try {
      const { data } = await validatePromo({ code: promoInput.trim(), price: effectivePrice })
      setPromoResult(data)
      toast.success(`Promo applied: -${data.discount_amount} DT saved!`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid promo code.')
      setPromoResult(null)
    } finally { setPromoLoading(false) }
  }

  const handleSubmitReview = async () => {
    if (reviewRating === 0) return toast.error('Please select a rating.')
    setReviewLoading(true)
    try {
      await submitReview(product.id, { rating: reviewRating, body: reviewBody })
      toast.success('Review submitted!')
      setReviewRating(0); setReviewBody('')
      qc.invalidateQueries({ queryKey: ['reviews', product.id] })
      qc.invalidateQueries({ queryKey: ['review-eligibility', product.id] })
      qc.invalidateQueries({ queryKey: ['product', id] })
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit review.') }
    finally { setReviewLoading(false) }
  }

  const openAuth = () => window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))

  const handleBuyClick = () => {
    if (!isAuthenticated()) { openAuth(); return }
    if (product?.has_variants && !selectedVariant) {
      toast.error('Please select a variant before purchasing.')
      return
    }
    if (hasRequiredFields || product?.requires_account) {
      setCredModalOpen(true)
    } else {
      setConfirmOpen(true)
    }
  }

  const handleCredentialsConfirm = (creds) => {
    setPendingCredentials(creds); setCredModalOpen(false); setConfirmOpen(true)
  }

  const handleBuy = async () => {
    if (!isAuthenticated()) { openAuth(); return }
    setLoading(true)
    try {
      const { data: orderData } = await placeOrder({
        product_id:    product.id,
        variant_id:    selectedVariant?.id || null,
        quantity:      qty,
        points_to_use: pointsToUse,
        promo_code:    promoResult ? promoResult.code : '',
        credentials:   pendingCredentials || {},
      })
      const phoneField  = product?.required_fields?.find(f => f.type === 'tel' || f.key === 'phone')
      const phoneNumber = phoneField ? (pendingCredentials?.[phoneField.key] || '') : ''
      setConfirmOpen(false); setPendingCredentials(null)
      qc.invalidateQueries({ queryKey: ['pending-reviews'] })
      if (phoneField) {
        setTopupModal({ open: true, phone: phoneNumber, product: product.name })
      } else if (orderData.requires_account) {
        toast.success('Order placed! Check your chat.'); navigate('/orders')
      } else if (Array.isArray(orderData.orders)) {
        setQuantity(1)
        toast.success(`${orderData.count} orders placed! View your codes in Orders.`)
        navigate('/orders')
      } else {
        setCodeModal({ open: true, orderId: orderData.id, order: orderData }); toast.success('Order placed!')
      }
    } catch (err) {
      const msg = err.response?.data?.detail
        || (typeof err.response?.data === 'string' ? err.response.data : null)
        || Object.values(err.response?.data || {}).flat().join(' ')
        || err.message
        || 'Order failed.'
      toast.error(msg)
    }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>

        {/* ── Hero image band ─────────────────────────────── */}
        <div style={{ position: 'relative', width: '100%', height: 320, overflow: 'hidden' }}>
          {product.image ? (
            <img src={mediaUrl(product.image)} alt={product.name} style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: 'brightness(0.55)',
            }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a0a3e, #0B0B12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '7rem', opacity: 0.3 }}>{product.category_detail?.icon || '🎮'}</span>
            </div>
          )}
          {/* gradient overlay bottom */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(11,11,18,0.1) 0%, rgba(11,11,18,0.7) 60%, #0B0B12 100%)' }} />
          {/* gradient overlay left (for text readability) */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(11,11,18,0.8) 0%, transparent 60%)' }} />

          {/* Back button overlaid on hero */}
          <button onClick={() => navigate(-1)} style={{
            position: 'absolute', top: 16,
            ...(isRTL ? { right: 20 } : { left: 20 }),
            background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 500,
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            {isRTL ? <TbArrowRight size={15} /> : <TbArrowLeft size={15} />} {t('product.back')}
          </button>

          {/* Flash sale overlay badge */}
          {flashActive && timer && (
            <div style={{
              position: 'absolute', top: 16, right: 20,
              background: 'rgba(255,77,109,0.15)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,77,109,0.4)', borderRadius: 10,
              padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <TbBolt size={14} color="var(--urgent)" />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem', color: 'var(--urgent)' }}>
                {fmt(timer.h)}:{fmt(timer.m)}:{fmt(timer.s)}
              </span>
            </div>
          )}

          {/* Title overlaid at bottom of hero */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 2rem 1.5rem' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              {/* breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                {crumbs.slice(0, -1).map((c, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c}</span>
                    <TbChevronRight size={10} color="var(--text-primary)" />
                  </span>
                ))}
              </div>
              <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '2rem', color: 'var(--text-primary)', lineHeight: 1.15, margin: '0 0 0.625rem', textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}>
                {product.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <BlockRating value={product.avg_rating || 0} />
                {product.avg_rating ? (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {product.avg_rating} · {product.review_count}
                  </span>
                ) : <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('product.noReviews')}</span>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(61,220,132,0.12)', border: '1px solid rgba(61,220,132,0.25)', borderRadius: 6, padding: '3px 9px' }}>
                  <TbBolt size={11} color="#3DDC84" />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', fontWeight: 600, color: '#3DDC84' }}>{t('product.trustInstant')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main content below hero ──────────────────────── */}
        <div className="product-detail-wrap" style={{ padding: '0 2rem 4rem' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="product-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start', marginTop: '1.5rem' }}>

              {/* ── LEFT COLUMN ──────────────────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Description */}
                {product.description && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
                    <p style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', lineHeight: 1.8, margin: 0 }}>{product.description}</p>
                  </div>
                )}

                {/* HOW IT WORKS */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 1rem' }}>{t('product.howItWorks')}</p>
                  <div className="product-how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
                    {[
                      {
                        n: '1',
                        label: product.has_variants
                          ? t('product.step1Variant')
                          : product.requires_account ? t('product.step1Account') : t('product.step1Default'),
                        Icon: TbCoins, color: '#7C3AED',
                      },
                      { n: '2', label: t('product.step2'), Icon: TbCreditCard, color: '#3DDC84' },
                      {
                        n: '3',
                        label: product.requires_account ? t('product.step3Account') : t('product.step3Code', { name: product.category_detail?.name || 'Code' }),
                        Icon: TbBolt, color: '#f59e0b',
                      },
                    ].map(({ n, label, Icon, color }) => (
                      <div key={n} style={{
                        position: 'relative', overflow: 'hidden',
                        background: `linear-gradient(155deg, ${color}12 0%, ${color}05 60%, transparent 100%)`,
                        border: `1px solid ${color}26`,
                        borderRadius: 12, padding: '1.125rem 1rem 1rem',
                      }}>
                        {/* ghost step number */}
                        <span aria-hidden style={{
                          position: 'absolute', top: -6, insetInlineEnd: 10,
                          fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '2.5rem',
                          lineHeight: 1.3, color: `${color}1f`, userSelect: 'none',
                        }}>{n}</span>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, marginBottom: 12,
                          background: `${color}1c`, border: `1px solid ${color}33`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: `0 4px 14px ${color}22`,
                        }}>
                          <Icon size={19} color={color} />
                        </div>
                        <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.8438rem', color: 'var(--text-primary)', lineHeight: 1.45, margin: 0 }}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trust badges row */}
                <div className="product-trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {[
                    { Icon: TbShieldCheck, label: t('product.trustSecure'),   desc: t('product.trustSecureDesc'),   color: '#7C3AED' },
                    { Icon: TbBolt,        label: t('product.trustInstant'),  desc: t('product.trustInstantDesc'),  color: '#3DDC84' },
                    { Icon: TbTrophy,      label: t('product.trustVerified'), desc: t('product.trustVerifiedDesc'), color: '#f59e0b' },
                  ].map(({ Icon, label, desc, color }) => (
                    <div key={label} style={{ background: 'var(--bg-surface)', border: `1px solid ${color}20`, borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color={color} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{label}</p>
                        <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* REVIEWS */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 1rem' }}>{t('product.reviews')}</p>

                  {isAuthenticated() && eligibility?.can_review && (
                    <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <TbCircleCheck size={14} color="var(--accent)" />
                        <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.07em' }}>{t('product.verifiedPurchase')}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <StarPicker value={reviewRating} onChange={setReviewRating} />
                        <textarea value={reviewBody} onChange={e => setReviewBody(e.target.value)} rows={2}
                          placeholder={t('product.reviewPlaceholder')}
                          style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', lineHeight: 1.6 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button className="btn-primary" onClick={handleSubmitReview}
                            disabled={reviewLoading || reviewRating === 0}
                            style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}>
                            {reviewLoading ? t('product.submitting') : t('product.submitReview')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {reviews.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>{t('product.noReviews')}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {reviews.slice(0, 6).map((r, i) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0.875rem', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', animation: `fadeSlideUp 0.35s ${i * 0.04}s ease both` }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(124,58,237,0.1))', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '0.75rem', color: 'var(--accent)' }}>
                            {(r.username || 'U').slice(0, 1).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{r.username}</span>
                              <div style={{ display: 'flex', gap: 2 }}>
                                {Array(5).fill(0).map((_, si) => (
                                  <TbStar key={si} size={11} fill={si < r.rating ? '#f59e0b' : 'none'} color={si < r.rating ? '#f59e0b' : 'rgba(255,255,255,0.15)'} strokeWidth={1.5} />
                                ))}
                              </div>
                            </div>
                            {r.body && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 3px', lineHeight: 1.5 }}>"{r.body}"</p>}
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                              {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN - purchase panel ────────────── */}
              <div className="product-detail-sidebar" style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

                {/* Variant selector */}
                {activeVariants.length > 0 && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {t('product.selectAmount')}
                      </span>
                      {selectedVariant && (
                        <button onClick={() => setSelectedVariant(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)', letterSpacing: '0.06em', padding: 0 }}>
                          ✕ CLEAR
                        </button>
                      )}
                    </div>

                    {/* Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {activeVariants.map(v => {
                        const active = selectedVariant?.id === v.id
                        return (
                          <button
                            key={v.id}
                            onClick={() => { setSelectedVariant(active ? null : v); setQuantity(1) }}
                            style={{
                              position: 'relative',
                              padding: '0.875rem 0.75rem',
                              borderRadius: 12,
                              border: `1.5px solid ${active ? '#7C3AED' : 'rgba(255,255,255,0.07)'}`,
                              background: active
                                ? 'linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(76,29,149,0.14) 100%)'
                                : 'rgba(255,255,255,0.025)',
                              boxShadow: active
                                ? '0 0 0 3px rgba(124,58,237,0.15), 0 4px 16px rgba(124,58,237,0.2)'
                                : '0 1px 3px rgba(0,0,0,0.2)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'left',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              overflow: 'hidden',
                            }}
                            onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.45)'; e.currentTarget.style.background = 'rgba(124,58,237,0.07)' } }}
                            onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.025)' } }}
                          >
                            {/* Selected checkmark */}
                            {active && (
                              <span style={{
                                position: 'absolute', top: 7, right: 7,
                                width: 18, height: 18, borderRadius: '50%',
                                background: 'linear-gradient(135deg,#7C3AED,#9B4FED)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(124,58,237,0.5)',
                              }}>
                                <TbCheck size={11} color="#fff" strokeWidth={3} />
                              </span>
                            )}

                            {/* Label */}
                            <span style={{
                              fontFamily: 'Sora, sans-serif',
                              fontSize: '0.8125rem',
                              fontWeight: active ? 700 : 600,
                              color: active ? '#C4B5FD' : 'var(--text-primary)',
                              lineHeight: 1.3,
                              paddingRight: active ? 20 : 0,
                            }}>{v.label}</span>

                            {/* Price — always visible */}
                            <span style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: '0.8125rem',
                              fontWeight: 800,
                              color: active ? '#A78BFA' : 'rgba(255,255,255,0.35)',
                              letterSpacing: '-0.01em',
                            }}>
                              {parseFloat(v.price).toFixed(2)}<span style={{ fontSize: '0.625rem', marginLeft: 2, fontWeight: 600 }}>DT</span>
                            </span>

                            {/* Active bottom bar */}
                            {active && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                                background: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
                              }} />
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Selection hint */}
                    {!selectedVariant && (
                      <p style={{ margin: '0.75rem 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                        👆 Pick a package to see the price
                      </p>
                    )}
                  </div>
                )}

                {/* Price card */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                  {/* Price header */}
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {activeVariants.length > 0 && !selectedVariant ? (
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {t('product.selectAmount')}
                      </span>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: flashActive ? 6 : 0 }}>
                          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '2.25rem', color: flashActive ? 'var(--urgent)' : 'var(--success)', letterSpacing: '-0.02em' }}>
                            {formatCurrency(effectivePrice)}
                          </span>
                          {flashActive && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatCurrency(originalPrice)}</span>}
                        </div>
                        {flashActive && timer && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <TbBolt size={12} color="var(--urgent)" />
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--urgent)', fontWeight: 700 }}>
                              {t('product.flashEnds', { time: `${fmt(timer.h)}:${fmt(timer.m)}:${fmt(timer.s)}` })}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Quantity stepper — multi-unit digital codes only */}
                  {allowQuantity && maxQty > 1 && !(activeVariants.length > 0 && !selectedVariant) && (
                    <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {t('product.quantity', 'Quantity')}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={qty <= 1}
                          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: qty <= 1 ? 'default' : 'pointer', opacity: qty <= 1 ? 0.4 : 1, fontSize: '1rem', lineHeight: 1 }}>
                          −
                        </button>
                        <input
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          value={quantity === '' ? '' : qty}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '')
                            if (digits === '') { setQuantity(''); return }
                            const n = Math.min(maxQty, Math.max(1, parseInt(digits, 10)))
                            setQuantity(n)
                            if (n > 1) setPointsToUse(0)
                          }}
                          onBlur={() => setQuantity(qty)}
                          style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', width: 44, textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 2px', outline: 'none' }}
                        />
                        <button type="button" onClick={() => { setQuantity(q => Math.min(maxQty, q + 1)); setPointsToUse(0) }} disabled={qty >= maxQty}
                          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: qty >= maxQty ? 'default' : 'pointer', opacity: qty >= maxQty ? 0.4 : 1, fontSize: '1rem', lineHeight: 1 }}>
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Line items if discounts active */}
                  {(promoDiscount > 0 || pointsToUse > 0 || qty > 1) && !(activeVariants.length > 0 && !selectedVariant) && (
                    <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {qty > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{formatCurrency(effectivePrice)} × {qty}</span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{formatCurrency(effectivePrice * qty)}</span>
                        </div>
                      )}
                      {promoDiscount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('product.promoLabel', { code: promoResult.code })}</span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', color: 'var(--success)' }}>-{formatCurrency(promoDiscount * qty)}</span>
                        </div>
                      )}
                      {pointsToUse > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('product.pointsLabel', { count: pointsToUse })}</span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', color: 'var(--success)' }}>-{formatCurrency(pointsDiscount)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#f59e0b' }}>{t('product.serviceFee')}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', color: '#f59e0b' }}>+{formatCurrency(serviceFee * qty)}</span>
                      </div>
                      <div style={{ height: 1, background: 'var(--bg-elevated)', margin: '2px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t('product.total')}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.125rem', color: 'var(--accent)' }}>{formatCurrency(totalFinalPrice)}</span>
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <div style={{ padding: '1rem 1.5rem' }}>
                    <button
                      className="btn-primary"
                      style={{ width: '100%', padding: '0.9375rem', fontSize: '1rem', fontWeight: 700, justifyContent: 'center', borderRadius: 10 }}
                      disabled={!inStock || loading}
                      onClick={handleBuyClick}
                    >
                      {!inStock ? t('product.outOfStock') : loading ? t('product.processing') : `⚡ ${t('product.confirmPurchase')}${qty > 1 ? ` (${qty})` : ''}`}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                      <TbLock size={11} color="var(--text-primary)" />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{t('product.encrypted')}</span>
                    </div>
                  </div>
                </div>

                {/* Promo code */}
                {isAuthenticated() && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.25rem' }}>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.625rem' }}>{t('product.promoCode')}</p>
                    {promoResult ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)' }}>{promoResult.code}</span>
                        <button onClick={() => { setPromoResult(null); setPromoInput('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                          <TbX size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
                          placeholder="GMC10"
                          style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', letterSpacing: '0.04em', height: 36 }}
                        />
                        <button onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()} className="btn-secondary"
                          style={{ padding: '0 0.875rem', whiteSpace: 'nowrap', fontSize: '0.8125rem', height: 36 }}>
                          {promoLoading ? '…' : t('product.promoApply')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Points slider - only shown when admin enabled points for this product (single-unit purchases only) */}
                {isAuthenticated() && user && maxRounded > 0 && product.points_purchasable && qty === 1 && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.25rem' }}>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.625rem' }}>{t('product.redeemPoints')}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('product.balancePts', { count: user.points || 0 })}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--accent)' }}>
                        {pointsToUse} pts = -{formatCurrency(pointsDiscount)}
                      </span>
                    </div>
                    <input type="range" min={0} max={maxRounded} step={100} value={pointsToUse}
                      onChange={e => setPointsToUse(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('product.confirmPurchase')} size="sm">
        <TicketStub
          top={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                [t('product.labelProduct'), product.name],
                ...(selectedVariant ? [[t('product.labelVariant'), selectedVariant.label]] : []),
                ...(qty > 1 ? [[t('product.quantity', 'Quantity'), String(qty)]] : []),
                [t('product.labelPrice'), formatCurrency(effectivePrice)],
                ...(promoDiscount > 0 ? [[t('product.labelPromo'), `-${formatCurrency(promoDiscount * qty)}`]] : []),
                ...(pointsToUse > 0 ? [[t('product.labelPoints'), `-${pointsToUse} pts`]] : []),
                [t('product.serviceFee'), `+${formatCurrency(serviceFee * qty)}`],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          }
          bottom={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>{t('product.total')}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent)' }}>
                {formatCurrency(totalFinalPrice)}
              </span>
            </div>
          }
        />
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button className="btn-secondary" onClick={() => setConfirmOpen(false)} style={{ flex: 1 }}>{t('product.cancel')}</button>
          <button className="btn-primary" onClick={handleBuy} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
            {loading ? t('product.processing') : t('product.confirmPurchaseBtn')}
          </button>
        </div>
      </Modal>

      <CodeModal
        isOpen={codeModal.open}
        onClose={() => { setCodeModal({ open: false, orderId: null, order: null }); navigate('/orders') }}
        orderId={codeModal.orderId}
        orderData={codeModal.order}
      />

      {credModalOpen && (
        <AccountRequiredModal product={product} onConfirm={handleCredentialsConfirm} onCancel={() => setCredModalOpen(false)} />
      )}

      {/* Topup success modal */}
      {topupModal.open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
          background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(52,211,153,0.25)',
            borderTop: '3px solid #34D399',
            borderRadius: 16,
            padding: '2rem 1.75rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
            animation: 'fadeSlideUp 0.28s ease both',
            textAlign: 'center',
          }}>
            {/* Animated check icon */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(52,211,153,0.12)',
              border: '2px solid rgba(52,211,153,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TbCircleCheck size={36} color="#34D399" />
            </div>

            <div>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                Order Confirmed!
              </p>
              <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {topupModal.product}
              </p>
            </div>

            {/* Phone number display */}
            <div style={{
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.2)',
              borderRadius: 10, padding: '0.75rem 1.25rem',
              width: '100%',
            }}>
              <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#34D399', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                Sending to
              </p>
              <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                {topupModal.phone || '-'}
              </p>
            </div>

            {/* Waiting message */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10, padding: '0.875rem 1rem',
              width: '100%',
            }}>
              <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                Your forfait will be sent to your number <strong style={{ color: 'var(--text-primary)' }}>very soon</strong>.
                Please wait a few minutes - do not re-order.
              </p>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
              onClick={() => { setTopupModal({ open: false, phone: '', product: '' }); navigate('/orders') }}
            >
              View My Orders
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}




