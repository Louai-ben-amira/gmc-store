import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  TbShoppingBag, TbPackage, TbHeart,
  TbChevronLeft, TbChevronRight, TbFlame, TbStar, TbArrowRight,
  TbHeartFilled, TbBrandWhatsapp, TbBrandMessenger, TbBrandInstagram,
} from 'react-icons/tb'
import {
  getProducts, getBundles, toggleWishlist,
  getRecommendations, getCategories, getBestSellers
} from '../api/products'
import { getPublicHeroSlides } from '../api/admin'
import api from '../api/index'
import { formatCurrency, mediaUrl } from '../utils/formatters'
import Topbar from '../components/Topbar'
import AnnouncementBar from '../components/AnnouncementBar'
import Footer from '../components/Footer'
import Badge from '../components/ui/Badge'
import BlockRating from '../components/ui/BlockRating'
import ProductCard from '../components/ProductCard'
import useAuthStore from '../store/authStore'
import { useToast } from '../hooks/useToast'

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

/* ── Wishlist button ─────────────────────────────────────────────────── */
function WishlistBtn({ product, isAuthenticated }) {
  const qc = useQueryClient(); const toast = useToast()
  const [on, setOn] = useState(product.is_wishlisted); const [busy, setBusy] = useState(false)
  if (!isAuthenticated) return null
  const handle = async (e) => {
    e.stopPropagation(); if (busy) return; setBusy(true)
    try { const { data } = await toggleWishlist(product.id); setOn(data.wishlisted); qc.invalidateQueries({ queryKey: ['wishlist'] }) }
    catch { toast.error('Could not update wishlist') }
    setBusy(false)
  }
  return (
    <button onClick={handle} style={{
      position: 'absolute', top: 8, left: 8, zIndex: 4, width: 28, height: 28, borderRadius: 6,
      background: on ? 'var(--urgent)' : 'rgba(11,15,20,0.75)', border: `1px solid ${on ? 'var(--urgent-border)' : 'var(--border-strong)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.15s',
    }}>
      {on ? <TbHeartFilled size={12} color="var(--text-primary)" /> : <TbHeart size={12} color="var(--text-muted)" />}
    </button>
  )
}

/* ProductCard is imported from components/ProductCard.jsx */

/* ── GMC Gift Card Batch Card ────────────────────────────────────────── */
function GmcGiftCardBatch({ batch }) {
  const available = batch.cards_available ?? 0
  const total     = batch.cards_total ?? batch.quantity ?? 0
  const usedPct   = total > 0 ? Math.round(((total - available) / total) * 100) : 0
  const expiry    = batch.expires_at ? new Date(batch.expires_at) : null
  const expired   = expiry && expiry < new Date()

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid rgba(124,58,237,0.2)',
      borderRadius: 14,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(124,58,237,0.25)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 140, background: 'rgba(124,58,237,0.08)', overflow: 'hidden' }}>
        {batch.image
          ? <img src={mediaUrl(batch.image)} alt={batch.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🎁</div>
        }
        {/* Amount badge */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          border: '1px solid rgba(124,58,237,0.4)',
          borderRadius: 8, padding: '4px 10px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', fontWeight: 700,
          color: '#B57BFF',
        }}>
          {parseFloat(batch.amount).toFixed(2)} DT
        </div>
        {expired && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: '#F87171' }}>EXPIRED</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '0.875rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
          {batch.label || `GMC Gift Card ${parseFloat(batch.amount).toFixed(0)} DT`}
        </p>

        {/* Stock bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {available} available
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {usedPct}% used
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${usedPct}%`, background: usedPct > 80 ? '#F87171' : '#7C3AED', transition: 'width 0.4s' }} />
          </div>
        </div>

        {expiry && (
          <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: expired ? '#F87171' : 'var(--text-muted)' }}>
            Expires {expiry.toLocaleDateString()}
          </p>
        )}

        <div style={{
          marginTop: 'auto', paddingTop: 8,
          fontFamily: 'Inter, sans-serif', fontSize: '0.75rem',
          color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          Redeem in <strong style={{ color: 'var(--text-primary)' }}>Wallet → Redeem Gift Card</strong>
        </div>
      </div>
    </div>
  )
}

/* ── Bundle Card ─────────────────────────────────────────────────────── */
function BundleCard({ bundle, index = 0 }) {
  const navigate = useNavigate()
  const { t } = useTranslation('shop')
  const disc = bundle.discount_percentage
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border)', animation: `fadeSlideUp 0.35s ${index * 0.06}s ease both`, transition: 'transform 0.16s, border-color 0.15s, box-shadow 0.16s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.45)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
      onClick={() => navigate(`/bundle/${bundle.id}`)}
    >
      <div style={{ height: 140, overflow: 'hidden', position: 'relative', background: 'var(--bg-elevated)' }}>
        {bundle.image
          ? <img src={mediaUrl(bundle.image)} alt={bundle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {(bundle.products_detail || []).slice(0, 3).map((p, i) => <span key={i} style={{ fontSize: '2.25rem' }}>{p.category_detail?.icon || '🎮'}</span>)}
            </div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(18,24,33,0.9) 100%)' }} />
        <div style={{ position: 'absolute', top: 8, right: 8 }}>{disc > 0 && <Badge variant="accent">−{disc}%</Badge>}</div>
        <div style={{ position: 'absolute', bottom: 8, left: 8 }}><Badge variant="muted">{bundle.products?.length || bundle.products_detail?.length || 0} ITEMS</Badge></div>
      </div>
      <div style={{ padding: '0.875rem' }}>
        <p style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.9375rem' }}>{bundle.name}</p>
        {bundle.description && <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{bundle.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {parseFloat(bundle.original_price) > 0 && <span style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatCurrency(bundle.original_price)}</span>}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'var(--success)' }}>{formatCurrency(bundle.bundle_price)}</span>
          </div>
          <button className="btn-primary" style={{ padding: '5px 14px', fontSize: '0.8125rem' }} onClick={e => { e.stopPropagation(); navigate(`/bundle/${bundle.id}`) }}>{t('product.getBundle')}</button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   HERO SLIDER
