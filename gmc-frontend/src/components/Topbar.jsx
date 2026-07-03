import { useState, useRef, useEffect, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, X, User, Menu } from 'lucide-react'
import AuthModal from './AuthModal'
import { useTranslation } from 'react-i18next'
import {
  TbShoppingBag, TbWallet, TbMessageCircle, TbUserCircle,
  TbLogout, TbChevronDown, TbChevronRight, TbLayoutDashboard,
} from 'react-icons/tb'
import {
  PiHouseBold, PiGameControllerBold, PiKeyBold, PiUserBold, PiGiftBold,
  PiWifiHighBold, PiFireBold, PiTargetBold, PiSoccerBallBold, PiCrownBold,
  PiDiamondBold, PiRocketBold, PiGlobeBold, PiPhoneBold, PiTagBold,
  PiLightningBold, PiStarBold,
} from 'react-icons/pi'
import {
  SiValorant, SiRoblox, SiSteam, SiPlaystation,
  SiNetflix, SiSpotify, SiYoutube, SiApple,
  SiLeagueoflegends, SiEpicgames,
} from 'react-icons/si'
import { BsXbox } from 'react-icons/bs'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { mediaUrl, formatCurrency } from '../utils/formatters'
import { getWallet } from '../api/wallet'
import { getCategories, getProducts } from '../api/products'

