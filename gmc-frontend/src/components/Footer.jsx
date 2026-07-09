import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TbArrowRight, TbChevronDown, TbBrandWhatsapp, TbBrandMessenger, TbBrandInstagram, TbDeviceMobile, TbWifi, TbBuildingBank, TbCurrencyBitcoin } from 'react-icons/tb'
import { SiVisa, SiMastercard } from 'react-icons/si'

/* ── Payment ticker items ─────────────────────────────────────────────── */
const PAYMENT_ITEMS = [
  { label: 'Visa', Icon: SiVisa, color: '#2357d6' },
  { label: 'Mastercard', Icon: SiMastercard, color: '#eb001b' },
  { label: 'D17', Icon: TbDeviceMobile, color: '#7C3AED' },
  { label: 'Ooredoo', Icon: TbDeviceMobile, color: '#e53e3e' },
  { label: 'Orange', Icon: TbDeviceMobile, color: '#f97316' },
  { label: 'Tunisie Telecom', Icon: TbWifi, color: '#3b82f6' },
  { label: 'Crypto', Icon: TbCurrencyBitcoin, color: '#f59e0b' },
  { label: 'Bank Transfer', Icon: TbBuildingBank, color: '#94a3b8' },
]

/* ── Footer nav columns are generated inside Footer so they can use t() ── */

