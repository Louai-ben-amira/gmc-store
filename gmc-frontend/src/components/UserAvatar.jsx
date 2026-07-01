import { mediaUrl } from '../utils/formatters'

const GRADIENTS = [
  ['#7C3AED', '#4C1D95'],
  ['#DB2777', '#831843'],
  ['#0891B2', '#164E63'],
  ['#059669', '#064E3B'],
  ['#D97706', '#78350F'],
  ['#DC2626', '#7F1D1D'],
  ['#7C3AED', '#1D4ED8'],
]

function getInitials(user) {
  if (!user) return '?'
  const first = user.first_name?.[0] || ''
  const last  = user.last_name?.[0]  || ''
  if (first || last) return (first + last).toUpperCase()
  return (user.username?.[0] || '?').toUpperCase()
}

function pickGradient(user) {
  const key = user?.username || user?.email || '?'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash)
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

export default function UserAvatar({ user, size = 36, fontSize, borderRadius = '50%', style = {} }) {
  const initials   = getInitials(user)
  const computedFs = fontSize ?? Math.round(size * 0.38)
  const [c1, c2]   = pickGradient(user)

  const base = {
    width: size, height: size, borderRadius,
    background: `linear-gradient(135deg, ${c1}, ${c2})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
    boxShadow: `0 0 0 2px ${c1}55, 0 2px 8px ${c1}40`,
    position: 'relative',
    ...style,
  }

  if (user?.avatar) {
    return (
      <div style={base}>
        <img src={mediaUrl(user.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }

  return (
    <div style={base}>
      {/* subtle inner highlight */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.18) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      <span style={{
        fontFamily: 'Sora, sans-serif',
        fontWeight: 800,
        fontSize: computedFs,
        color: '#fff',
        lineHeight: 1,
        userSelect: 'none',
        letterSpacing: '-0.01em',
        textShadow: '0 1px 4px rgba(0,0,0,0.35)',
        position: 'relative',
        zIndex: 1,
      }}>
        {initials}
      </span>
    </div>
  )
}
