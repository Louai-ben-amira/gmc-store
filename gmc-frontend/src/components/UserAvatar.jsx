import { mediaUrl } from '../utils/formatters'

function getInitials(user) {
  if (!user) return '?'
  const first = user.first_name?.[0] || ''
  const last  = user.last_name?.[0]  || ''
  if (first || last) return (first + last).toUpperCase()
  return (user.username?.[0] || '?').toUpperCase()
}

export default function UserAvatar({ user, size = 36, fontSize, borderRadius = '50%', style = {} }) {
  const initials   = getInitials(user)
  const computedFs = fontSize ?? Math.round(size * 0.38)

  const base = {
    width: size, height: size, borderRadius,
    background: 'linear-gradient(135deg, #7C3AED, #4C1D95)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
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
      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: computedFs, color: '#fff', lineHeight: 1, userSelect: 'none' }}>
        {initials}
      </span>
    </div>
  )
}
