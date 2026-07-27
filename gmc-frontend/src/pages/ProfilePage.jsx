import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getMe, updateMe, changePassword, getReferralStats } from '../api/auth'
import { getWishlist } from '../api/products'
import ProductCard from '../components/ProductCard'
import useAuthStore from '../store/authStore'
import useThemeStore from '../store/themeStore'
import useLanguageStore from '../store/languageStore'
import { useToast } from '../hooks/useToast'
import Topbar from '../components/Topbar'
import Footer from '../components/Footer'
import { formatCurrency, mediaUrl } from '../utils/formatters'
import {
  TbCamera, TbDeviceFloppy, TbLock, TbStar, TbWallet,
  TbEye, TbEyeOff, TbShieldLock, TbPhone, TbMail, TbAt,
  TbCircleCheck, TbUser, TbEdit, TbSparkles, TbFingerprint,
  TbCopy, TbCheck, TbUsers, TbGift, TbSun, TbMoon, TbLanguage,
  TbHeart,
} from 'react-icons/tb'

/* ─── Smart input ────────────────────────────────────────────────────── */
function FloatInput({ label, type = 'text', value, onChange, icon: Icon, accentColor = '#7C3AED', right, minLength, required }) {
  const [focused, setFocused] = useState(false)
  const ac = accentColor
  const lifted = focused || (value && value.length > 0)
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        background: focused ? 'var(--input-bg)' : 'var(--bg-elevated)',
        border: '1px solid ' + (focused ? ac + '88' : 'var(--border)'),
        borderRadius: 14, height: 58, padding: '0 14px', gap: 10,
        transition: 'all 0.18s', boxShadow: focused ? '0 0 0 3px ' + ac + '15' : 'none',
      }}>
        {Icon && (
          <Icon size={16} color={focused ? ac : 'var(--text-muted)'}
            style={{ flexShrink: 0, transition: 'color 0.18s', marginTop: lifted ? 10 : 0 }} />
        )}
        <div style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
          <label style={{
            position: 'absolute', left: 0, pointerEvents: 'none',
            fontFamily: 'Inter, sans-serif', fontWeight: lifted ? 600 : 400,
            top: lifted ? 9 : '50%',
            transform: lifted ? 'none' : 'translateY(-50%)',
            fontSize: lifted ? '0.5rem' : '0.9375rem',
            color: focused ? ac : (lifted ? 'var(--text-secondary)' : 'var(--text-muted)'),
            letterSpacing: lifted ? '0.12em' : '0',
            textTransform: lifted ? 'uppercase' : 'none',
            transition: 'top 0.16s, font-size 0.16s, color 0.16s, transform 0.16s',
          }}>{label}</label>
          <input
            type={type} value={value} onChange={onChange}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            required={required} minLength={minLength}
            style={{
              position: 'absolute', bottom: 7, left: 0, right: 0,
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
              fontSize: '0.9375rem', fontWeight: 500,
              width: '100%', paddingRight: right ? 28 : 0,
            }}
          />
        </div>
        {right && (
          <div style={{ flexShrink: 0, marginTop: lifted ? 10 : 0, transition: 'margin 0.16s' }}>
            {right}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Password strength bar ──────────────────────────────────────────── */
function StrengthBar({ password }) {
  if (!password) return null
  let s = 0
  if (password.length >= 8)        s++
  if (/[A-Z]/.test(password))      s++
  if (/[0-9]/.test(password))      s++
  if (/[^A-Za-z0-9]/.test(password)) s++
  const colors  = ['', '#ff4d6d', '#f59e0b', '#38BDF8', '#3DDC84']
  const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const c = colors[s], l = labels[s]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingLeft: 4 }}>
      <div style={{ flex: 1, display: 'flex', gap: 3 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: s >= i ? c : 'var(--border)', transition: 'background 0.25s ' + (i * 0.04) + 's' }} />
        ))}
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', color: c, transition: 'color 0.25s', minWidth: 36 }}>{l}</span>
    </div>
  )
}

/* ─── Decorative mini sparkline (wallet stat card) ──────────────────────── */
function MiniSparkline({ color }) {
  return (
    <svg width="64" height="28" viewBox="0 0 64 28" style={{ position: 'absolute', right: 12, top: 14, opacity: 0.9 }}>
      <polyline
        points="0,22 10,20 18,23 26,14 36,17 46,6 56,9 64,2"
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="64" cy="2" r="2.5" fill={color} />
    </svg>
  )
}

