import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import { useToast } from '../hooks/useToast'
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2, XCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const uid   = searchParams.get('uid')   || ''
  const token = searchParams.get('token') || ''

  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass]               = useState(false)
  const [error, setError]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [done, setDone]                       = useState(false)
  const navigate = useNavigate()
  const toast    = useToast()

  const invalidLink = !uid || !token

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      await resetPassword({ uid, token, new_password: password })
      setDone(true)
      toast.success('Password reset! You can now sign in.')
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || 'This reset link is invalid or has expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: '15%', right: '8%', width: 350, height: 350, background: 'rgba(124,58,237,0.08)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: 400, position: 'relative', zIndex: 1,
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20,
        padding: '2rem', boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: invalidLink ? 'rgba(255,77,109,0.12)' : done ? 'rgba(61,220,132,0.12)' : 'rgba(124,58,237,0.12)',
            border: `1px solid ${invalidLink ? 'rgba(255,77,109,0.3)' : done ? 'rgba(61,220,132,0.3)' : 'rgba(124,58,237,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {invalidLink
              ? <XCircle size={24} color="#ff4d6d" />
              : done
                ? <CheckCircle2 size={24} color="#3DDC84" />
                : <KeyRound size={24} color="#7C3AED" />}
          </div>
        </div>

        {invalidLink ? (
          <>
            <h1 style={{ textAlign: 'center', margin: '0 0 0.5rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Invalid reset link
            </h1>
            <p style={{ textAlign: 'center', margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
              This password reset link is missing or malformed. Please request a new one.
            </p>
            <Link to="/" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '0.8125rem', borderRadius: 11, background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)', color: 'white', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem' }}>
              Back to GMC Store
            </Link>
          </>
        ) : done ? (
          <>
            <h1 style={{ textAlign: 'center', margin: '0 0 0.5rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Password reset
            </h1>
            <p style={{ textAlign: 'center', margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
              Your password has been updated. Sign in with your new password.
            </p>
            <button
              onClick={() => { navigate('/'); setTimeout(() => window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } })), 50) }}
              style={{ width: '100%', padding: '0.8125rem', border: 'none', borderRadius: 11, cursor: 'pointer', background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)', color: 'white', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem' }}
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            <h1 style={{ textAlign: 'center', margin: '0 0 0.5rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Set a new password
            </h1>
            <p style={{ textAlign: 'center', margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.25)', borderRadius: 9, padding: '9px 13px', marginBottom: '1rem', fontSize: '0.8125rem', color: '#ff4d6d', fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </div>
              )}

              <div className="auth-input-wrap" style={{ position: 'relative', marginBottom: '0.875rem' }}>
                <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="New password (min 8 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
                    padding: '0.75rem 2.625rem', outline: 'none',
                  }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', zIndex: 1 }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="auth-input-wrap" style={{ position: 'relative', marginBottom: '1.125rem' }}>
                <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
                    padding: '0.75rem 0.875rem',
                  }}
                />
              </div>

              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '0.8125rem', border: 'none', borderRadius: 11, cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)', color: 'white',
                  fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