/* ── Payment ticker ──────────────────────────────────────────────────── */
function PaymentTicker() {
  const tickerRef = useRef(null)
  useEffect(() => {
    const el = tickerRef.current
    if (!el) return
    let pos = 0, raf
    const step = () => {
      pos -= 0.4
      const half = el.scrollWidth / 2
      if (Math.abs(pos) >= half) pos = 0
      el.style.transform = `translateX(${pos}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const doubled = [...PAYMENT_ITEMS, ...PAYMENT_ITEMS]
  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', height: 48, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, zIndex: 2, background: 'linear-gradient(to right, var(--bg-elevated) 0%, transparent 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, zIndex: 2, background: 'linear-gradient(to left, var(--bg-elevated) 0%, transparent 100%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden' }}>
        <div ref={tickerRef} style={{ display: 'flex', alignItems: 'center', willChange: 'transform' }}>
          {doubled.map((pm, i) => {
            const Icon = pm.Icon
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 18px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, background: `${pm.color}10`, border: `1px solid ${pm.color}20` }}>
                  {Icon && <Icon size={13} color={pm.color} style={{ flexShrink: 0 }} />}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.07em', color: pm.color }}>{pm.label}</span>
                </div>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-strong)', flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Footer link ─────────────────────────────────────────────────────── */
function FooterLink({ link, color }) {
  const isRTL = document.documentElement.dir === 'rtl'
  return (
    <Link
      to={link.to}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: 'Inter, sans-serif', fontSize: '0.75rem',
        color: link.accent ? color : 'var(--text-muted)',
        textDecoration: 'none', transition: 'color 0.12s',
        fontWeight: link.accent ? 600 : 400,
        padding: '3px 0',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = color }}
      onMouseLeave={e => { e.currentTarget.style.color = link.accent ? color : 'var(--text-muted)' }}
    >
      <TbArrowRight size={9} style={{ opacity: link.accent ? 0.9 : 0.35, flexShrink: 0, transform: isRTL ? 'scaleX(-1)' : 'none' }} />
      {link.label}
    </Link>
  )
}

function SocialBtn({ label, color, Icon, href = '#' }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label} style={{
      width: 44, height: 44, borderRadius: 12,
      background: color + '18', border: '1px solid ' + color + '33',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textDecoration: 'none', transition: 'transform 0.13s, box-shadow 0.13s',
      flexShrink: 0,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px ' + color + '40' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    ><Icon size={20} color={color} /></a>
  )
}

function useIsMobile(maxWidth = 640) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxWidth}px)`).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const onChange = e => setMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [maxWidth])
  return mobile
}

/* ── Mobile accordion section ────────────────────────────────────────── */
function MobileFooterSection({ col }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.9375rem 2px', gap: 8,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.9375rem' }}>{col.emoji}</span>
          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: col.color }}>{col.title}</span>
        </span>
        <TbChevronDown size={16} style={{
          color: 'var(--text-muted)', flexShrink: 0,
          transition: 'transform 0.2s ease',
          transform: open ? 'rotate(180deg)' : 'none',
        }} />
      </button>
      {open && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '0 2px 0.75rem' }}>
          {col.links.map(link => (
            <li key={link.to}>
              <Link to={link.to} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0.625rem 4px', textDecoration: 'none',
                fontFamily: 'Inter, sans-serif', fontSize: '0.8438rem',
                color: link.accent ? col.color : 'var(--text-secondary)',
                fontWeight: link.accent ? 600 : 400,
              }}>
                <TbArrowRight size={11} style={{ opacity: link.accent ? 0.9 : 0.35, flexShrink: 0, transform: document.documentElement.dir === 'rtl' ? 'scaleX(-1)' : 'none' }} />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════════════════════════════════ */
export default function Footer() {
  const { t } = useTranslation('common')
  const isMobile = useIsMobile()

  const FOOTER_COLS = [
    {
      title: t('footer.topUpGames'), emoji: '🎮', color: '#7C3AED',
      links: [
        { label: 'Free Fire', to: '/?cat=free-fire' },
        { label: 'PUBG Mobile', to: '/?cat=pubg-mobile' },
        { label: 'Blood Strike', to: '/?cat=blood-strike' },
        { label: 'Mobile Legends', to: '/?cat=mobile-legends' },
        { label: t('footer.viewAll'), to: '/?cat=top-up-games', accent: true },
      ],
    },
    {
      title: t('footer.loginGames'), emoji: '🔑', color: '#7C3AED',
      links: [
        { label: 'Valorant', to: '/?cat=valorant' },
        { label: 'Fortnite', to: '/?cat=fortnite' },
        { label: 'Rocket League', to: '/?cat=rocket-league' },
        { label: 'Roblox', to: '/?cat=roblox' },
        { label: t('footer.viewAll'), to: '/?cat=login-games', accent: true },
      ],
    },
    {
      title: t('footer.accounts'), emoji: '👤', color: '#7C3AED',
      links: [
        { label: 'FC 26 Accounts', to: '/?cat=fc26-accounts' },
        { label: 'Valorant Accounts', to: '/?cat=valorant-accounts' },
        { label: 'Netflix', to: '/?cat=netflix' },
        { label: 'Spotify', to: '/?cat=spotify' },
        { label: t('footer.viewAll'), to: '/?cat=accounts', accent: true },
      ],
    },
    {
      title: t('footer.giftCards'), emoji: '🎁', color: '#7C3AED',
      links: [
        { label: 'Steam', to: '/?cat=steam-global' },
        { label: 'PlayStation', to: '/?cat=psn-usa' },
        { label: 'Xbox', to: '/?cat=xbox-usa' },
        { label: t('footer.viewAll'), to: '/?cat=gift-cards', accent: true },
      ],
    },
    {
      title: t('footer.internetOffers'), emoji: '📶', color: '#7C3AED',
      links: [
        { label: 'Ooredoo', to: '/?cat=ooredoo' },
        { label: 'Orange', to: '/?cat=orange' },
        { label: 'Tunisie Telecom', to: '/?cat=tunisie-telecom' },
      ],
    },
  ]

  return (
    <footer style={{ background: 'var(--bg-base)', borderTop: '1px solid rgba(124,58,237,0.12)', flexShrink: 0, marginTop: '1rem' }}>

      {/* Payment ticker */}
      <PaymentTicker />

      {/* Main content: accordion on mobile, grid on desktop */}
      {isMobile ? (
        <div style={{ padding: '1.5rem 1rem 1rem' }}>

          {/* ── Brand - centered ─────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.25rem' }}>
            <img src="/logo png.png" alt="GMC Store" style={{ height: 56, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(124,58,237,0.35))', marginBottom: '0.625rem' }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 1rem', maxWidth: 300 }}>
              {t('footer.tagline')}
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: '1rem' }}>
              <SocialBtn label="WhatsApp" color="#25d366" Icon={TbBrandWhatsapp} href="https://wa.me/21624027209" />
              <SocialBtn label="Facebook" color="#0084ff" Icon={TbBrandMessenger} href="https://www.facebook.com/profile.php?id=61590296486053" />
              <SocialBtn label="Instagram" color="#e1306c" Icon={TbBrandInstagram} href="https://www.instagram.com/gmcvstorex" />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(61,220,132,0.07)', border: '1px solid rgba(61,220,132,0.18)', borderRadius: 100, padding: '6px 14px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3DDC84', boxShadow: '0 0 6px #3DDC84', animation: 'dot-pulse 2s infinite', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: '#3DDC84' }}>{t('footer.supportOnline')}</span>
            </div>
          </div>

          {/* ── Collapsible category sections ───────────── */}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {FOOTER_COLS.map(col => (
              <MobileFooterSection key={col.title} col={col} />
            ))}
          </div>
        </div>
      ) : (
        <div className="footer-outer" style={{ padding: '2rem 1.5rem' }}>
          <div className="footer-grid" style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr repeat(5, 1fr)', gap: '1.75rem' }}>

            {/* ── Brand column ────────────────────────────── */}
            <div className="footer-brand">
              <div style={{ marginBottom: '1rem' }}>
                <img src="/logo png.png" alt="GMC Store" className="footer-logo" style={{ height: 80, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(124,58,237,0.35))' }} />
              </div>

              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 1.25rem', maxWidth: 260 }}>
                {t('footer.tagline')}
              </p>

              <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <SocialBtn label="WhatsApp" color="#25d366" Icon={TbBrandWhatsapp} href="https://wa.me/21624027209" />
                <SocialBtn label="Facebook" color="#0084ff" Icon={TbBrandMessenger} href="https://www.facebook.com/profile.php?id=61590296486053" />
                <SocialBtn label="Instagram" color="#e1306c" Icon={TbBrandInstagram} href="https://www.instagram.com/gmcvstorex" />
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(61,220,132,0.07)', border: '1px solid rgba(61,220,132,0.18)', borderRadius: 100, padding: '6px 14px' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3DDC84', boxShadow: '0 0 6px #3DDC84', animation: 'dot-pulse 2s infinite', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: '#3DDC84' }}>{t('footer.supportOnline')}</span>
              </div>
            </div>

            {/* ── Category columns ─────────────────────────── */}
            {FOOTER_COLS.map(col => (
              <div key={col.title} className="footer-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.875rem', paddingBottom: '0.75rem', borderBottom: `1px solid ${col.color}22` }}>
                  <span style={{ fontSize: '0.9rem' }}>{col.emoji}</span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8125rem', color: col.color }}>{col.title}</span>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {col.links.map(link => (
                    <li key={link.to}><FooterLink link={link} color={col.color} /></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom bar ──────────────────────────────────── */}
      <div style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', padding: '0.875rem 1.5rem' }}>
        <div className="footer-bottom" style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('footer.rights', { year: new Date().getFullYear() })}
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {t('footer.developedBy')}{' '}
            <span
              onClick={() => window.open('https://mail.google.com/mail/?view=cm&to=louaibenaamira@gmail.com&su=Hello&body=I%20saw%20your%20work%20and%20want%20to%20contact%20you.', '_blank', 'noopener')}
              style={{ color: '#B57BFF', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#d4a8ff'}
              onMouseLeave={e => e.currentTarget.style.color = '#B57BFF'}
            >
              LOUAI BEN AMIRA
            </span>
          </span>
          <div className="footer-bottom-links" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: t('footer.privacy'), to: '/privacy' },
              { label: t('footer.terms'), to: '/terms' },
              { label: t('footer.contact'), to: '/messenger' },
            ].map(({ label, to }) => (
              <Link key={label} to={to}
                style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >{label}</Link>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </footer>
  )
}
