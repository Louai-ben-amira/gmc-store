import { TbTools, TbBrandTelegram } from 'react-icons/tb'

export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '2rem',
      textAlign: 'center',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', animation: 'fadeSlideUp 0.4s ease both' }}>
        {/* Icon */}
        <div style={{
          width: 96,
          height: 96,
          borderRadius: 28,
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
        }}>
          <TbTools size={46} color="#f59e0b" />
        </div>

        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 100,
          padding: '4px 14px',
          marginBottom: '1.25rem',
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.5625rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#f59e0b',
          }}>
            Maintenance Mode
          </span>
        </div>

        <h1 style={{
          fontFamily: 'Sora, sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(1.75rem, 5vw, 3rem)',
          color: 'var(--text-primary)',
          margin: '0 0 0.75rem',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
        }}>
          We'll be right back
        </h1>

        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '1rem',
          color: 'var(--text-muted)',
          margin: '0 0 2.5rem',
          maxWidth: 420,
          lineHeight: 1.65,
        }}>
          GMC Store is undergoing scheduled maintenance to improve your experience.
          We expect to be back shortly - thank you for your patience.
        </p>

        {/* Animated progress bar */}
        <div style={{
          width: 280,
          height: 4,
          borderRadius: 2,
          background: 'rgba(245,158,11,0.12)',
          margin: '0 auto 2rem',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: '40%',
            background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
            animation: 'scan 1.8s ease-in-out infinite',
            borderRadius: 2,
          }} />
        </div>

        {/* Telegram link */}
        <a
          href="https://t.me/gmcstore"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '0.625rem 1.5rem',
            borderRadius: 10,
            background: 'rgba(27,154,238,0.1)',
            border: '1px solid rgba(27,154,238,0.25)',
            color: '#38BDF8',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.13s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(27,154,238,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(27,154,238,0.1)'}
        >
          <TbBrandTelegram size={17} />
          Follow us on Telegram for updates
        </a>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  )
}
