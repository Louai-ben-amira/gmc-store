import { useState } from 'react'
import { Lock, X, AlertTriangle } from 'lucide-react'

const fieldStyle = {
  width: '100%', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
  borderRadius: 7, padding: '8px 12px', color: 'var(--text-primary)',
  outline: 'none', transition: 'border-color 0.14s',
}

function FieldInput({ field, value, onChange }) {
  const { key, label, type = 'text', required, placeholder } = field

  const common = {
    id: key,
    value: value || '',
    onChange: e => onChange(key, e.target.value),
    placeholder: placeholder || label,
    onFocus:  e => { e.target.style.borderColor = 'var(--accent)' },
    onBlur:   e => { e.target.style.borderColor = 'var(--border-strong)' },
  }

  if (type === 'textarea') {
    return <textarea {...common} rows={3} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.55 }} />
  }

  return (
    <input
      type={type}
      {...common}
      autoComplete={type === 'password' ? 'new-password' : undefined}
      style={{ ...fieldStyle, height: 38 }}
    />
  )
}

export default function AccountRequiredModal({ product, onConfirm, onCancel }) {
  const [values, setValues] = useState({})
  const [agreed, setAgreed] = useState(false)
  const [error,  setError]  = useState('')

  // Use product.required_fields if present, otherwise empty (no fields needed)
  const fields = product?.required_fields || []

  const upd = (key, val) => setValues(prev => ({ ...prev, [key]: val }))

  const handleProceed = () => {
    setError('')

    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`Please fill in: ${f.label}`)
        return
      }
    }
    if (fields.length > 0 && !agreed) {
      setError('You must agree before proceeding.')
      return
    }

    const payload = { ...values }
    onConfirm(payload)
    setValues({})
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 440, maxHeight: '90vh',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 14, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeSlideUp 0.25s ease both',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Lock size={16} color="var(--accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Account Details Required
            </p>
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {product?.name}
            </p>
          </div>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', padding: 4, transition: 'color 0.14s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Trust notice */}
          <div style={{
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            borderRadius: 8, padding: '10px 12px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <Lock size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Your information is <strong style={{ color: 'var(--accent)' }}>end-to-end encrypted</strong>, used only for this order, and <strong style={{ color: 'var(--accent)' }}>permanently deleted</strong> after service completion.
            </p>
          </div>

          {fields.length === 0 && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              No additional information required for this product.
            </p>
          )}

          {/* Dynamic fields from product.required_fields */}
          {fields.map(f => (
            <div key={f.key}>
              <label htmlFor={f.key} style={{
                display: 'block', marginBottom: 5,
                fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600,
                color: 'var(--text-muted)', letterSpacing: '0.03em',
              }}>
                {f.label}
                {f.required && <span style={{ color: 'var(--urgent)', marginLeft: 3 }}>*</span>}
              </label>
              <FieldInput field={f} value={values[f.key]} onChange={upd} />
            </div>
          ))}

          {/* Agreement checkbox — only if there are fields */}
          {fields.length > 0 && (
            <label style={{ display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                style={{ marginTop: 3, width: 15, height: 15, accentColor: 'var(--accent)', flexShrink: 0 }}
              />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                I confirm these details are correct and agree that they will be used{' '}
                <strong style={{ color: 'var(--text-primary)' }}>only for this order</strong>{' '}
                and deleted upon completion.
              </span>
            </label>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} color="var(--urgent)" />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--urgent)' }}>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button className="btn-secondary" onClick={onCancel} style={{ flex: 1, justifyContent: 'center' }}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleProceed} style={{ flex: 1, justifyContent: 'center' }}>
            &gt; Proceed to Order
          </button>
        </div>
      </div>
    </div>
  )
}
