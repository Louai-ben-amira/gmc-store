// Interactive star rating picker or display-only star row

export function Stars({ value, max = 5, size = 14, color = '#FFB800', emptyColor = 'rgba(255,184,0,0.2)' }) {
  return (
    <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.floor(value)
        const half   = !filled && i < value
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id={`h${i}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="50%" stopColor={color} />
                <stop offset="50%" stopColor={emptyColor} />
              </linearGradient>
            </defs>
            <polygon
              points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7"
              fill={filled ? color : half ? `url(#h${i})` : emptyColor}
            />
          </svg>
        )
      })}
    </span>
  )
}

export function StarPicker({ value, onChange, size = 26 }) {
  return (
    <span style={{ display: 'inline-flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, transition: 'transform 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width={size} height={size} viewBox="0 0 20 20">
            <polygon
              points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7"
              fill={n <= value ? '#FFB800' : 'rgba(255,184,0,0.18)'}
              stroke={n <= value ? '#FFB800' : 'rgba(255,184,0,0.3)'}
              strokeWidth="0.5"
            />
          </svg>
        </button>
      ))}
    </span>
  )
}