══════════════════════════════════════════════════════════════════════ */
const HERO_SLIDES = [
  {
    id: 1,
    tag: '🎉 SUMMER SALE 2025',
    title: 'Top Up.\nPlay More.',
    sub: 'Best prices in Tunisia - Instant delivery on all digital products',
    badge: 'UP TO 67% OFF',
    cta: 'Shop Now',
    ctaSecondary: 'Flash Deals',
    bg: 'linear-gradient(135deg, #0f0a1e 0%, #1a0f3e 35%, #0f1e3e 70%, #081428 100%)',
    accent: '#7C3AED',
    accentGlow: 'rgba(124,58,237,0.45)',
    decoration: ['🎮', '🎁', '🃏', '⚡'],
    stats: [{ v: '60s', l: 'Delivery' }, { v: '5K+', l: 'Orders' }, { v: '4.9★', l: 'Rating' }],
  },
  {
    id: 2,
    tag: '⚡ NEW STOCK',
    title: 'FC 26 Accounts\nNow Available',
    sub: 'All platforms · All ranks · Instant credentials delivery',
    badge: 'FRESH ACCOUNTS',
    cta: 'Get FC 26',
    ctaSecondary: 'All Accounts',
    bg: 'linear-gradient(135deg, #061412 0%, #0a2416 35%, #0d3020 70%, #061412 100%)',
    accent: '#3DDC84',
    accentGlow: 'rgba(61,220,132,0.4)',
    decoration: ['⚽', '🏆', '🎮', '👑'],
    stats: [{ v: 'Global', l: 'All regions' }, { v: 'Safe', l: 'Guaranteed' }, { v: 'Fast', l: 'Under 1 min' }],
  },
  {
    id: 3,
    tag: '🎁 GIFT CARDS',
    title: 'Steam · PSN · Xbox\nAll Platforms',
    sub: 'Global · USA · Europe · Turkey - Every region covered',
    badge: 'IN STOCK NOW',
    cta: 'Buy Gift Cards',
    ctaSecondary: 'View Bundles',
    bg: 'linear-gradient(135deg, #080f1e 0%, #0a1832 35%, #0c2048 70%, #080f1e 100%)',
    accent: '#1b9aee',
    accentGlow: 'rgba(27,154,238,0.4)',
    decoration: ['🎁', '💳', '🎮', '🌍'],
    stats: [{ v: '10+', l: 'Platforms' }, { v: 'All', l: 'Regions' }, { v: 'Instant', l: 'Delivery' }],
  },
  {
    id: 4,
    tag: '📶 TELECOM',
    title: 'Internet Packages\nAll Operators',
    sub: 'Ooredoo · Orange · Tunisie Telecom - Activate in seconds',
    badge: 'INSTANT ACTIVATION',
    cta: 'Get Package',
    ctaSecondary: 'Compare Plans',
    bg: 'linear-gradient(135deg, #120d00 0%, #211800 35%, #2e2200 70%, #120d00 100%)',
    accent: '#f59e0b',
    accentGlow: 'rgba(245,158,11,0.4)',
    decoration: ['📶', '📱', '💻', '🔋'],
    stats: [{ v: '3', l: 'Operators' }, { v: 'Auto', l: 'Activation' }, { v: '24/7', l: 'Support' }],
  },
]