/* ── inject global keyframe once ───────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('gmc-nav-style')) {
  const s = document.createElement('style')
  s.id = 'gmc-nav-style'
  s.textContent = `
    @keyframes navDropIn {
      from { opacity:0; transform:translateY(-10px) scale(0.98); }
      to   { opacity:1; transform:translateY(0)    scale(1);    }
    }
  `
  document.head.appendChild(s)
}

/* ═══════════════════════════════════════════════════════════════════════
   CATEGORY TREE  (with rich icon + color per sub-item)
═══════════════════════════════════════════════════════════════════════ */
export const NAV_ITEMS = [
  { labelKey: 'nav.home', label: 'Home', to: '/', exact: true, NavIcon: PiHouseBold },

  {
    labelKey: 'nav.topUpGames', label: 'Top-Up Games', NavIcon: PiGameControllerBold, color: '#7C3AED',
    children: [
      { label: 'Free Fire',      to: '/?cat=free-fire-diamonds',      Icon: PiFireBold,       color: '#FF6B00' },
      { label: 'PUBG Mobile',    to: '/?cat=pubg-uc',                 Icon: PiTargetBold,     color: '#F5A623' },
      { label: 'FC Mobile',      to: '/?cat=fifa-coins',              Icon: PiSoccerBallBold, color: '#3DDC84' },
      { label: 'Mobile Legends', to: '/?cat=mobile-legends-diamonds', Icon: PiCrownBold,      color: '#1b9aee' },
      { label: 'eFootball',      to: '/?cat=efootball',               Icon: PiSoccerBallBold, color: '#0066CC' },
    ],
    viewAll: { labelKey: 'nav.viewAllTopUp', label: 'View All Top-Up', to: '/?cat=game-top-ups' },
  },

  {
    labelKey: 'nav.loginGames', label: 'Login Games', NavIcon: PiKeyBold, color: '#7C3AED',
    children: [
      { label: 'Valorant',      to: '/?cat=valorant-accounts',  Icon: SiValorant,   color: '#FF4655' },
      { label: 'Fortnite',      to: '/?cat=fortnite-accounts',  Icon: SiEpicgames,  color: '#00D4FF' },
      { label: 'Roblox',        to: '/?cat=roblox-accounts',    Icon: SiRoblox,     color: '#E2231A' },
      { label: 'EA FC',         to: '/?cat=ea-fc-accounts',     Icon: PiSoccerBallBold, color: '#3DDC84' },
    ],
    viewAll: { labelKey: 'nav.viewAllLogin', label: 'View All Login', to: '/?cat=game-accounts' },
  },

  {
    labelKey: 'nav.accounts', label: 'Accounts', NavIcon: PiUserBold, color: '#7C3AED',
    groups: [
      {
        labelKey: 'nav.gamingAccounts', label: 'Gaming Accounts', color: '#7C3AED',
        items: [
          { label: 'Steam',      to: '/?cat=steam-accounts',      Icon: SiSteam,     color: '#66C0F4' },
          { label: 'Epic Games', to: '/?cat=epic-games-accounts', Icon: SiEpicgames, color: 'var(--text-primary)' },
        ],
      },
      {
        labelKey: 'nav.premiumAccounts', label: 'Premium Accounts', color: '#7C3AED',
        items: [
          { label: 'Netflix',         to: '/?cat=netflix',         Icon: SiNetflix, color: '#E50914' },
          { label: 'Spotify',         to: '/?cat=spotify',         Icon: SiSpotify, color: '#1DB954' },
          { label: 'YouTube Premium', to: '/?cat=youtube-premium', Icon: SiYoutube, color: '#FF0000' },
        ],
      },
    ],
    viewAll: { labelKey: 'nav.viewAllAccounts', label: 'View All Gaming Accounts', to: '/?cat=game-accounts' },
  },

  {
    labelKey: 'nav.giftCards', label: 'Gift Cards', NavIcon: PiGiftBold, color: '#7C3AED',
    maxCols: 3,
    groups: [
      {
        label: 'Steam', color: '#7C3AED', categorySlug: 'steam-gift-cards',
        fallbackIcon: SiSteam, fallbackColor: '#66C0F4',
      },
      {
        label: 'PlayStation', color: '#7C3AED', categorySlug: 'playstation-gift-cards',
        fallbackIcon: SiPlaystation, fallbackColor: '#0070d1',
      },
      {
        label: 'Xbox', color: '#7C3AED', categorySlug: 'xbox-gift-cards',
        fallbackIcon: BsXbox, fallbackColor: '#107C10',
      },
      {
        label: 'Valorant', color: '#FF4655', categorySlug: 'valorant-points',
        fallbackIcon: SiValorant, fallbackColor: '#FF4655',
      },
      {
        label: 'iTunes', color: '#A2AAAD', categorySlug: 'apple-gift-cards',
        fallbackIcon: SiApple, fallbackColor: '#A2AAAD',
      },
      {
        label: 'Other', color: '#7C3AED',
        items: [
          { label: 'GMC Gift',          to: '/?cat=gmc-gift-card',      Icon: PiGiftBold,        color: '#7C3AED' },
          { label: 'Roblox',            to: '/?cat=roblox-gift-card',   Icon: SiRoblox,          color: '#E2231A' },
          { label: 'League of Legends', to: '/?cat=lol-gift-card',      Icon: SiLeagueoflegends, color: '#C89B3C' },
          { label: 'Free Fire',         to: '/?cat=free-fire-diamonds', Icon: PiFireBold,        color: '#FF6B00' },
        ],
      },
    ],
    viewAll: { labelKey: 'nav.viewAllGiftCards', label: 'View All Gift Cards', to: '/?cat=gift-cards' },
  },

  {
    labelKey: 'nav.internet', label: 'Internet', NavIcon: PiWifiHighBold, color: '#7C3AED',
    children: [
      { label: 'Ooredoo',         to: '/?cat=ooredoo-top-up',         Icon: PiGlobeBold, color: '#E60028' },
      { label: 'Orange',          to: '/?cat=orange-top-up',          Icon: PiPhoneBold, color: '#FF6600' },
      { label: 'Tunisie Telecom', to: '/?cat=tunisie-telecom-top-up', Icon: PiPhoneBold, color: '#0091DA' },
    ],
    viewAll: { labelKey: 'nav.viewAllPackages', label: 'View All Packages', to: '/?cat=mobile-top-up' },
  },

  {
    labelKey: 'nav.offers', label: 'Offers', NavIcon: PiFireBold, color: '#ff4d6d', urgent: true,
    children: [
      { label: 'Promotions',     to: '/?cat=promotions',     Icon: PiTagBold,       color: '#7C3AED' },
      { label: 'Seasonal Sales', to: '/?cat=seasonal-sales', Icon: PiStarBold,      color: '#f59e0b' },
      { label: 'Limited Deals',  to: '/?flash=1',            Icon: PiLightningBold, color: '#ff4d6d' },
    ],
    viewAll: { labelKey: 'nav.flashSalesArrow', label: 'Flash Sales →', to: '/?flash=1' },
  },
]

