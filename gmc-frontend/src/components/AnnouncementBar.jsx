import { useState, useEffect, useRef } from 'react'
import { X, ChevronRight } from 'lucide-react'

const MESSAGES = [
  { icon: '🎁', text: 'STEAM GIFT CARDS RESTOCKED' },
  { icon: '⚡', text: 'INSTANT DELIVERY ON ALL TOP-UPS' },
  { icon: '🎮', text: 'FREE FIRE DIAMONDS - UP TO 30% OFF TODAY' },
  { icon: '💎', text: 'VALORANT VP PACKS BACK IN STOCK' },
  { icon: '🔥', text: 'LIMITED TIME OFFER - UP TO 50% OFF' },
  { icon: '🎉', text: 'NEW ARRIVALS - CHECK OUT OUR LATEST GAMES' },
  { icon: '💰', text: 'EARN REWARDS POINTS ON EVERY PURCHASE' },
]

export default function AnnouncementBar() {
  const [closed, setClosed] = useState(false)
  const tickerRef = useRef(null)

  useEffect(() => {
    if (closed) return
    const el = tickerRef.current
    if (!el) return
    let pos = 0
    let raf
    const step = () => {
      pos -= 0.45
      const half = el.scrollWidth / 2
      if (Math.abs(pos) >= half) pos = 0
      el.style.transform = `translateX(${pos}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [closed])

  if (closed) return null

  const doubled = [...MESSAGES, ...MESSAGES]

  return (
    <div style={{
      background: '#07070F',
      borderBottom: '1px solid rgba(124,58,237,0.18)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 300,
      height: 38,
      overflow: 'hidden',
    }}>
      {/* Left fade */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, zIndex: 2,
        background: 'linear-gradient(to right, #07070F 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
      {/* Right fade */}
      <div className="announce-fade-right" style={{
        position: 'absolute', right: 160, top: 0, bottom: 0, width: 80, zIndex: 2,
        background: 'linear-gradient(to left, #07070F 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Scrolling ticker */}
      <div className="announce-ticker" style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, right: 160,
        display: 'flex', alignItems: 'center', overflow: 'hidden',
      }}>
        <div ref={tickerRef} style={{ display: 'flex', alignItems: 'center', willChange: 'transform' }}>
          {doubled.map((msg, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 28px', whiteSpace: 'nowrap',
              fontFamily: 'Inter, sans-serif', fontSize: '0.75rem',
              fontWeight: 700, letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
            }}>
              <span style={{ fontSize: '0.8125rem' }}>{msg.icon}</span>
              {msg.text}
              <span style={{
                display: 'inline-block', width: 3, height: 3, borderRadius: '50%',
                background: 'rgba(124,58,237,0.6)', margin: '0 4px',
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Right CTA + close */}
      <div className="announce-close" style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 160,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 8, paddingRight: 12, zIndex: 3,
        background: '#07070F',
        borderLeft: '1px solid rgba(124,58,237,0.12)',
      }}>
        <a className="announce-cta" href="/?flash=1" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 5,
          background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
          color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem',
          fontWeight: 700, letterSpacing: '0.04em', textDecoration: 'none', whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.25)'; e.currentTarget.style.color = 'white' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.12)'; e.currentTarget.style.color = '#A78BFA' }}
        >
          View All <ChevronRight size={9} strokeWidth={3} />
        </a>
        <button onClick={() => setClosed(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 4, transition: 'color 0.15s', flexShrink: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}