function HeroSlider({ onFlashClick, onBundlesClick }) {
  const navigate        = useNavigate()
  const [idx, setIdx]   = useState(0)
  const [anim, setAnim] = useState(true)
  const timerRef        = useRef(null)

  const { data: heroData } = useQuery({
    queryKey: ['public-hero-slides'],
    queryFn: () => getPublicHeroSlides().then(r => r.data),
    staleTime: 60000,
  })
  const dynamicSlides = (() => {
    try {
      const parsed = heroData?.slides || []
      return parsed.filter(s => s.image || s.title)
    } catch { return [] }
  })()
  const slides = dynamicSlides.length > 0
    ? dynamicSlides.map((s, i) => ({
        ...HERO_SLIDES[i % HERO_SLIDES.length],
        title:    s.title    || '',
        sub:      s.subtitle || '',
        cta:      s.cta_text || '',
        _ctaLink: s.cta_link || '',
        _bgImage: s.image    || '',
        id: i + 1,
      }))
    : HERO_SLIDES

  const goTo = (next) => {
    clearTimeout(timerRef.current)
    setAnim(false)
    setTimeout(() => { setIdx(next % slides.length); setAnim(true) }, 180)
  }
  const prev = () => goTo((idx - 1 + slides.length) % slides.length)
  const next = () => goTo((idx + 1) % slides.length)

  useEffect(() => { if (idx >= slides.length) setIdx(0) }, [slides.length])
  useEffect(() => {
    timerRef.current = setTimeout(next, 5500)
    return () => clearTimeout(timerRef.current)
  }, [idx, slides.length])

  const s = slides[idx] || slides[0]

  return (
    <div className="hero-slider-wrap" style={{
      position: 'relative', borderRadius: 20, overflow: 'hidden',
      marginBottom: '2rem', minHeight: 320,
      background: s._bgImage ? '#0a0a14' : s.bg,
    }}>
      {s._bgImage && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${s._bgImage})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: anim ? 1 : 0, transition: 'opacity 0.3s ease',
        }} />
      )}
      <div className="hero-spacer" style={{ height: 340 }} />

      {/* Slide content overlay */}
      {(s.title || s.sub || s.cta) && (
        <div className="hero-content-overlay" style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '2rem 2.5rem',
          background: s._bgImage ? 'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 100%)' : 'transparent',
          opacity: anim ? 1 : 0, transition: 'opacity 0.3s ease',
        }}>
          {s.title && (
            <h2 style={{
              fontFamily: 'Sora, sans-serif', fontWeight: 900, margin: '0 0 0.5rem',
              fontSize: 'clamp(1.4rem, 4vw, 2.25rem)', color: '#fff',
              whiteSpace: 'pre-line', textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              maxWidth: 520,
            }}>{s.title}</h2>
          )}
          {s.sub && (
            <p style={{
              fontFamily: 'Inter, sans-serif', margin: '0 0 1.25rem',
              fontSize: 'clamp(0.8rem, 2vw, 1rem)', color: 'rgba(255,255,255,0.75)',
              maxWidth: 420, textShadow: '0 1px 6px rgba(0,0,0,0.4)',
            }}>{s.sub}</p>
          )}
          {s.cta && (
            <button
              onClick={() => {
                const link = s._ctaLink || ''
                if (link.startsWith('http')) { window.open(link, '_blank') }
                else if (link) { navigate(link) }
              }}
              style={{
                alignSelf: 'flex-start', padding: '0.6rem 1.4rem',
                background: s.accent || '#7C3AED', border: 'none', borderRadius: 10,
                color: '#fff', fontFamily: 'Sora, sans-serif', fontWeight: 700,
                fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '0.01em',
                boxShadow: `0 4px 20px ${s.accentGlow || 'rgba(124,58,237,0.45)'}`,
                transition: 'transform 0.13s, box-shadow 0.13s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 24px ${s.accentGlow || 'rgba(124,58,237,0.6)'}` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 20px ${s.accentGlow || 'rgba(124,58,237,0.45)'}` }}
            >
              {s.cta}
            </button>
          )}
        </div>
      )}

      {[{ fn: prev, pos: { left: 14 }, Icon: TbChevronLeft }, { fn: next, pos: { right: 14 }, Icon: TbChevronRight }].map(({ fn, pos, Icon }, i) => (
        <button key={i} onClick={fn} className="hero-nav-btn" style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)', ...pos, zIndex: 10,
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-secondary)',
          backdropFilter: 'blur(8px)', transition: 'all 0.13s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
        >
          <Icon size={16} strokeWidth={2.5} />
        </button>
      ))}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.08)', zIndex: 10 }}>
        <div style={{ height: '100%', background: s.accent, width: `${(idx + 1) / slides.length * 100}%`, transition: 'width 0.4s ease, background 0.6s ease', boxShadow: `0 0 8px ${s.accentGlow}` }} />
      </div>

      <div style={{ position: 'absolute', bottom: 18, right: 20, zIndex: 10, display: 'flex', gap: 6 }}>
        {slides.map((sl, i) => (
          <button key={sl.id} onClick={() => goTo(i)} style={{
            width: i === idx ? 20 : 6, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
            background: i === idx ? s.accent : 'var(--text-muted)',
            transition: 'all 0.25s ease',
            boxShadow: i === idx ? `0 0 8px ${s.accentGlow}` : 'none',
          }} />
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   CATEGORY SECTION - dynamic from API
══════════════════════════════════════════════════════════════════════ */

/* fallback palette when category has no color set */
const CAT_COLORS = [
  '#7C3AED','#ef4444','#3DDC84','#f59e0b','#1b9aee','#ff4d6d',
  '#10B981','#6366F1','#EC4899','#F97316','#06B6D4','#8B5CF6',
]
function catColor(cat, idx) {
  return cat.color || CAT_COLORS[idx % CAT_COLORS.length]
}

function CategorySection({ onCategoryClick, onFlashClick }) {
  const { data: rootCats = [], isLoading } = useQuery({
    queryKey: ['categories', 'root'],
    queryFn: () => getCategories({ parent: 'root' }).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.results ?? [])
    }),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
        <div style={{ width: 3, height: 22, borderRadius: 2, background: 'linear-gradient(to bottom, #7C3AED, #1b9aee)' }} />
        <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Browse Categories</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginLeft: 4 }}>ALL PRODUCTS</span>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="cat-grid">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 14 }} />
          ))}
        </div>
      )}

      {/* Cards grid */}
      {!isLoading && rootCats.length > 0 && (
        <div className="cat-grid">
          {rootCats.map((cat, i) => {
            const color = catColor(cat, i)
            const glow  = color + '38'
            const bg    = `linear-gradient(135deg, ${color}12 0%, ${color}04 100%)`
            const border = color + '28'
            return (
              <div
                key={cat.slug}
                onClick={() => onCategoryClick(cat.slug)}
                style={{
                  background: bg, border: `1px solid ${border}`,
                  borderRadius: 14, padding: '1.25rem 1rem 1rem',
                  cursor: 'pointer', textAlign: 'center',
                  transition: 'transform 0.16s, box-shadow 0.16s, border-color 0.15s',
                  position: 'relative', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  animation: `fadeSlideUp 0.35s ${i * 0.05}s ease both`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = `0 16px 40px ${glow}`
                  e.currentTarget.style.borderColor = color
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = border
                }}
              >
                {/* Glow blob */}
                <div style={{
                  position: 'absolute', top: -24, right: -24, width: 90, height: 90,
                  borderRadius: '50%', background: glow, filter: 'blur(32px)',
                  pointerEvents: 'none', opacity: 0.20,
                }} />

                {/* Emoji / icon */}
                <div style={{
                  width: 58, height: 58, borderRadius: 16, marginBottom: '0.75rem', marginTop: '0.25rem',
                  background: `linear-gradient(135deg, ${color}20, ${color}08)`,
                  border: `1px solid ${color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 6px 18px ${glow}`,
                  fontSize: '1.75rem', lineHeight: 1,
                }}>
                  {cat.icon || '📦'}
                </div>

                {/* Label */}
                <p style={{
                  margin: '0 0 4px', fontFamily: 'Sora, sans-serif', fontWeight: 700,
                  fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.25,
                }}>
                  {cat.name}
                </p>

                {/* Child count */}
                {cat.children?.length > 0 && (
                  <p style={{
                    margin: '0 0 10px', fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.5625rem', color: color + '90', letterSpacing: '0.06em',
                  }}>
                    {cat.children.length} sub-categories
                  </p>
                )}

                {/* View All */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: 7,
                  background: `${color}10`, border: `1px solid ${color}20`,
                  color: color, fontFamily: 'Inter, sans-serif',
                  fontSize: '0.6875rem', fontWeight: 600,
                  marginTop: 'auto',
                }}>
                  View All
                </div>
              </div>
            )
          })}

          {/* Flash Sales card - always last */}
          <div
            onClick={onFlashClick}
            style={{
              background: 'linear-gradient(135deg, rgba(255,77,109,0.10) 0%, rgba(185,28,28,0.03) 100%)',
              border: '1px solid rgba(255,77,109,0.22)',
              borderRadius: 14, padding: '1.25rem 1rem 1rem',
              cursor: 'pointer', textAlign: 'center',
              transition: 'transform 0.16s, box-shadow 0.16s, border-color 0.15s',
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              animation: `fadeSlideUp 0.35s ${rootCats.length * 0.05}s ease both`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(255,77,109,0.28)'
              e.currentTarget.style.borderColor = '#ff4d6d'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = 'rgba(255,77,109,0.22)'
            }}
          >
            <div style={{
              position: 'absolute', top: -24, right: -24, width: 90, height: 90,
              borderRadius: '50%', background: 'rgba(255,77,109,0.38)', filter: 'blur(32px)',
              pointerEvents: 'none', opacity: 0.20,
            }} />
            <div style={{
              width: 58, height: 58, borderRadius: 16, marginBottom: '0.75rem', marginTop: '0.25rem',
              background: 'linear-gradient(135deg, rgba(255,77,109,0.20), rgba(255,77,109,0.08))',
              border: '1px solid rgba(255,77,109,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem', lineHeight: 1,
            }}>🔥</div>
            <p style={{ margin: '0 0 4px', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.25 }}>
              Flash Sales
            </p>
            <p style={{ margin: '0 0 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--urgent)', letterSpacing: '0.06em' }}>
              Limited time
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 7, background: 'rgba(255,77,109,0.10)', border: '1px solid rgba(255,77,109,0.20)', color: '#ff4d6d', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', fontWeight: 600, marginTop: 'auto' }}>
              View Deals
            </div>
          </div>
        </div>
      )}

      {/* Empty - no categories seeded yet */}
      {!isLoading && rootCats.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.08)' }}>
          No categories yet. Run <code style={{ color: 'var(--accent)' }}>python manage.py seed_categories</code> to populate.
        </div>
      )}
    </div>
  )
}

