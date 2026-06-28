import { useEffect } from 'react'
import { useToastStore } from '../hooks/useToast'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

const CONFIG = {
  success: { icon: CheckCircle, color: 'var(--success)',  border: 'rgba(0,229,160,0.3)',   glow: 'rgba(0,229,160,0.15)' },
  error:   { icon: AlertCircle, color: 'var(--danger)',   border: 'rgba(255,68,102,0.3)',  glow: 'rgba(255,68,102,0.15)' },
  info:    { icon: Info,        color: 'var(--magenta)',          border: 'rgba(0,245,255,0.25)', glow: 'rgba(0,245,255,0.08)' },
}

function ToastItem({ t, onRemove }) {
  const cfg = CONFIG[t.type] || CONFIG.info
  const Icon = cfg.icon

  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), 4200)
    return () => clearTimeout(timer)
  }, [t.id, onRemove])

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${cfg.border}`,
      borderRadius: '0.875rem',
      padding: '0.875rem 1rem',
      display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
      minWidth: '300px', maxWidth: '400px',
      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.border}`,
      background: `linear-gradient(135deg, var(--bg-elevated) 0%, ${cfg.glow} 100%)`,
      animation: 'slideInRight 0.3s ease both',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <Icon size={18} color={cfg.color} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ flex: 1, color: 'var(--white-primary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{t.message}</span>
      <button
        onClick={() => onRemove(t.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', flexShrink: 0 }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--white-primary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
      >
        <X size={14} />
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: '2px', background: cfg.color,
        borderRadius: '0 0 0 0.875rem',
        animation: 'toastProgress 4s linear forwards',
      }} />
    </div>
  )
}

export default function Toast() {
  const { toasts, removeToast } = useToastStore()
  return (
    <div style={{
      position: 'fixed', top: '1.25rem', right: '1.25rem',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.625rem',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastItem t={t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  )
}

