import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const dragStartY = useRef(null)

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const maxWidths = { sm: '420px', md: '560px', lg: '680px', xl: '800px' }

  // Swipe-down-to-dismiss on mobile bottom sheet
  const handleTouchStart = (e) => { dragStartY.current = e.touches[0].clientY }
  const handleTouchEnd   = (e) => {
    if (dragStartY.current !== null && e.changedTouches[0].clientY - dragStartY.current > 80) onClose()
    dragStartY.current = null
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="modal-sheet-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(5,2,12,0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-sheet-panel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-border)',
          borderRadius: '1.125rem',
          width: '100%', maxWidth: maxWidths[size],
          maxHeight: '90dvh', overflow: 'auto',
          animation: 'scaleIn 0.22s ease both',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(123,47,255,0.1)',
        }}>
        {/* Drag handle — visible only on mobile when acting as a sheet */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--bg-border)',
          background: 'linear-gradient(135deg, var(--bg-elevated) 0%, rgba(123,47,255,0.06) 100%)',
          borderRadius: '1.125rem 1.125rem 0 0',
        }}>
          <h2 style={{
            margin: 0, fontSize: '1.0625rem', fontWeight: 700,
            color: 'var(--white-primary)',
            fontFamily: 'Orbitron, monospace',
            letterSpacing: '0.01em',
          }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(123,47,255,0.1)', border: '1px solid rgba(123,47,255,0.2)',
              borderRadius: '0.5rem', cursor: 'pointer',
              color: 'var(--muted)',
              /* 44px touch target */
              minWidth: 44, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,68,102,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,68,102,0.3)'; e.currentTarget.style.color = 'var(--danger)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(123,47,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(123,47,255,0.2)'; e.currentTarget.style.color = 'var(--muted)' }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '1.5rem' }}>{children}</div>
      </div>
    </div>
  )
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false, loading = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p style={{ color: 'var(--lavender)', marginBottom: '1.5rem', lineHeight: 1.65, fontSize: '0.9375rem' }}>{message}</p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          className={danger ? 'btn-secondary' : 'btn-primary'}
          onClick={onConfirm}
          disabled={loading}
          style={danger ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : {}}
        >
          {loading ? 'Processing…' : confirmText}
        </button>
      </div>
    </Modal>
  )
}