/* ── Strip card - Best Sellers (large=true) + generic usage ─────────── */
function StripCard({ product, badge, badgeColor = 'var(--accent)', large = false }) {
  const navigate = useNavigate()
  const { t } = useTranslation('shop')
  const flash  = product.flash_sale_active
  const price  = parseFloat(product.effective_price || product.price)
  const orig   = parseFloat(product.price)
  const darkBg = 'var(--bg-surface)'
  const cardW  = large ? 222 : 188
  const imgH   = large ? 154 : 130

  return (
    <div
      onClick={() => navigate(`/product/${product.slug || product.id}`)}
      style={{
        minWidth: cardW, maxWidth: cardW, flexShrink: 0,
        background: darkBg,
        border: `1px solid ${flash ? 'rgba(255,77,109,0.3)' : 'var(--border)'}`,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.22s cubic-bezier(.2,.8,.2,1), border-color 0.22s, box-shadow 0.22s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-5px) scale(1.01)'
        e.currentTarget.style.borderColor = flash ? 'rgba(255,77,109,0.6)' : 'rgba(160,95,255,0.6)'
        e.currentTarget.style.boxShadow = flash
          ? '0 20px 48px -10px rgba(255,50,80,0.4), 0 0 0 1px rgba(255,50,80,0.12)'
          : '0 20px 48px -10px rgba(100,45,210,0.45), 0 0 0 1px rgba(160,95,255,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)'
        e.currentTarget.style.borderColor = flash ? 'rgba(255,77,109,0.2)' : 'rgba(110,55,210,0.18)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Image */}
      <div style={{
        position: 'relative', height: imgH, overflow: 'hidden', flexShrink: 0,
        background: flash ? 'linear-gradient(135deg,#1A0005,#220008)' : 'linear-gradient(135deg,#0E0618,#160A24)',
      }}>
        {product.image
          ? <img
              src={mediaUrl(product.image)}
              alt={product.name}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: 0.65,
                transition: 'transform 0.45s cubic-bezier(.2,.8,.2,1)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            />
          : <div style={{
              position: 'absolute', inset: 0, zIndex: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem',
            }}>
              {product.category_detail?.icon || '🎮'}
            </div>
        }

        {/* Corner glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20, width: 90, height: 90,
          borderRadius: '50%', background: flash ? 'rgba(255,60,80,0.4)' : 'rgba(124,58,237,0.4)',
          filter: 'blur(32px)', zIndex: 3, pointerEvents: 'none',
        }}/>

        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%',
          background: `linear-gradient(to bottom, transparent, ${darkBg})`,
          zIndex: 3, pointerEvents: 'none',
        }}/>

        {/* Flash ribbon */}
        {flash && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9,
            background: 'linear-gradient(90deg,#B80018,#FF1F3A)',
            padding: '3px 8px', display: 'flex', alignItems: 'center',
          }}>
            <span style={{ fontFamily:'Sora,sans-serif', fontWeight:800, fontSize:8.5, color:'#fff', letterSpacing:'0.1em' }}>⚡ FLASH SALE</span>
          </div>
        )}

        {/* Rank / NEW badge */}
        <div style={{
          position: 'absolute', top: flash ? 22 : 8, left: 8, zIndex: 8,
          background: badgeColor, borderRadius: 5, padding: '2px 7px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 800,
          color: 'var(--text-primary)', letterSpacing: '0.05em',
        }}>{badge}</div>

        {/* Category chip bottom-left */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 8,
          display: 'inline-flex', alignItems: 'center',
          background: 'rgba(7,3,16,0.72)', border: '1px solid rgba(160,95,255,0.2)',
          borderRadius: 5, padding: '2px 7px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.45rem', fontWeight: 700,
          color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase',
          backdropFilter: 'blur(10px)',
        }}>{product.category_detail?.name || 'Digital'}</div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <p style={{
          margin: 0, color: 'var(--text-primary)',
          fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8rem',
          lineHeight: 1.3, overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          letterSpacing: '-0.01em',
        }}>{product.name}</p>

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
          background: 'rgba(61,220,132,0.07)', border: '1px solid rgba(61,220,132,0.15)',
          borderRadius: 4, padding: '1px 6px',
          fontFamily: 'Inter, sans-serif', fontSize: '0.47rem', fontWeight: 700,
          color: '#3DDC84', letterSpacing: '0.04em',
        }}>⚡ {t('product.instantDelivery')}</span>

        {/* Price + Buy */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 4 }}>
          <div>
            {orig > price && (
              <span style={{
                display: 'block', fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.55rem', color: 'var(--text-muted)', textDecoration: 'line-through',
              }}>{orig.toFixed(2)}</span>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '0.9375rem',
                color: flash ? '#FF5C70' : '#7C3AED',
                textShadow: flash ? '0 0 14px rgba(255,60,80,0.35)' : '0 0 14px rgba(124,58,237,0.4)',
              }}>{price.toFixed(2)}</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', fontWeight:600, color:'rgba(130,100,185,0.6)' }}>DT</span>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); navigate(`/product/${product.slug || product.id}`) }}
            style={{
              padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: flash ? 'linear-gradient(135deg,#CC0020,#FF1F3A)' : 'linear-gradient(135deg,#4C1D95,#7C3AED)',
              color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '0.6875rem', fontWeight: 700,
              boxShadow: flash ? '0 3px 10px rgba(255,50,80,0.35)' : '0 3px 10px rgba(124,58,237,0.4)',
              transition: 'filter 0.13s, transform 0.13s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.14)'; e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'scale(1)' }}
          >{t('product.buyNow')}</button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   BEST SELLERS STRIP
