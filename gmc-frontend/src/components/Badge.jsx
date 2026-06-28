import { CATEGORY_LABELS } from '../utils/formatters'

export function CategoryBadge({ category }) {
  const colors = {
    gift_cards:  { bg: 'rgba(0,245,255,0.12)',  color: 'var(--magenta)', border: 'rgba(0,245,255,0.25)' },
    valorant:    { bg: 'rgba(255,68,102,0.15)',  color: '#FF6680', border: 'rgba(255,68,102,0.3)' },
    steam:       { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
    epic:        { bg: 'rgba(0,229,160,0.12)',   color: '#00E5A0', border: 'rgba(0,229,160,0.25)' },
    battle_pass: { bg: 'rgba(245,200,66,0.12)',  color: '#F5C842', border: 'rgba(245,200,66,0.25)' },
    ooredoo:     { bg: 'rgba(255,68,102,0.15)',  color: '#FF6680', border: 'rgba(255,68,102,0.3)' },
    other:       { bg: 'rgba(107,96,128,0.2)',   color: '#9B8FBA', border: 'rgba(107,96,128,0.3)' },
  }
  const c = colors[category] || colors.other
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: '0.6875rem', fontWeight: 700,
      padding: '2px 10px', borderRadius: '999px', letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {CATEGORY_LABELS[category] || category}
    </span>
  )
}

export function StatusBadge({ status }) {
  const styles = {
    completed: { bg: 'rgba(0,229,160,0.12)', color: 'var(--success)', border: 'rgba(0,229,160,0.25)' },
    pending:   { bg: 'rgba(245,200,66,0.12)', color: 'var(--gold)',    border: 'rgba(245,200,66,0.25)' },
    cancelled: { bg: 'rgba(255,68,102,0.12)', color: 'var(--danger)',  border: 'rgba(255,68,102,0.25)' },
    approved:  { bg: 'rgba(0,229,160,0.12)', color: 'var(--success)', border: 'rgba(0,229,160,0.25)' },
    rejected:  { bg: 'rgba(255,68,102,0.12)', color: 'var(--danger)',  border: 'rgba(255,68,102,0.25)' },
  }
  const s = styles[status] || styles.pending
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: '0.6875rem', fontWeight: 700,
      padding: '2px 10px', borderRadius: '999px', textTransform: 'capitalize',
    }}>
      {status}
    </span>
  )
}

