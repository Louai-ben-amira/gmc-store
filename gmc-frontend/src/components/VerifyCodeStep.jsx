import { useState, useRef } from 'react'
import { verifyEmailCode, resendVerification } from '../api/auth'
import { MailCheck, ArrowLeft } from 'lucide-react'

/**
 * Shared "enter the 6-digit code we emailed you" step. Used after
 * registration (mandatory - no account access until verified) and when
 * LoginView rejects sign-in with error: 'email_not_verified'.
 */
export default function VerifyCodeStep({ email, onVerified, onBack }) {
  const [code, setCode]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent]     = useState(false)
  const [remaining, setRemaining] = useState(3)
  const inputRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (code.trim().length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true)
    setError('')
    try {
      const { data } = await verifyEmailCode(email, code.trim())
      onVerified(data.user, data.access, data.refresh)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      const { data } = await resendVerification(email)
      setResent(true)
      if (typeof data.resends_remaining === 'number') setRemaining(data.resends_remaining)
      setTimeout(() => setResent(false), 4000)
    } catch (err) {
      if (err.response?.data?.error === 'max_resends_reached') {
        setRemaining(0)
        setError('Maximum resend attempts reached. Contact support.')
      } else {
        setError('Could not resend the code. Try again shortly.')
      }
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{ textAlign: 'center', padding: '0.5rem 0 0.25rem' }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%', background: 'rgba(61,220,132,0.12)',
        border: '1px solid rgba(61,220,132,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1rem',
      }}>
        <MailCheck size={22} color="#3DDC84" />
      </div>
      <p style={{ color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>
        📧 Enter your verification code
      </p>
      <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', lineHeight: 1.5, margin: '0 0 1.25rem' }}>
        We sent a 6-digit code to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Enter it below to activate your account.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
          style={{
            width: '100%', boxSizing: 'border-box', textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.5em',
            padding: '0.75rem 0.5rem 0.75rem 0.9em', borderRadius: 10, outline: 'none',
            background: 'var(--bg-elevated, var(--bg-surface))',
            border: error ? '1px solid #ff4d6d' : '1px solid var(--border)',
            color: 'var(--text-primary)', marginBottom: '0.75rem',
          }}
        />
        {error && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#ff4d6d', fontFamily: 'Inter, sans-serif' }}>{error}</p>
        )}

        <button type="submit" disabled={loading || code.length !== 6} style={{
          width: '100%', padding: '0.8125rem', border: 'none', borderRadius: 11,
          cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)',
          opacity: loading || code.length !== 6 ? 0.6 : 1,
          color: 'white', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.75rem',
        }}>
          {loading ? 'Verifying…' : 'Verify email'}
        </button>
      </form>

      {resent ? (
        <p style={{ color: '#3DDC84', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
          ✓ Code sent! ({remaining} resend{remaining === 1 ? '' : 's'} remaining)
        </p>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || remaining === 0}
          style={{
            width: '100%', marginBottom: '0.75rem', padding: '0.5rem', border: 'none', background: 'none',
            color: remaining === 0 ? 'var(--text-muted)' : 'var(--accent)', fontFamily: 'Inter, sans-serif',
            fontWeight: 600, fontSize: '0.8125rem', cursor: resending || remaining === 0 ? 'not-allowed' : 'pointer',
            textDecoration: 'underline', opacity: resending ? 0.6 : 1,
          }}
        >
          {resending ? 'Sending…' : remaining === 0 ? 'Contact support' : `Resend code (${remaining} left)`}
        </button>
      )}

      {onBack && (
        <button type="button" onClick={onBack}
          style={{ width: '100%', padding: '0.5rem', border: 'none', background: 'none', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <ArrowLeft size={13} /> Back
        </button>
      )}
    </div>
  )
}