══════════════════════════════════════════════════════════════════════ */
function BestSellersStrip({ onViewAll }) {
  const navigate = useNavigate()
  const { t } = useTranslation('shop')
  const scrollRef = useRef(null)
  const { data, isLoading } = useQuery({
    queryKey: ['best-sellers'],
    queryFn: () => getBestSellers().then(r => r.data),
    staleTime: 120000,
  })

  const scroll = (dir) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 260, behavior: 'smooth' })
  }
  const products = data || []
  if (!isLoading && products.length === 0) return null

  return (
    <div style={{
      marginBottom: '2.25rem',
      background: 'var(--bg-surface)',
      borderRadius: 20,
      border: '1px solid var(--border)',
      padding: '1.25rem 1.25rem 1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.125rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--urgent-dim)', border: '1px solid var(--urgent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TbFlame size={16} style={{ color: 'var(--urgent)' }} />
          </div>
          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>{t('sections.bestSellers')}</span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: 'var(--urgent)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.2)',
            borderRadius: 4, padding: '1px 7px',
          }}>HOT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Scroll arrows */}
          {[{ dir: -1, Icon: TbChevronLeft }, { dir: 1, Icon: TbChevronRight }].map(({ dir, Icon }) => (
            <button key={dir} onClick={() => scroll(dir)} style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <Icon size={15} color="var(--text-primary)" />
            </button>
          ))}
          <button onClick={onViewAll} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600 }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {t('sections.allProducts')} <TbArrowRight size={13} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} style={{ display: 'flex', gap: '0.875rem', overflowX: 'auto', paddingBottom: 6 }} className="scrollbar-hide">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ minWidth: 222, height: 286, flexShrink: 0, borderRadius: 16 }} />)
          : products.map((p, rank) => (
              <StripCard
                key={p.id} product={p} large
                badge={`#${rank + 1}`}
                badgeColor={rank === 0 ? '#D4AF37' : rank === 1 ? '#A8A9AD' : rank === 2 ? '#CD7F32' : 'rgba(255,255,255,0.12)'}
              />
            ))
        }
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════