/* ═══════════════════════════════════════════════════════════════════════
   FLAT DROPDOWN  (Top-Up, Login, Internet, Offers)
═══════════════════════════════════════════════════════════════════════ */
function FlatDropdown({ item, onClose }) {
  const { t } = useTranslation('common')
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'var(--bg-surface)',
      border: `1px solid ${item.color}30`,
      borderTop: `2px solid ${item.color}`,
      borderRadius: 14,
      minWidth: 230,
      boxShadow: `0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)`,
      overflow: 'hidden',
      animation: 'navDropIn 0.18s ease both',
      padding: '6px',
    }}>
      {(item.children || []).map((child, i) => {
        const Icon = child.Icon
        return (
          <Link
            key={i}
            to={child.to}
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 9,
              textDecoration: 'none',
              color: 'var(--text-secondary)',
              fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 500,
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${child.color}14`
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: `${child.color}18`, border: `1px solid ${child.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {Icon
                ? <Icon size={15} color={child.color} />
                : <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{child.emoji || '📦'}</span>
              }
            </span>
            {child.label}
          </Link>
        )
      })}

      {item.viewAll && (
        <>
          <div style={{ height: 1, background: 'var(--bg-elevated)', margin: '4px 6px' }} />
          <Link
            to={item.viewAll.to}
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 10px', borderRadius: 9, textDecoration: 'none',
              color: item.color, fontFamily: 'Inter, sans-serif',
              fontSize: '0.8rem', fontWeight: 700,
              background: `${item.color}10`,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${item.color}20`}
            onMouseLeave={e => e.currentTarget.style.background = `${item.color}10`}
          >
            {item.viewAll.labelKey ? t(item.viewAll.labelKey) : item.viewAll.label}
            <span style={{ fontSize: '0.75rem', opacity: 0.7, display: 'inline-block', transform: document.documentElement.dir === 'rtl' ? 'scaleX(-1)' : 'none' }}>→</span>
          </Link>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MEGA DROPDOWN  (Accounts, Gift Cards)
═══════════════════════════════════════════════════════════════════════ */
function MegaDropdown({ item, onClose }) {
  const { t } = useTranslation('common')
  const groups   = item.groups || []
  const maxCols  = item.maxCols || groups.length

  // Split groups into rows of maxCols
  const rows = []
  for (let i = 0; i < groups.length; i += maxCols) {
    rows.push(groups.slice(i, i + maxCols))
  }

  const colWidth = 160
  const dropWidth = Math.max(380, maxCols * colWidth)

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'var(--bg-surface)',
      border: `1px solid ${item.color}30`,
      borderTop: `2px solid ${item.color}`,
      borderRadius: 16,
      padding: '14px',
      boxShadow: `0 28px 72px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)`,
      animation: 'navDropIn 0.18s ease both',
      width: dropWidth,
      maxWidth: 'calc(100vw - 32px)',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px', paddingBottom: '10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {item.NavIcon && <item.NavIcon size={15} color={item.color} />}
          <span style={{
            fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8125rem',
            color: item.color,
          }}>
            {item.labelKey ? t(item.labelKey) : item.label}
          </span>
        </div>
        {item.viewAll && (
          <Link
            to={item.viewAll.to}
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 700,
              color: item.color, textDecoration: 'none', opacity: 0.75,
              padding: '3px 10px', borderRadius: 6,
              background: `${item.color}10`,
              transition: 'opacity 0.12s, background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = `${item.color}20` }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.background = `${item.color}10` }}
          >
            {item.viewAll.labelKey ? t(item.viewAll.labelKey) : item.viewAll.label}
            {' '}<span style={{ display: 'inline-block', transform: document.documentElement.dir === 'rtl' ? 'scaleX(-1)' : 'none' }}>→</span>
          </Link>
        )}
      </div>

      {/* Groups - rendered as rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${maxCols}, 1fr)`,
            gap: '12px',
            ...(ri > 0 ? { paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' } : {}),
          }}>
            {row.map((group, gi) => (
              <div key={gi}>
                {/* Group label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginBottom: '8px', paddingBottom: '6px',
                  borderBottom: `1px solid ${group.color}30`,
                }}>
                  <div style={{ width: 3, height: 12, borderRadius: 2, background: group.color, flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
                    fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: group.color,
                  }}>
                    {group.labelKey ? t(group.labelKey) : group.label}
                  </span>
                </div>

                {/* Sub items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.items.length === 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.6, padding: '4px 7px' }}>
                      No regions yet
                    </span>
                  )}
                  {group.items.map((sub, si) => {
                    const Icon = sub.Icon
                    return (
                      <Link
                        key={si}
                        to={sub.to}
                        onClick={onClose}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '6px 7px', borderRadius: 8,
                          fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          textDecoration: 'none',
                          transition: 'background 0.1s, color 0.1s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = `${sub.color}15`
                          e.currentTarget.style.color = '#fff'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                        }}
                      >
                        <span style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: `${sub.color}18`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {Icon
                            ? <Icon size={12} color={sub.color} />
                            : <span style={{ fontSize: '0.72rem', lineHeight: 1 }}>{sub.emoji || '📦'}</span>
                          }
                        </span>
                        {sub.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   NAV ITEM
═══════════════════════════════════════════════════════════════════════ */
function NavItem({ item, isActive }) {
  const { t } = useTranslation('common')
  const label = item.labelKey ? t(item.labelKey) : item.label
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)
  const isMega = !!item.groups
  const hasDropdown = !!(item.children || item.groups || item.categorySlug)

  const openMenu  = () => { clearTimeout(closeTimer.current); setOpen(true) }
  const closeMenu = () => { closeTimer.current = setTimeout(() => setOpen(false), 150) }
  const keepOpen  = () => { clearTimeout(closeTimer.current) }

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  /* plain link (Home) */
  if (!hasDropdown) {
    const NavIcon = item.NavIcon
    return (
      <Link
        to={item.to}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 7, textDecoration: 'none',
          color: isActive ? '#A78BFA' : 'rgba(255,255,255,0.45)',
          fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem',
          fontWeight: isActive ? 600 : 400,
          transition: 'color 0.13s', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#A78BFA'}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
      >
        {NavIcon && <NavIcon size={14} />} {label}
      </Link>
    )
  }

  const NavIcon = item.NavIcon

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
    >
      {/* Trigger */}
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 7,
          background: open ? `${item.color}12` : 'transparent',
          border: 'none', cursor: 'pointer',
          color: open
            ? item.color
            : item.urgent ? `${item.color}cc` : 'rgba(255,255,255,0.45)',
          fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem',
          fontWeight: open ? 600 : 400,
          transition: 'all 0.13s', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = item.color }}
        onMouseLeave={e => {
          if (!open) e.currentTarget.style.color = item.urgent ? `${item.color}cc` : 'rgba(255,255,255,0.45)'
        }}
      >
        {NavIcon && <NavIcon size={14} />}
        {label}
        <TbChevronDown
          size={11}
          style={{
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'none',
            opacity: 0.5,
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div onMouseEnter={keepOpen} onMouseLeave={closeMenu}>
          {isMega
            ? <MegaDropdown item={item} onClose={() => setOpen(false)} />
            : <FlatDropdown item={item} onClose={() => setOpen(false)} />
          }
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   USER MENU DROPDOWN
═══════════════════════════════════════════════════════════════════════ */
const BASE_USER_LINKS = [
  { labelKey: 'auth.myOrders', label: 'My Orders',   to: '/orders',    Icon: TbShoppingBag,   color: '#7C3AED' },
  { labelKey: 'auth.wallet',   label: 'Wallet',      to: '/wallet',    Icon: TbWallet,        color: '#3DDC84' },
  { labelKey: 'auth.messages', label: 'Messages',    to: '/messenger', Icon: TbMessageCircle, color: '#7C3AED' },
  { labelKey: 'auth.profile',  label: 'Profile',     to: '/profile',   Icon: TbUserCircle,    color: '#7C3AED' },
]

function UserMenu({ user, onLogout }) {
  const { t } = useTranslation('common')
  const userLinks = user?.role === 'admin'
    ? [{ labelKey: 'auth.adminPanel', label: 'Admin Panel', to: '/admin', Icon: TbLayoutDashboard, color: 'var(--accent)' }, ...BASE_USER_LINKS]
    : BASE_USER_LINKS
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)
  const openMenu  = () => { clearTimeout(closeTimer.current); setOpen(true) }
  const closeMenu = () => { closeTimer.current = setTimeout(() => setOpen(false), 150) }
  const keepOpen  = () => clearTimeout(closeTimer.current)
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const initial = (user.first_name || user.username || 'U')[0].toUpperCase()

  return (
    <div style={{ position: 'relative' }} onMouseEnter={openMenu} onMouseLeave={closeMenu}>
      {/* Avatar trigger */}
      <button style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px 4px 4px', borderRadius: 9,
        background: open ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${open ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.09)'}`,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.14)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)' }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' } }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED, #4C1D95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {user?.avatar
            ? <img src={mediaUrl(user.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.6rem', color: 'var(--text-primary)' }}>{initial}</span>
          }
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.first_name || user.username}
        </span>
        <TbChevronDown size={11} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          onMouseEnter={keepOpen}
          onMouseLeave={closeMenu}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            zIndex: 9999,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(124,58,237,0.25)',
            borderTop: '2px solid #7C3AED',
            borderRadius: 14, minWidth: 200,
            boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
            padding: 6,
            animation: 'navDropIn 0.18s ease both',
          }}
        >
          {/* User header */}
          <div style={{
            padding: '8px 10px 10px', marginBottom: 4,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
              {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username}
            </p>
            <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {user.email || user.username}
            </p>
          </div>

          {/* Nav links */}
          {userLinks.map(({ labelKey, label, to, Icon, color }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '9px 10px', borderRadius: 9,
                textDecoration: 'none', color: 'var(--text-secondary)',
                fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 500,
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${color}14`; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: `${color}18`, border: `1px solid ${color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color={color} />
                </span>
                {labelKey ? t(labelKey) : label}
              </span>
              <TbChevronRight size={12} style={{ opacity: 0.3, flexShrink: 0 }} />
            </Link>
          ))}

          {/* Divider + logout */}
          <div style={{ height: 1, background: 'var(--bg-elevated)', margin: '4px 6px' }} />
          <button
            onClick={() => { setOpen(false); onLogout() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%', padding: '9px 10px', borderRadius: 9,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,77,109,0.6)', fontFamily: 'Inter, sans-serif',
              fontSize: '0.8125rem', fontWeight: 500, textAlign: 'start',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,77,109,0.1)'; e.currentTarget.style.color = '#ff4d6d' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,77,109,0.6)' }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'rgba(255,77,109,0.12)', border: '1px solid rgba(255,77,109,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TbLogout size={14} color="#ff4d6d" />
            </span>
            {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   LIVE SEARCH  (type-ahead dropdown, matches product name/description)
═══════════════════════════════════════════════════════════════════════ */
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function SearchBox({ mobile = false, onNavigate, onQueryChange }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [query, setQuery]     = useState('')
  const [open, setOpen]       = useState(false)
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapRef  = useRef(null)
  const blurTimer = useRef(null)

  const debouncedQuery = useDebouncedValue(query.trim(), 250)

  const { data, isFetching } = useQuery({
    queryKey: ['nav-search', debouncedQuery],
    queryFn:  () => getProducts({ search: debouncedQuery, page_size: 6 }).then(r => r.data),
    enabled:  debouncedQuery.length > 0,
    staleTime: 15000,
  })

  const results = data?.results || data || []
  const showDropdown = open && query.trim().length > 0

  const goToProduct = (product) => {
    clearTimeout(blurTimer.current)
    setOpen(false)
    setQuery('')
    setActiveIdx(-1)
    onNavigate?.()
    navigate(`/product/${product.slug || product.id}`)
  }

  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      goToProduct(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: mobile ? '100%' : 200, flexShrink: 0 }}
    >
      <Search size={13} style={{
        position: 'absolute', left: mobile ? 10 : 9, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none',
        color: focused ? '#7C3AED' : 'rgba(255,255,255,0.22)',
        transition: 'color 0.15s',
      }} />
      <input
        type="text"
        value={query}
        placeholder={t('btn.search')}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); onQueryChange?.(e.target.value) }}
        onFocus={() => { setFocused(true); setOpen(true) }}
        onBlur={() => { blurTimer.current = setTimeout(() => { setFocused(false); setOpen(false) }, 150) }}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%', height: mobile ? 40 : 32,
          paddingLeft: mobile ? 32 : 28, paddingRight: query ? 26 : 10,
          background: 'var(--bg-elevated)',
          border: `1px solid ${focused ? '#7C3AED' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: mobile ? 10 : 8, color: 'var(--text-primary)',
          fontFamily: 'Inter, sans-serif', fontSize: mobile ? '0.875rem' : '0.8rem',
          outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: focused ? '0 0 0 3px rgba(124,58,237,0.18)' : 'none',
        }}
      />
      {query && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setQuery(''); setOpen(false); onQueryChange?.('') }}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '4px', display: 'flex',
            minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center',
          }}>
          <X size={11} />
        </button>
      )}

      {/* ── Live results dropdown ── */}
      {showDropdown && (
        <div
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: mobile ? 0 : 'auto',
            width: mobile ? '100%' : 320,
            zIndex: 9999,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(124,58,237,0.25)',
            borderTop: '2px solid #7C3AED',
            borderRadius: 14,
            boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
            overflow: 'hidden',
            animation: 'navDropIn 0.15s ease both',
          }}
        >
          {isFetching && results.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
              {Array(3).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--bg-elevated)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 10, width: '70%', borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 6 }} />
                    <div style={{ height: 8, width: '45%', borderRadius: 4, background: 'var(--bg-elevated)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No products found for "<span style={{ color: 'var(--text-secondary)' }}>{query.trim()}</span>"
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto', padding: 6 }}>
              {results.map((product, i) => (
                <div
                  key={product.id}
                  onClick={() => goToProduct(product)}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 8px', borderRadius: 10, cursor: 'pointer',
                    background: activeIdx === i ? 'rgba(124,58,237,0.14)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 9, flexShrink: 0, overflow: 'hidden',
                    background: '#181825', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {product.image
                      ? <img src={mediaUrl(product.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <PiGiftBold size={16} color="rgba(255,255,255,0.2)" />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.name}
                    </p>
                    {product.description && (
                      <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {product.description}
                      </p>
                    )}
                  </div>
                  <span style={{
                    flexShrink: 0, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                    fontSize: '0.8125rem', color: '#3DDC84',
                  }}>
                    {formatCurrency(product.effective_price ?? product.price)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   TOPBAR
═══════════════════════════════════════════════════════════════════════ */
export default function Topbar({ onSearch }) {
  const { user, isAuthenticated, logout } = useAuthStore()
  const location = useLocation()
  const navigate  = useNavigate()
  const authed    = isAuthenticated()
const { t } = useTranslation('common')

  const [authModal,   setAuthModal]   = useState({ open: false, tab: 'login' })
  const [mobileOpen,  setMobileOpen]  = useState(false)

  useEffect(() => { setMobileOpen(false) }, [location.pathname, location.search])

  const openLogin    = () => setAuthModal({ open: true, tab: 'login' })
  const openRegister = () => setAuthModal({ open: true, tab: 'register' })
  const closeAuth    = () => setAuthModal(m => ({ ...m, open: false }))

  useEffect(() => {
    const handler = (e) => setAuthModal({ open: true, tab: e.detail?.tab || 'login' })
    window.addEventListener('gmc:open-auth', handler)
    return () => window.removeEventListener('gmc:open-auth', handler)
  }, [])

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => getWallet().then(r => r.data),
    enabled: authed,
    staleTime: 30000,
  })

  const { data: allCategories = [] } = useQuery({
    queryKey: ['nav-categories'],
    queryFn: () => getCategories().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  // Build slug → category lookup (flat, all depths)
  const catBySlug = useMemo(() => {
    const map = {}
    const walk = (cats) => cats.forEach(c => { map[c.slug] = c; walk(c.children || []) })
    walk(allCategories)
    return map
  }, [allCategories])

  // Resolve nav items: replace categorySlug items/groups with DB children
  const resolvedNavItems = useMemo(() => NAV_ITEMS.map(item => {
    if (item.groups) {
      const groups = item.groups.map(group => {
        if (!group.categorySlug) return group
        const parent = catBySlug[group.categorySlug]
        const items = (parent?.children || [])
          .filter(c => c.is_active !== false)
          .map(c => ({
            label: c.name,
            to: `/?cat=${c.slug}`,
            emoji: c.icon,
            Icon: group.fallbackIcon,
            color: c.color || group.fallbackColor || group.color,
          }))
        return { ...group, items }
      })
      return { ...item, groups }
    }

    if (!item.categorySlug) return item
    const parent = catBySlug[item.categorySlug]
    const children = (parent?.children || [])
      .filter(c => c.is_active !== false)
      .map(c => ({
        label: c.name,
        to: `/?cat=${c.slug}`,
        emoji: c.icon || '📦',
        color: c.color || item.color,
      }))
    const viewAll = parent
      ? { label: item.viewAll?.label || `View All ${item.label}`, to: `/?cat=${parent.slug}` }
      : item.viewAll
    return { ...item, children, viewAll }
  }), [catBySlug])

  const handleLogout = () => { logout(); navigate('/') }
  const isActive = (item) => item.exact && location.pathname === '/' && !location.search

  return (
    <header style={{
      flexShrink: 0,
      background: '#09090F',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      position: 'sticky', top: 0, zIndex: 200,
    }}>
      <div style={{
        height: 54,
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem', gap: '0.5rem',
        maxWidth: 1400, margin: '0 auto', width: '100%',
      }}>

        {/* Hamburger - mobile only */}
        <button
          className="gmc-mobile-btn"
          onClick={() => setMobileOpen(o => !o)}
          style={{
            display: 'none', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 9, flexShrink: 0,
            background: mobileOpen ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${mobileOpen ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.09)'}`,
            cursor: 'pointer', color: 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 6 }}>
          <img
            src="/logo png.png"
            alt="GMC Store"
            className="gmc-logo"
            style={{ height: 90, width: 'auto', objectFit: 'contain', maxHeight: 90 }}
          />
        </Link>

        {/* Nav - hidden on mobile */}
        <nav className="gmc-topbar-nav" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          {resolvedNavItems.map(item => (
            <NavItem key={item.label} item={item} isActive={isActive(item)} />
          ))}
        </nav>

        {/* Search - hidden on mobile */}
        <div className="gmc-topbar-search">
          <SearchBox onQueryChange={onSearch} />
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>


          {/* Wallet chip - shown when logged in */}
          {authed && walletData != null && (
            <Link to="/wallet" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0 14px 0 10px', height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(61,220,132,0.12) 0%, rgba(61,220,132,0.06) 100%)',
                  border: '1px solid rgba(61,220,132,0.28)',
                  boxShadow: '0 0 0 0 rgba(61,220,132,0)',
                  transition: 'all 0.2s ease',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(61,220,132,0.6)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(61,220,132,0.2) 0%, rgba(61,220,132,0.1) 100%)'
                  e.currentTarget.style.boxShadow = '0 0 14px rgba(61,220,132,0.2)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(61,220,132,0.28)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(61,220,132,0.12) 0%, rgba(61,220,132,0.06) 100%)'
                  e.currentTarget.style.boxShadow = '0 0 0 0 rgba(61,220,132,0)'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                {/* icon container */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: 'rgba(61,220,132,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <TbWallet size={13} color="#3DDC84" strokeWidth={2} />
                </div>

                {/* amount */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.8125rem', fontWeight: 700,
                    color: '#3DDC84',
                    letterSpacing: '-0.01em',
                  }}>
                    {parseFloat(walletData.balance || 0).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.625rem', fontWeight: 600,
                    color: 'rgba(61,220,132,0.6)',
                    letterSpacing: '0.05em',
                  }}>DT</span>
                </div>
              </div>
            </Link>
          )}

          {authed && user ? (
            <UserMenu user={user} onLogout={handleLogout} />
          ) : (
            <>
              <button onClick={openLogin} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 13px', borderRadius: 7,
                background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.09)',
                color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem',
                cursor: 'pointer', transition: 'all 0.13s', whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' }}
              >
                <User size={13} /> {t('auth.login')}
              </button>
              <button onClick={openRegister} style={{
                display: 'flex', alignItems: 'center',
                padding: '5px 15px', borderRadius: 7,
                background: 'linear-gradient(135deg, #7C3AED, #4C1D95)',
                border: '1px solid rgba(124,58,237,0.4)',
                color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '0.8rem', fontWeight: 700,
                cursor: 'pointer', transition: 'opacity 0.13s, box-shadow 0.13s', whiteSpace: 'nowrap',
                boxShadow: '0 2px 10px rgba(124,58,237,0.4)',
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(124,58,237,0.55)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(124,58,237,0.4)' }}
              >
                {t('auth.signUp')}
              </button>
            </>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={authModal.open}
        onClose={closeAuth}
        defaultTab={authModal.tab}
      />

      {/* ── Mobile menu panel ────────────────────────────────────── */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', top: 54, left: 0, right: 0, bottom: 0,
          zIndex: 998, background: '#09090F',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          overflowY: 'auto', padding: '1rem',
          animation: 'navDropIn 0.2s ease',
        }}>

          {/* Mobile search */}
          <div style={{ marginBottom: '1.25rem' }}>
            <SearchBox mobile onNavigate={() => setMobileOpen(false)} />
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {resolvedNavItems.map(item => {
              const link = item.to || item.viewAll?.to || '/'
              const NavIcon = item.NavIcon
              return (
                <Link
                  key={item.label}
                  to={link}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 12, textDecoration: 'none',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: item.urgent ? item.color : 'var(--text-secondary)',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', fontWeight: 500,
                    transition: 'background 0.13s, color 0.13s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = item.color ? `${item.color}14` : 'rgba(255,255,255,0.07)'
                    e.currentTarget.style.color = item.color || 'white'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.color = item.urgent ? item.color : 'var(--text-secondary)'
                  }}
                >
                  <span style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: item.color ? `${item.color}18` : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${item.color ? `${item.color}30` : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <NavIcon size={18} color={item.color || 'rgba(255,255,255,0.5)'} />
                  </span>
                  {item.labelKey ? t(item.labelKey) : item.label}
                  {item.urgent && <span style={{ marginInlineStart: 'auto', fontSize: '0.75rem', opacity: 0.7, display: 'inline-block', transform: document.documentElement.dir === 'rtl' ? 'scaleX(-1)' : 'none' }}>→</span>}
                </Link>
              )
            })}
          </div>

          {/* Auth buttons (guest only) */}
          {!authed && (
            <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
              <button
                onClick={() => { setMobileOpen(false); openLogin() }}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem', cursor: 'pointer',
                }}
              >{t('auth.login')}</button>
              <button
                onClick={() => { setMobileOpen(false); openRegister() }}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#7C3AED,#4C1D95)',
                  border: 'none', color: 'var(--text-primary)',
                  fontFamily: 'Sora, sans-serif', fontWeight: 700,
                  fontSize: '0.875rem', cursor: 'pointer',
                }}
              >{t('auth.signUp')}</button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}