/* ─── Decorative dot grid (points stat card) ────────────────────────────── */
function MiniDotGrid({ color }) {
  return (
    <div style={{
      position: 'absolute', right: 10, top: 10, width: 54, height: 40,
      backgroundImage: `radial-gradient(${color}55 1px, transparent 1.5px)`,
      backgroundSize: '9px 9px', opacity: 0.8, pointerEvents: 'none',
    }} />
  )
}

/* ─── Stat card ──────────────────────────────────────────────────────── */
function StatCard({ Icon, label, value, color, sublabel, loading, decoration }) {
  return (
    <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid ' + color + '20', borderRadius: 16, padding: '1rem 1.125rem', position: 'relative', overflow: 'hidden', cursor: 'default' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, ' + color + '0d 0%, transparent 65%)', pointerEvents: 'none' }} />
      {!loading && decoration === 'sparkline' && <MiniSparkline color={color} />}
      {!loading && decoration === 'dots' && <MiniDotGrid color={color} />}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: color + '18', border: '1px solid ' + color + '2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} color={color} />
          </div>
        </div>
        {loading
          ? <>
              <div className="skeleton" style={{ height: 12, width: '50%', borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 24, width: '70%', borderRadius: 6 }} />
            </>
          : <>
              <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</p>
              <p style={{ margin: '2px 0 8px', fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.375rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{value}</p>
              {sublabel && (
                <span style={{ display: 'inline-block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color, background: color + '14', border: '1px solid ' + color + '30', borderRadius: 999, padding: '2px 9px' }}>{sublabel}</span>
              )}
            </>
        }
      </div>
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const { t } = useTranslation('profile')
  const { user, updateUser } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { language, toggleLanguage } = useLanguageStore()
  const isDark = theme === 'dark'
  const isAr   = language === 'ar'
  const toast   = useToast()
  const fileRef = useRef(null)

  const [profile,        setProfile]        = useState({ first_name: '', last_name: '', phone: '' })
  const [passwords,      setPasswords]      = useState({ old_password: '', new_password: '' })
  const [showOld,        setShowOld]        = useState(false)
  const [showNew,        setShowNew]        = useState(false)
  const [savingProfile,  setSavingProfile]  = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordOk,     setPasswordOk]     = useState(false)
  const [activeTab,      setActiveTab]      = useState('info') // 'info' | 'security' | 'referral'
  const [codeCopied,     setCodeCopied]     = useState(false)

  const { data: freshUser, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then(r => r.data),
    staleTime: 0,
  })
  const liveUser = freshUser || user

  useEffect(() => {
    if (freshUser) {
      updateUser(freshUser)
      setProfile({ first_name: freshUser.first_name || '', last_name: freshUser.last_name || '', phone: freshUser.phone || '' })
    }
  }, [freshUser])

  const { data: referralData } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => getReferralStats().then(r => r.data),
    enabled: activeTab === 'referral',
    staleTime: 30_000,
  })

  const { data: wishlistData, isLoading: wishlistLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => getWishlist().then(r => r.data),
    enabled: activeTab === 'favorites',
  })

  const [avatarHover,    setAvatarHover]    = useState(false)


  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const fd = new FormData(); fd.append('avatar', file)
    try { const { data } = await updateMe(fd); updateUser(data); toast.success('Avatar updated!') }
    catch { toast.error('Failed to update avatar.') }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault(); setSavingProfile(true)
    try {
      const fd = new FormData()
      Object.entries(profile).forEach(([k, v]) => fd.append(k, v))
      const { data } = await updateMe(fd); updateUser(data); toast.success('Profile updated!')
    } catch { toast.error('Failed to update profile.') } finally { setSavingProfile(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault(); setSavingPassword(true)
    try {
      await changePassword(passwords)
      toast.success('Password changed!')
      setPasswords({ old_password: '', new_password: '' })
      setPasswordOk(true); setTimeout(() => setPasswordOk(false), 2800)
    } catch (err) { toast.error(err.response?.data?.old_password?.[0] || 'Failed to change password.') }
    finally { setSavingPassword(false) }
  }

  const initials = ((liveUser?.first_name?.[0] || '') + (liveUser?.last_name?.[0] || '')).toUpperCase() || (liveUser?.username?.[0] || '?').toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />
      <div className='pb-nav' style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>

        {/* ── Decorative planet + stars (page-level, top-right) ── */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: 460, height: 380, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, rgba(167,139,250,0.55) 0%, rgba(124,58,237,0.35) 45%, transparent 72%)',
            boxShadow: '0 0 90px rgba(124,58,237,0.25)',
          }} />
          <div style={{
            position: 'absolute', top: 10, right: -110, width: 340, height: 90, borderRadius: '50%',
            border: '1px solid rgba(167,139,250,0.35)', transform: 'rotate(-18deg)',
          }} />
          {[...Array(14)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: `${(i * 37) % 260}px`, left: `${(i * 91) % 420}px`,
              width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2, borderRadius: '50%',
              background: '#fff', opacity: 0.15 + (i % 5) * 0.12,
            }} />
          ))}
        </div>

        <div className="profile-wrap" style={{ maxWidth: 1180, margin: '0 auto', padding: '2.25rem 1.5rem 4rem', position: 'relative', zIndex: 2 }}>

          {/* ── Identity panel ── */}
          <div className="profile-identity" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap', animation: 'profIn 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>

            {/* LEFT: avatar + meta */}
            <div className="profile-left" style={{ width: 260, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 22, padding: '1.75rem', backdropFilter: 'blur(20px)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              {/* avatar */}
              <div
                style={{ position: 'relative', cursor: 'pointer' }}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{
                  width: 88, height: 88, borderRadius: '50%', position: 'relative', overflow: 'hidden',
                  background: 'linear-gradient(135deg,#7C3AED,#4C1D95)',
                  border: '3px solid rgba(124,58,237,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'filter 0.2s',
                  filter: avatarHover ? 'brightness(0.6)' : 'brightness(1)',
                }}>
                  {liveUser?.avatar
                    ? <img src={mediaUrl(user.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '1.75rem', color: 'var(--text-primary)' }}>{initials}</span>
                  }
                </div>
                {/* hover overlay */}
                {avatarHover && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, zIndex: 3 }}>
                    <TbCamera size={18} color="var(--text-primary)" />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em' }}>CHANGE</span>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </div>

              {/* name */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>{liveUser?.username}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                  <TbAt size={11} color="var(--accent)" />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{liveUser?.username}</span>
                </div>
              </div>

              {/* role badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: liveUser?.role === 'admin' ? 'rgba(124,58,237,0.12)' : 'rgba(61,220,132,0.08)',
                border: '1px solid ' + (liveUser?.role === 'admin' ? 'rgba(124,58,237,0.3)' : 'rgba(61,220,132,0.2)'),
                borderRadius: 8, padding: '4px 10px',
              }}>
                {liveUser?.role === 'admin' ? <TbShieldLock size={11} color="#A78BFA" /> : <TbSparkles size={11} color="#3DDC84" />}
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', color: liveUser?.role === 'admin' ? 'var(--accent)' : '#3DDC84' }}>
                  {(liveUser?.role || 'MEMBER').toUpperCase()}
                </span>
              </div>

              {/* contact info */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { Icon: TbMail,  val: liveUser?.email },
                  { Icon: TbPhone, val: liveUser?.phone || '-' },
                ].map(({ Icon, val }) => (
                  <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9 }}>
                    <Icon size={12} color="var(--text-primary)" />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Preferences card */}
              <div style={{ width: '100%', boxSizing: 'border-box' }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.625rem' }}>{t('preferences.title')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

                  {/* Theme row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isDark ? <TbMoon size={14} color="#f59e0b" /> : <TbSun size={14} color="#7C3AED" />}
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t('preferences.theme')}</span>
                    </div>
                    <button onClick={toggleTheme} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px 5px 14px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.25)',
                      background: 'rgba(124,58,237,0.08)', cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: '#A78BFA',
                      transition: 'background 0.14s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.16)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
                    >
                      {isDark ? t('preferences.dark') : t('preferences.light')}
                      <svg width="9" height="6" viewBox="0 0 10 6" style={{ opacity: 0.7 }}>
                        <path d="M1 1l4 4 4-4" stroke="#A78BFA" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  {/* Language row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TbLanguage size={14} color="var(--text-primary)" />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t('preferences.language')}</span>
                    </div>
                    <button onClick={toggleLanguage} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px 5px 14px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.25)',
                      background: 'rgba(124,58,237,0.08)', cursor: 'pointer',
                      fontFamily: isAr ? "'Tajawal', sans-serif" : 'Inter, sans-serif',
                      fontSize: '0.75rem', fontWeight: 700, color: '#A78BFA',
                      transition: 'background 0.14s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.16)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
                    >
                      {isAr ? 'العربية' : 'English'}
                      <svg width="9" height="6" viewBox="0 0 10 6" style={{ opacity: 0.7 }}>
                        <path d="M1 1l4 4 4-4" stroke="#A78BFA" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                </div>
              </div>
            </div>

            {/* RIGHT: header + stats + tabs + forms */}
            <div className="profile-right" style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* header */}
              <div>
                <h1 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '1.875rem', letterSpacing: '-0.02em' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Your </span>
                  <span style={{ color: 'var(--accent)' }}>Profile</span>
                </h1>
                <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Manage your personal information and account settings.
                </p>
              </div>

              {/* stat row */}
              <div className="profile-stat-row" style={{ display: 'flex', gap: 10 }}>
                <StatCard Icon={TbWallet} label="Wallet Balance" value={formatCurrency(liveUser?.balance || 0)} color="#3DDC84" sublabel="AVAILABLE FUNDS" loading={meLoading && !liveUser} decoration="sparkline" />
                <StatCard Icon={TbStar}   label="Reward Points"  value={(liveUser?.points || 0) + ' pts'}      color="#f59e0b" sublabel="LOYALTY POINTS" loading={meLoading && !liveUser} decoration="dots" />
              </div>

              {/* tab switcher (underline style) */}
              <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                {[
                  { id: 'info',     label: t('sections.personalInfo'), Icon: TbEdit },
                  { id: 'security', label: t('sections.security'),     Icon: TbFingerprint },
                  { id: 'referral', label: t('sections.referrals'),    Icon: TbUsers },
                  { id: 'favorites', label: t('sections.favorites'),   Icon: TbHeart },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 0 10px', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: '2px solid ' + (activeTab === tab.id ? 'var(--accent)' : 'transparent'),
                    marginBottom: -1,
                    color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem',
                    transition: 'all 0.18s',
                  }}>
                    <tab.Icon size={15} color={activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)'} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Personal info form ── */}
              {activeTab === 'info' && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.5rem', backdropFilter: 'blur(20px)', animation: 'tabIn 0.25s ease both' }}>
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div className="profile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                      <FloatInput label="First Name" value={profile.first_name} onChange={e => setProfile({ ...profile, first_name: e.target.value })} icon={TbUser} />
                      <FloatInput label="Last Name"  value={profile.last_name}  onChange={e => setProfile({ ...profile, last_name: e.target.value })}  icon={TbUser} />
                    </div>
                    <FloatInput label="Phone Number" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} icon={TbPhone} />

                    {/* read-only row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
                      <TbMail size={14} color="var(--text-primary)" />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', flex: 1 }}>{liveUser?.email}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>CANNOT CHANGE</span>
                    </div>

                    <button type="submit" disabled={savingProfile} style={{
                      marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px', borderRadius: 13, border: 'none', cursor: savingProfile ? 'wait' : 'pointer',
                      background: savingProfile ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7C3AED 0%,#5b21b6 100%)',
                      color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem',
                      boxShadow: savingProfile ? 'none' : '0 6px 24px rgba(124,58,237,0.35)',
                      transition: 'all 0.2s',
                    }}>
                      <TbDeviceFloppy size={17} />
                      {savingProfile ? t('save.saving') : t('save.label')}
                    </button>
                  </form>
                </div>
              )}

              {/* ── Security form ── */}
              {activeTab === 'security' && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.5rem', backdropFilter: 'blur(20px)', animation: 'tabIn 0.25s ease both' }}>
                  {/* info strip */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 12, marginBottom: '1rem' }}>
                    <TbShieldLock size={14} color="#38BDF8" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Use a strong password with uppercase, numbers, and symbols.</p>
                  </div>
                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <FloatInput
                      label="Current Password" type={showOld ? 'text' : 'password'}
                      value={passwords.old_password}
                      onChange={e => setPasswords({ ...passwords, old_password: e.target.value })}
                      icon={TbLock} accentColor="#38BDF8" required
                      right={
                        <button type="button" onClick={() => setShowOld(v => !v)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0, padding: 0 }}>
                          {showOld ? <TbEyeOff size={15} /> : <TbEye size={15} />}
                        </button>
                      }
                    />
                    <div>
                      <FloatInput
                        label="New Password" type={showNew ? 'text' : 'password'}
                        value={passwords.new_password}
                        onChange={e => setPasswords({ ...passwords, new_password: e.target.value })}
                        icon={TbFingerprint} accentColor="#38BDF8" required minLength={8}
                        right={
                          <button type="button" onClick={() => setShowNew(v => !v)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0, padding: 0 }}>
                            {showNew ? <TbEyeOff size={15} /> : <TbEye size={15} />}
                          </button>
                        }
                      />
                      <StrengthBar password={passwords.new_password} />
                    </div>

                    <button type="submit" disabled={savingPassword} style={{
                      marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px', borderRadius: 13, border: '1px solid ' + (passwordOk ? 'rgba(61,220,132,0.4)' : 'rgba(56,189,248,0.25)'),
                      cursor: savingPassword ? 'wait' : 'pointer',
                      background: passwordOk ? 'rgba(61,220,132,0.1)' : 'rgba(56,189,248,0.08)',
                      color: passwordOk ? '#3DDC84' : '#38BDF8',
                      fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem',
                      transition: 'all 0.25s', boxShadow: passwordOk ? '0 0 20px rgba(61,220,132,0.15)' : 'none',
                    }}>
                      {passwordOk
                        ? <><TbCircleCheck size={17} /> Password Updated!</>
                        : <><TbLock size={17} /> {savingPassword ? 'Updating…' : 'Update Password'}</>
                      }
                    </button>
                  </form>
                </div>
              )}

              {/* ── Referral panel ── */}
              {activeTab === 'referral' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'tabIn 0.25s ease both' }}>

                  {/* Your code card */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.5rem', backdropFilter: 'blur(20px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                      <TbGift size={16} color="#f59e0b" />
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Your Referral Code</span>
                    </div>

                    {/* Code display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 13, marginBottom: '0.75rem' }}>
                      <span style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1.25rem', letterSpacing: '0.1em', color: '#f59e0b' }}>
                        {referralData?.referral_code || liveUser?.referral_code || '…'}
                      </span>
                      <button
                        onClick={() => {
                          const code = referralData?.referral_code || liveUser?.referral_code
                          if (code) {
                            navigator.clipboard.writeText(code)
                            setCodeCopied(true)
                            setTimeout(() => setCodeCopied(false), 2000)
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: codeCopied ? 'rgba(61,220,132,0.15)' : 'rgba(245,158,11,0.12)', color: codeCopied ? '#3DDC84' : '#f59e0b', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8125rem', transition: 'all 0.18s' }}
                      >
                        {codeCopied ? <><TbCheck size={14} /> Copied!</> : <><TbCopy size={14} /> Copy</>}
                      </button>
                    </div>

                    {/* Share text */}
                    <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Share your code and earn <strong style={{ color: '#f59e0b' }}>+2 DT</strong> for every friend who signs up - as long as your wallet balance is <strong style={{ color: '#f59e0b' }}>≥ 10 DT</strong> at the time they join.
                    </p>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <StatCard Icon={TbUsers} label="Friends Joined" value={referralData?.referrals_count ?? '-'} color="#A78BFA" sublabel="REFERRALS" />
                    <StatCard Icon={TbGift}  label="DT Earned"      value={referralData?.total_earned != null ? `${parseFloat(referralData.total_earned).toFixed(2)} DT` : '-'} color="#f59e0b" sublabel="BONUS CREDITED" />
                  </div>

                  {/* History list */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.25rem', backdropFilter: 'blur(20px)' }}>
                    <p style={{ margin: '0 0 1rem', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Referral History</p>

                    {!referralData && (
                      <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Loading…</p>
                    )}
                    {referralData && referralData.history.length === 0 && (
                      <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No referrals yet. Share your code to start earning!</p>
                    )}
                    {referralData?.history?.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < referralData.history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        {/* Avatar placeholder */}
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <TbUser size={15} color="#A78BFA" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.username}
                          </p>
                          <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {item.was_eligible
                            ? <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem', color: '#3DDC84' }}>+{parseFloat(item.amount).toFixed(2)} DT</span>
                            : <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not eligible</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Favorites (wishlist) ── */}
              {activeTab === 'favorites' && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.5rem', backdropFilter: 'blur(20px)', animation: 'tabIn 0.25s ease both' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                    <TbHeart size={16} color="#FF5060" />
                    <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{t('sections.favorites')}</span>
                    {wishlistData && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>({wishlistData.length})</span>}
                  </div>

                  {wishlistLoading && (
                    <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>Loading…</p>
                  )}
                  {!wishlistLoading && wishlistData?.length === 0 && (
                    <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                      No favorites yet - tap the ♥ on any product to save it here.
                    </p>
                  )}
                  {!wishlistLoading && wishlistData?.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                      {wishlistData.map((p, i) => (
                        <ProductCard key={p.id} product={p} index={i} isAuthenticated={true} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        <Footer />
      </div>

      <style>{`
        @keyframes profIn {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes tabIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}