/* ══════════════════════════════════════════════════════════════════════
   FLOATING BUTTONS
══════════════════════════════════════════════════════════════════════ */
function FloatingButtons() {
  const buttons = [
    { Icon: TbBrandWhatsapp, label: 'WhatsApp', color: '#25d366', bg: '#1a3d2b', href: 'https://wa.me/21624027209' },
    { Icon: TbBrandInstagram, label: 'Instagram', color: '#e1306c', bg: '#3d1520', href: 'https://www.instagram.com/gmcvstorex' },
  ]
  return createPortal(
    <div style={{ position: 'fixed', right: 18, bottom: 24, zIndex: 9000, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {buttons.map(btn => {
        const Ic = btn.Icon
        return (
          <a key={btn.label} href={btn.href} target="_blank" rel="noopener noreferrer" title={btn.label} style={{
            width: 44, height: 44, borderRadius: 13,
            background: btn.bg,
            border: '1px solid ' + btn.color + '40',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1) translateX(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px ' + btn.color + '50' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateX(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)' }}
          >
            <Ic size={20} color={btn.color} />
          </a>
        )
      })}
    </div>,
    document.body
  )
}

/* ══════════════════════════════════════════════════════════════════════
   FILTER SIDEBAR
══════════════════════════════════════════════════════════════════════ */

function SidebarLabel({ children }) {
  return (
    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 10px' }}>
      {children}
    </p>
  )
}

/* Depth-first search for the chain of nodes (root → ... → match) leading to `slug` */
function findCategoryPath(nodes, slug) {
  for (const node of nodes) {
    if (node.slug === slug) return [node]
    if (node.children?.length) {
      const sub = findCategoryPath(node.children, slug)
      if (sub) return [node, ...sub]
    }
  }
  return null
}

function CategoryPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 20,
        border: `1px solid ${active ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.1)'}`,
        background: active ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.03)',
        color: active ? '#A78BFA' : 'var(--text-secondary)',
        fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: active ? 700 : 500,
        cursor: 'pointer', transition: 'all 0.13s', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function FilterSidebar({ activeSlug, onSelect, priceRange, onPriceChange }) {
  const { t } = useTranslation('shop')
  const { data: rootCats = [] } = useQuery({
    queryKey: ['categories', 'root'],
    queryFn: () => getCategories({ parent: 'root' }).then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.results ?? []) }),
    staleTime: 5 * 60 * 1000,
  })

  const hasFilters = priceRange < 500

  // Find the deepest selected node to surface its children as "regions"
  const path = activeSlug ? (findCategoryPath(rootCats, activeSlug) || []) : []
  const deepest = path[path.length - 1] || null
  const regionItems = deepest?.children?.length > 1 ? deepest.children : []

  // If the active slug is itself a leaf with siblings, show the siblings as region pills
  const parentNode = path.length >= 2 ? path[path.length - 2] : null
  const siblingItems = parentNode?.children?.length > 1 ? parentNode.children : []
  const regions = regionItems.length > 0 ? regionItems : siblingItems

  return (
    <aside className="filter-sidebar" style={{
      width: 210, minWidth: 210, flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: '1.5rem',
      paddingRight: '1.25rem',
      borderRight: '1px solid rgba(255,255,255,0.06)',
    }}>

      {/* ── Reset pill ──────────────────────────────── */}
      {hasFilters && (
        <button onClick={() => { onPriceChange(500) }} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)',
          color: '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem',
          fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', width: '100%',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,77,109,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,77,109,0.08)'}
        >
          ✕ {t('filters.clearFilters')}
        </button>
      )}

      {/* ── Region (leaf-level children only) ──────── */}
      {regions.length > 0 && (
        <div>
          <SidebarLabel>{t('filters.region')}</SidebarLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {regions.map(node => (
              <CategoryPill
                key={node.slug}
                active={activeSlug === node.slug}
                onClick={() => onSelect(node)}
              >
                {node.name}
              </CategoryPill>
            ))}
          </div>
        </div>
      )}

      {/* ── Divider ─────────────────────────────────── */}
      {regions.length > 0 && <div style={{ height: 1, background: 'var(--bg-elevated)' }} />}

      {/* ── Price range ─────────────────────────────── */}
      <div>
        <SidebarLabel>{t('filters.priceRange')}</SidebarLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>0 DT</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: priceRange >= 500 ? 'var(--text-muted)' : 'var(--accent)' }}>{priceRange >= 500 ? '∞' : priceRange}</span>
            {priceRange < 500 && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>DT</span>}
          </div>
        </div>
        <div style={{ position: 'relative', height: 4, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 0 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: (priceRange / 500 * 100) + '%', borderRadius: 4,
            background: 'linear-gradient(90deg, #4C1D95, #7C3AED, #A78BFA)',
            boxShadow: '0 0 8px rgba(124,58,237,0.45)',
            transition: 'width 0.08s',
          }} />
        </div>
        <input
          type="range" min={0} max={500} step={5} value={priceRange}
          onChange={e => onPriceChange(Number(e.target.value))}
          style={{
            width: '100%', accentColor: '#7C3AED', cursor: 'pointer',
            background: 'transparent', marginTop: -4, position: 'relative', zIndex: 1,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: 'var(--text-muted)' }}>{t('filters.min')}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: priceRange >= 500 ? 'rgba(255,255,255,0.2)' : 'rgba(124,58,237,0.7)' }}>{priceRange >= 500 ? t('filters.noLimit') : 'MAX ' + priceRange + ' DT'}</span>
        </div>
      </div>

    </aside>
  )
}

