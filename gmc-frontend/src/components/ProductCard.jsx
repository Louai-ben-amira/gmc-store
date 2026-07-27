import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  TbShoppingCartPlus, TbBasket,
  TbDeviceGamepad2, TbGift, TbWifi,
  TbBrandSteam, TbBrandValorant, TbBrandXbox,
  TbDeviceMobile, TbPlaystationCircle,
  TbCreditCard, TbNetwork, TbBolt, TbUsers,
  TbHeart, TbHeartFilled, TbLock,
} from 'react-icons/tb'
import { useQueryClient } from '@tanstack/react-query'
import { toggleWishlist } from '../api/products'
import { mediaUrl } from '../utils/formatters'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../store/authStore'
import useBasketStore from '../store/basketStore'

/* ─── Styles injected once ────────────────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('pcard-style')) {
  const s = document.createElement('style')
  s.id = 'pcard-style'
  s.textContent = `
    @keyframes pcUp {
      from { opacity:0; transform:translateY(22px) scale(0.96); }
      to   { opacity:1; transform:translateY(0)    scale(1);    }
    }

    .pcard {
      position: relative;
      width: 100%;
      background: var(--bg-surface);
      border-radius: 16px;
      border: 1px solid var(--border);
      overflow: hidden;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      transition:
        transform .26s cubic-bezier(.2,.8,.2,1),
        border-color .26s ease,
        box-shadow .26s ease;
      isolation: isolate;
    }
    .pcard:hover {
      transform: translateY(-5px) scale(1.012);
      border-color: rgba(160,95,255,0.45);
      box-shadow:
        0 0 0 1px rgba(160,95,255,0.1),
        0 22px 48px -10px rgba(80,30,180,0.45),
        0 8px 20px -4px rgba(0,0,0,0.65);
    }

    /* ── image section ── */
    .pcard-img {
      position: relative;
      height: 200px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .pcard-img > img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.9;
      transition: transform .5s cubic-bezier(.2,.8,.2,1), opacity .3s;
    }
    .pcard:hover .pcard-img > img {
      transform: scale(1.05);
      opacity: 1;
    }

    /* ── body ── */
    .pcard-body {
      padding: 14px 14px 15px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }

    /* ── name ── */
    .pcard-name {
      margin: 0;
      font-family: 'Sora', sans-serif;
      font-weight: 700;
      font-size: 15px;
      color: var(--text-primary);
      line-height: 1.3;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      letter-spacing: -0.015em;
    }

    /* ── description ── */
    .pcard-desc {
      margin: 0;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 400;
      color: var(--text-muted);
      line-height: 1.55;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    /* ── price label ── */
    .pcard-plabel {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    /* ── price value ── */
    .pcard-price {
      font-family: 'Sora', sans-serif;
      font-weight: 800;
      font-size: 22px;
      line-height: 1;
      color: var(--text-primary);
    }
    .pcard-cur {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-left: 2px;
    }
    .pcard-orig {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      text-decoration: line-through;
      margin-right: 4px;
      align-self: center;
    }

    /* ── footer row ── */
    .pcard-footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10px;
      margin-top: auto;
    }

    /* ── buy button ── */
    .pcard-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 18px;
      height: 44px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-family: 'Sora', sans-serif;
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.01em;
      flex-shrink: 0;
      white-space: nowrap;
      color: #fff;
      transition: filter .15s, transform .15s;
      position: relative;
      overflow: hidden;
    }
    .pcard-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 55%);
      pointer-events: none;
    }
    .pcard-btn:hover:not(:disabled) {
      filter: brightness(1.15);
      transform: scale(1.05);
    }
    .pcard-btn:disabled {
      opacity: .3;
      cursor: not-allowed;
    }

    /* ── wishlist button ── */
    .pcard-wish {
      position: absolute;
      top: 10px; right: 10px;
      z-index: 10;
      width: 40px; height: 40px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      border: 1.5px solid rgba(255,255,255,0.18);
      background: rgba(10,8,20,0.55);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      transition: all .18s;
    }
    .pcard-wish:hover { border-color: rgba(255,80,100,0.6); background: rgba(255,50,70,0.14); }
    .pcard-wish.on    { background: rgba(255,50,70,0.22);  border-color: rgba(255,60,80,0.6); }

    /* ── badge chip ── */
    .pcard-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 6px;
      padding: 3px 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      white-space: nowrap;
    }

    /* ── mobile scaling (2-col grid on phones) ── */
    @media (max-width: 640px) {
      .pcard-img       { height: 120px; }
      .pcard-body      { padding: 10px 10px 11px; gap: 5px; }
      .pcard-name      { font-size: 12.5px; -webkit-line-clamp: 1; }
      .pcard-desc      { display: none; }
      .pcard-plabel    { font-size: 7.5px; margin-bottom: 0; }
      .pcard-price     { font-size: 15px; }
      .pcard-cur       { font-size: 9px; }
      .pcard-orig      { font-size: 9px; }
      .pcard-footer    { flex-direction: column; align-items: stretch; gap: 6px; }
      .pcard-btn       { height: 32px; padding: 0 8px; font-size: 10.5px; gap: 4px; border-radius: 8px; }
      .pcard-btn-basket { display: none; }
      .pcard-btn-buy   { width: 100%; }
      .pcard-wish      { width: 28px; height: 28px; top: 7px; right: 7px; }
      .pcard-wish svg  { width: 12px; height: 12px; }
      .pcard-chip      { font-size: 7.5px; padding: 2px 6px; gap: 3px; }
      .pcard-chip svg  { width: 7px; height: 7px; }
    }
  `
  document.head.appendChild(s)
}

/* ─── Category config ─────────────────────────────────────────────────── */
const CAT = {
  valorant:       { Icon: TbBrandValorant,     c1:'#FF4655', c2:'#9A1525', ic:'#FF8FA0', bg:'135deg,#200408 0%,#2C080E 60%,#1C0408 100%' },
  steam:          { Icon: TbBrandSteam,        c1:'#66C0F4', c2:'#1B3858', ic:'#9CD4F5', bg:'135deg,#071525 0%,#0D1E30 60%,#071525 100%' },
  epic:           { Icon: TbDeviceGamepad2,    c1:'#A855F7', c2:'#5B21B6', ic:'#C084FC', bg:'135deg,#130A22 0%,#1E1030 60%,#130A22 100%' },
  playstation:    { Icon: TbPlaystationCircle, c1:'#0070D1', c2:'#003880', ic:'#60A8FF', bg:'135deg,#020C20 0%,#04182E 60%,#020C20 100%' },
  xbox:           { Icon: TbBrandXbox,         c1:'#52B043', c2:'#1D5C17', ic:'#80D473', bg:'135deg,#031408 0%,#071E0C 60%,#031408 100%' },
  gift_cards:     { Icon: TbGift,              c1:'#F59E0B', c2:'#92400E', ic:'#FBD078', bg:'135deg,#1A0E00 0%,#241400 60%,#1A0E00 100%' },
  ooredoo:        { Icon: TbNetwork,           c1:'#E60028', c2:'#7F000F', ic:'#FF6680', bg:'135deg,#1C0006 0%,#240008 60%,#1C0006 100%' },
  orange:         { Icon: TbDeviceMobile,      c1:'#FF6600', c2:'#B84400', ic:'#FF9955', bg:'135deg,#1C0800 0%,#240C00 60%,#1C0800 100%' },
  telecom:        { Icon: TbWifi,              c1:'#0091DA', c2:'#005A87', ic:'#55BFFF', bg:'135deg,#00121E 0%,#001C2C 60%,#00121E 100%' },
  mobile_legends: { Icon: TbDeviceGamepad2,    c1:'#C9A227', c2:'#7B5B00', ic:'#F0CC60', bg:'135deg,#1A0E00 0%,#241400 60%,#1A0E00 100%' },
  free_fire:      { Icon: TbBolt,              c1:'#FF4500', c2:'#A02000', ic:'#FF8060', bg:'135deg,#1C0800 0%,#240800 60%,#1C0800 100%' },
  pubg:           { Icon: TbDeviceGamepad2,    c1:'#F5A623', c2:'#9A6000', ic:'#FFD080', bg:'135deg,#1A1000 0%,#241800 60%,#1A1000 100%' },
  accounts:       { Icon: TbUsers,             c1:'#7C3AED', c2:'#4C1D95', ic:'#B57BFF', bg:'135deg,#0E0618 0%,#160A24 60%,#0E0618 100%' },
  other:          { Icon: TbCreditCard,        c1:'#7C3AED', c2:'#4C1D95', ic:'#B57BFF', bg:'135deg,#0E0618 0%,#160A24 60%,#0E0618 100%' },
}

function cat(key) {
  const k = (key || 'other').toLowerCase().replace(/-/g, '_')
  return CAT[k] || CAT.other
}

/* ─── Stock badge ─────────────────────────────────────────────────────── */
function StockBadge({ n }) {
  const { t } = useTranslation('shop')
  if (n === 0) return <Badge bg="rgba(220,38,60,0.18)"  border="rgba(220,38,60,0.5)"  color="#FF6070">{t('product.outOfStock')}</Badge>
  if (n <= 5)  return <Badge bg="rgba(234,150,0,0.18)"  border="rgba(234,150,0,0.5)"  color="#FFBE40">{t('product.lowStock', { count: n })}</Badge>
  return              <Badge bg="rgba(16,185,100,0.15)" border="rgba(16,185,100,0.5)" color="#2EE8A0">{t('product.inStock')}</Badge>
}
function Badge({ bg, border, color, children }) {
  return (
    <span className="pcard-chip" style={{ background: bg, border: `1px solid ${border}`, color }}>
      {children}
    </span>
  )
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function ProductCard({ product, index = 0, onBuyClick }) {
  const { t }    = useTranslation('shop')
  const navigate = useNavigate()
  const toast    = useToast()
  const qc       = useQueryClient()
  const { isAuthenticated, user } = useAuthStore()
  const unverified = isAuthenticated() && user?.is_email_verified === false
  const addItem  = useBasketStore(s => s.addItem)

  const flash = product.flash_sale_active
  const price = parseFloat(product.effective_price || product.price)
  const orig  = parseFloat(product.price)
  const stock = product.available_stock ?? product.stock_count ?? 0
  const disc  = product.discount_percentage || 0
  const cfg   = cat(product.category_detail?.slug || product.category_detail?.name)
  const { Icon, c1, c2, ic, bg } = cfg

  const catName = (product.category_detail?.name || (product.category || 'Digital Goods'))
    .replace(/_/g, ' ').toUpperCase()

  const [liked, setLiked] = useState(!!product.is_wishlisted)
  const [lBusy, setLBusy] = useState(false)
  // Server data is the source of truth - resync when a refetch (login,
  // logout, cache invalidation) delivers a different wishlist state
  useEffect(() => { setLiked(!!product.is_wishlisted) }, [product.is_wishlisted])

  const doWish = async (e) => {
    e.stopPropagation()
    if (!isAuthenticated()) {
      window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))
      return
    }
    if (lBusy) return
    setLBusy(true)
    try {
      const { data } = await toggleWishlist(product.id)
      setLiked(data.wishlisted)
      qc.invalidateQueries({ queryKey: ['wishlist'] })
      // Product lists cache is_wishlisted - refresh them so hearts stay correct
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['best-sellers'] })
    } catch { toast.error('Could not update wishlist') }
    setLBusy(false)
  }

  const doBuy = (e) => {
    e.stopPropagation()
    if (!isAuthenticated()) {
      window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))
      return
    }
    if (onBuyClick) { onBuyClick(product); return }
    navigate(`/product/${product.slug || product.id}`)
  }

  const doAddToBasket = (e) => {
    e.stopPropagation()
    if (!isAuthenticated()) {
      window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))
      return
    }
    // Variant products don't have a picker on the card - send the user to the
    // product page where variant selection is already solved.
    if (product.has_variants) {
      navigate(`/product/${product.slug || product.id}`)
      return
    }
    addItem(product, null)
    toast.success(`${product.name} added to basket`)
  }

  return (
    <div
      className="pcard"
      onClick={() => navigate(`/product/${product.slug || product.id}`)}
      style={{ animation: `pcUp 0.34s ${index * 0.045}s ease both` }}
    >
      {/* ══ IMAGE SECTION ══════════════════════════════════════════════ */}
      <div className="pcard-img" style={{ background: `linear-gradient(${bg})` }}>

        {/* Product image */}
        {product.image
          ? <img src={mediaUrl(product.image)} alt={product.name} loading="lazy" width="400" height="200" />
          : (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: 22,
                background: `linear-gradient(145deg,${c1}30,${c2}18)`,
                border: `1.5px solid ${c1}45`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 0 1px ${c1}18, 0 12px 36px ${c1}30`,
              }}>
                <Icon size={36} color={ic} strokeWidth={1.2} />
              </div>
            </div>
          )
        }

        {/* Corner glow */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 140, height: 140, borderRadius: '50%',
          background: `${c1}28`, filter: 'blur(50px)',
          zIndex: 3, pointerEvents: 'none',
        }} />

        {/* Bottom fade into card body */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%',
          background: 'linear-gradient(to bottom, transparent, var(--bg-surface))',
          zIndex: 4, pointerEvents: 'none',
        }} />

        {/* Flash sale ribbon */}
        {flash && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9,
            background: 'linear-gradient(90deg,#AA0016,#E8172E)',
            padding: '4px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: 12, color: 'var(--text-primary)', letterSpacing: '0.1em' }}>
              ⚡ FLASH SALE
            </span>
            {disc > 0 && (
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 12, color: '#FFCCD2', marginLeft: 'auto' }}>
                −{disc}%
              </span>
            )}
          </div>
        )}

        {/* Top-left: category chip + stock chip */}
        <div style={{
          position: 'absolute',
          top: flash ? 30 : 10,
          left: 10,
          zIndex: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 5,
        }}>
          <span className="pcard-chip" style={{
            background: `${c1}22`, border: `1px solid ${c1}55`, color: ic,
          }}>
            <Icon size={9} strokeWidth={2} />
            {catName.length > 14 ? catName.slice(0, 12) + '…' : catName}
          </span>
          <StockBadge n={stock} />
        </div>

        {/* Wishlist - circle top-right */}
        <button
          className={`pcard-wish${liked ? ' on' : ''}`}
          onClick={doWish}
          style={{ top: flash ? 30 : 10 }}
        >
          {liked
            ? <TbHeartFilled size={15} color="#FF5060" />
            : <TbHeart size={15} color="rgba(220,200,255,0.75)" />
          }
        </button>

        {/* Discount badge - bottom right */}
        {disc > 0 && !flash && (
          <div style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 8,
            background: `linear-gradient(135deg,${c1},${c2})`,
            borderRadius: 8, padding: '4px 10px',
            fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: 12,
            color: 'var(--text-primary)', boxShadow: `0 4px 14px ${c1}50`,
          }}>−{disc}%</div>
        )}
      </div>

      {/* ══ BODY ═══════════════════════════════════════════════════════ */}
      <div className="pcard-body">

        {/* Name */}
        <p className="pcard-name">{product.name}</p>

        {/* Account required */}
        {product.requires_account && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
            background: 'rgba(234,160,0,0.1)', border: '1px solid rgba(234,160,0,0.3)',
            borderRadius: 5, padding: '2px 8px',
            fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', fontWeight: 700,
            color: '#FFC840', letterSpacing: '0.05em',
          }}>
            <TbLock size={9} /> {t('product.accountRequired')}
          </div>
        )}

        {/* Description */}
        {product.description && (
          <p className="pcard-desc">{product.description}</p>
        )}

        {/* Thin divider */}
        <div style={{
          height: 1, flexShrink: 0,
          background: 'linear-gradient(to right, rgba(124,58,237,0.28), rgba(160,100,255,0.05), transparent)',
        }} />

        {/* Price + Buy Now */}
        <div className="pcard-footer">
          <div>
            {!product.has_variants && (
              <>
                <div className="pcard-plabel">{t('product.price')}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
                  {flash && orig > price && (
                    <span className="pcard-orig">{orig.toFixed(2)}</span>
                  )}
                  <span className="pcard-price">{price.toFixed(2)}</span>
                  <span className="pcard-cur">DT</span>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {stock !== 0 && (
              <button
                className="pcard-btn pcard-btn-basket"
                onClick={doAddToBasket}
                title={t('product.addToBasket', 'Add to Basket')}
                style={{
                  padding: '0 12px',
                  background: 'transparent',
                  border: `1.5px solid ${c1}55`,
                  color: ic,
                  boxShadow: 'none',
                }}
              >
                <TbBasket size={16} strokeWidth={2.2} />
              </button>
            )}
            <button
              className="pcard-btn pcard-btn-buy"
              onClick={doBuy}
              disabled={stock === 0 || unverified}
              title={unverified ? 'Verify your email to enable purchases' : undefined}
              style={stock === 0 || unverified
                ? { background: 'rgba(60,40,90,0.3)', color: 'rgba(180,150,240,0.3)', boxShadow: 'none' }
                : {
                    background: flash
                      ? 'linear-gradient(135deg,#AA0016,#E8172E)'
                      : `linear-gradient(135deg,${c2},${c1})`,
                    boxShadow: flash
                      ? '0 4px 16px rgba(220,20,40,0.45)'
                      : `0 4px 16px ${c1}55`,
                  }
              }
            >
              {stock === 0
                ? t('product.soldOut')
                : <><TbShoppingCartPlus size={14} strokeWidth={2.2} /> {t('product.buyNow')}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

