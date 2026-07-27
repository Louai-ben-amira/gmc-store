import { useNavigate } from 'react-router-dom'
import { TbError404, TbArrowLeft, TbHome, TbMessageCircle } from 'react-icons/tb'

export default function NotFoundPage() {
  const navigate = useNavigate()

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
      {/* Glowing orb */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', animation: 'fadeSlideUp 0.4s ease both' }}>
        {/* 404 icon */}
        <div style={{
          width: 96,
          height: 96,
          borderRadius: 28,
          background: 'rgba(124,58,237,0.1)',
          border: '1px solid rgba(124,58,237,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
        }}>
          <TbError404 size={48} color="#7C3AED" />
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: 'rgba(124,58,237,0.1)',
          border: '1px solid rgba(124,58,237,0.25)',
          borderRadius: 100,
          padding: '4px 14px',
          marginBottom: '1.25rem',
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#B57BFF',
          }}>
            Error 404
          </span>
        </div>

        <h1 style={{
          fontFamily: 'Sora, sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          color: 'var(--text-primary)',
          margin: '0 0 0.75rem',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
        }}>
          Page not found
        </h1>

        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '1rem',
          color: 'var(--text-muted)',
          margin: '0 0 2.5rem',
          maxWidth: 380,
          lineHeight: 1.6,
        }}>
          The link you followed may be broken, or the page may have been removed.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '0.625rem 1.25rem',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <TbArrowLeft size={16} /> Go back
          </button>

          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '0.625rem 1.25rem',
              borderRadius: 10,
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.35)',
              color: '#B57BFF',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
          >
            <TbHome size={16} /> Back to shop
          </button>

          <button
            onClick={() => navigate('/support')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '0.625rem 1.25rem',
              borderRadius: 10,
              background: 'rgba(61,220,132,0.08)',
              border: '1px solid rgba(61,220,132,0.2)',
              color: '#3DDC84',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(61,220,132,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(61,220,132,0.08)'}
          >
            <TbMessageCircle size={16} /> Support
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