/* ── Tab bar ─────────────────────────────────────────────────────────── */
function TabBar({ activeTab, onChange }) {
  const { t } = useTranslation('shop')
  const tabs = [
    { key: 'shop',    label: t('sections.allProducts') },
    { key: 'flash',   label: `⚡ ${t('sections.flashSales')}`, urgent: true },
    { key: 'bundles', label: t('sections.bundles') },
  ]
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
      {tabs.map(({ key, label, urgent }) => {
        const active = activeTab === key; const color = urgent ? 'var(--urgent)' : 'var(--accent)'
        return (
          <button key={key} onClick={() => onChange(key)} style={{ padding: '8px 18px', border: 'none', borderBottom: `2px solid ${active ? color : 'transparent'}`, background: 'transparent', color: active ? color : 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1 }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

function SortDropdown({ value, onChange }) {
  const { t } = useTranslation('shop')
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', padding: '5px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', cursor: 'pointer' }}>
      <option value="popular">{t('filters.popular')}</option>
      <option value="price_asc">{t('filters.priceLow')}</option>
      <option value="price_desc">{t('filters.priceHigh')}</option>
      <option value="newest">{t('filters.newest')}</option>
    </select>
  )
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 2rem', animation: 'fadeSlideUp 0.4s ease both' }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
        <Icon size={22} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p style={{ color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '1rem', margin: '0 0 6px' }}>{title}</p>
      <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', margin: 0 }}>{sub}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════ */
export default function ShopPage() {
  const { t } = useTranslation('shop')
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab,     setActiveTab]     = useState(() => searchParams.get('flash') ? 'flash' : 'shop')
  const [activeSlug,    setActiveSlug]    = useState(() => searchParams.get('cat') || null)
  const [localSearch,   setLocalSearch]   = useState('')
  const [sort,          setSort]          = useState('popular')
  const [priceRange,    setPriceRange]    = useState(500)

  const { isAuthenticated } = useAuthStore()
  const authenticated = isAuthenticated()

  // Sync URL params → state when navigating via footer links
  useEffect(() => {
    const cat = searchParams.get('cat')
    const flash = searchParams.get('flash')
    if (flash) { setActiveTab('flash'); setActiveSlug(null) }
    else if (cat) { setActiveSlug(cat); setActiveTab('shop') }
    else { setActiveSlug(null); setActiveTab('shop') }
  }, [searchParams])

  const handleCategorySelect = (cat) => {
    if (!cat) { setActiveSlug(null); setSort('popular'); return }
    setActiveSlug(cat.slug === activeSlug ? null : cat.slug)
    setActiveTab('shop')
    setSort('popular')
  }
  const handleTabChange = (key) => { setActiveTab(key); if (key !== 'shop') setActiveSlug(null); setSort('popular') }

  const { data, isLoading } = useQuery({
    queryKey: ['products', activeSlug, localSearch, activeTab, sort],
    queryFn: () => {
      const params = { category: activeSlug || undefined, search: localSearch || undefined }
      if (activeTab === 'flash') params.flash_sale = 'true'
      if (sort === 'price_asc')  params.ordering = 'price'
      if (sort === 'price_desc') params.ordering = '-price'
      if (sort === 'newest')     params.ordering = '-created_at'
      if (sort === 'popular')    params.ordering = 'popular'
      return getProducts(params).then(r => r.data)
    },
    enabled: activeTab !== 'bundles',
    refetchInterval: 30000,
  })

  const { data: bundlesData, isLoading: bundlesLoading } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => getBundles().then(r => r.data),
    enabled: activeTab === 'bundles',
  })

  const isGmcGiftCards = activeSlug === 'gmc-gift-card'

  const { data: gmcGiftCards = [], isLoading: giftCardsLoading } = useQuery({
    queryKey: ['public-gift-cards'],
    queryFn: () => api.get('/payments/gift-cards/').then(r => r.data),
    enabled: isGmcGiftCards,
  })

  const allProducts = data?.results || data || []
  const products    = allProducts.filter(p => priceRange >= 500 || parseFloat(p.effective_price || p.price) <= priceRange)
  const bundles     = bundlesData?.results || bundlesData || []
  const isHomepage  = activeTab === 'shop' && !activeSlug && !localSearch
  const showSidebar = activeTab !== 'bundles'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <AnnouncementBar />
      <Topbar onSearch={setLocalSearch} />

      <div className="shop-scroll pb-nav" style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1rem', background: 'var(--bg-base)' }}>

        {/* ── HOMEPAGE SECTIONS ─────────────────────────── */}
        {isHomepage && (
          <>
            {/* Hero Slider */}
            <div style={{ marginTop: '1.25rem' }}>
              <HeroSlider
                onFlashClick={() => handleTabChange('flash')}
                onBundlesClick={() => handleTabChange('bundles')}
              />
            </div>

            {/* Best Sellers */}
            <BestSellersStrip onViewAll={() => setActiveTab('shop')} />


          </>
        )}

        {/* ── BROWSE / SEARCH / FILTER ──────────────────── */}
        {!isHomepage && (
          <>
            <div style={{ marginTop: '1.25rem' }}>
              <TabBar activeTab={activeTab} onChange={handleTabChange} />
            </div>

            {activeTab === 'flash' && (
              <div style={{ background: 'var(--urgent-dim)', border: '1px solid var(--urgent-border)', borderRadius: 8, padding: '0.625rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--urgent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em' }}>{t('flashSale.timeLimited')}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem' }}>{t('flashSale.autoRevert')}</span>
              </div>
            )}

            <div className="shop-layout" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              {showSidebar && <FilterSidebar activeSlug={activeSlug} onSelect={handleCategorySelect} priceRange={priceRange} onPriceChange={setPriceRange} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                {activeTab === 'bundles' && (
                  bundlesLoading
                    ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 320, borderRadius: 12 }} />)}</div>
                    : bundles.length === 0
                      ? <EmptyState icon={TbPackage} title={t('bundle.noBundles')} sub={t('bundle.noBundlesHint')} />
                      : <><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{bundles.length} bundles</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>{bundles.map((b, i) => <BundleCard key={b.id} bundle={b} index={i} />)}</div></>
                )}
                {activeTab !== 'bundles' && (
                  isGmcGiftCards
                    ? giftCardsLoading
                        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 280, borderRadius: 12 }} />)}</div>
                        : gmcGiftCards.length === 0
                          ? <EmptyState icon={TbShoppingBag} title="No GMC Gift Cards available" sub="Check back soon for new gift cards." />
                          : <>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{gmcGiftCards.length} gift card{gmcGiftCards.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                                {gmcGiftCards.map(batch => (
                                  <GmcGiftCardBatch key={batch.id} batch={batch} />
                                ))}
                              </div>
                            </>
                    : isLoading
                        ? <div className="product-grid">{Array(9).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 300, borderRadius: 12 }} />)}</div>
                        : products.length === 0
                          ? <EmptyState icon={TbShoppingBag} title={activeTab === 'flash' ? t('empty.noFlashSales') : t('empty.noProducts')} sub={activeTab === 'flash' ? t('empty.noFlashSalesHint') : t('empty.tryDifferentSearch')} />
                          : <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{products.length} product{products.length !== 1 ? 's' : ''}{activeSlug ? ` in ${activeSlug.replace(/-/g, ' ')}` : ''}</span>
                                <SortDropdown value={sort} onChange={setSort} />
                              </div>
                              <div id="product-grid" className="product-grid">
                                {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} isAuthenticated={authenticated} />)}
                              </div>
                            </>
                )}
              </div>
            </div>
          </>
        )}

        {/* All products section on homepage */}
        {isHomepage && (
          <div style={{ marginTop: '0.5rem' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
              <div style={{ width: 3, height: 22, borderRadius: 2, background: 'linear-gradient(to bottom, #7C3AED, #ff4d6d)' }} />
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{t('sections.allProducts')}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginLeft: 4 }}>{t('sections.browseEverything')}</span>
              <div style={{ marginLeft: 'auto' }}>
                <SortDropdown value={sort} onChange={setSort} />
              </div>
            </div>
            <div className="shop-layout" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <FilterSidebar activeSlug={activeSlug} onSelect={handleCategorySelect} priceRange={priceRange} onPriceChange={setPriceRange} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {isLoading
                  ? <div className="product-grid">{Array(9).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 300, borderRadius: 12 }} />)}</div>
                  : products.length === 0
                    ? <EmptyState icon={TbShoppingBag} title={t('empty.noProducts')} sub={t('empty.tryDifferentSearch')} />
                    : <>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{products.length} products</span>
                        </div>
                        <div id="product-grid" className="product-grid">
                          {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} isAuthenticated={authenticated} />)}
                        </div>
                      </>
                }
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>

      <FloatingButtons />
    </div>
  )
}






