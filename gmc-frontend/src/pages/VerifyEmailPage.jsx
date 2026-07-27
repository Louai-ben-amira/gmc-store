import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { verifyEmail, resendVerification } from '../api/auth'
import useAuthStore from '../store/authStore'
import { CheckCircle2, XCircle, MailCheck, Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { user, updateUser, isAuthenticated } = useAuthStore()

  // idle (loading) | success | already | error
  const [state, setState] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    if (!token) {
      setState('error')
      setErrorMsg('This link is missing a verification token.')
      return
    }

    verifyEmail(token)
      .then(() => {
        setState('success')
        // Keep the logged-in user's state in sync so the banner disappears immediately
        if (isAuthenticated()) updateUser({ is_email_verified: true })
      })
      .catch(err => {
        const detail = err.response?.data?.detail || ''
        if (detail.toLowerCase().includes('already')) {
          setState('already')
          if (isAuthenticated()) updateUser({ is_email_verified: true })
        } else {
          setState('error')
          setErrorMsg(detail || 'This link has expired or is invalid.')
        }
      })
  }, [token])

  useEffect(() => {
    if (state !== 'success') return
    const id = setTimeout(() => navigate('/'), 3000)
    return () => clearTimeout(id)
  }, [state, navigate])

  const handleResend = async () => {
    setResending(true)
    try {
      await resendVerification()
      setResent(true)
    } catch {
      // Errors here just mean "try again later" - nothing actionable to show beyond that
    } finally {
      setResending(false)
    }
  }

  const icon = state === 'idle'
    ? <Loader2 size={24} color="#7C3AED" style={{ animation: 'spin 0.9s linear infinite' }} />
    : state === 'error'
      ? <XCircle size={24} color="#ff4d6d" />
      : <CheckCircle2 size={24} color="#3DDC84" />

  const iconBg = state === 'error'
    ? { bg: 'rgba(255,77,109,0.12)', border: 'rgba(255,77,109,0.3)' }
    : state === 'idle'
      ? { bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.3)' }
      : { bg: 'rgba(61,220,132,0.12)', border: 'rgba(61,220,132,0.3)' }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: '15%', right: '8%', width: 350, height: 350, background: 'rgba(124,58,237,0.08)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: 400, position: 'relative', zIndex: 1,
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20,
        padding: '2rem', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: iconBg.bg, border: `1px solid ${iconBg.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
        </div>

        {state === 'idle' && (
          <>
            <h1 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Verifying your email…
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
              Hang tight, this only takes a moment.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <h1 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              ✅ Email verified!
            </h1>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
              Your account is fully active. Redirecting you to the shop…
            </p>
            <button
              onClick={() => navigate('/')}
              style={{ width: '100%', padding: '0.8125rem', border: 'none', borderRadius: 11, cursor: 'pointer', background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)', color: 'white', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem' }}
            >
              Go to Shop
            </button>
          </>
        )}

        {state === 'already' && (
          <>
            <h1 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              ✅ Already verified
            </h1>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
              Your email is already verified.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{ width: '100%', padding: '0.8125rem', border: 'none', borderRadius: 11, cursor: 'pointer', background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)', color: 'white', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem' }}
            >
              Go to Shop
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              ❌ Link expired or invalid
            </h1>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
              {errorMsg}
            </p>

            {isAuthenticated() && !user?.is_email_verified ? (
              resent ? (
                <p style={{ margin: 0, color: '#3DDC84', fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif' }}>
                  <MailCheck size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  New verification email sent - check your inbox.
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  style={{ width: '100%', padding: '0.8125rem', border: 'none', borderRadius: 11, cursor: resending ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)', color: 'white', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', opacity: resending ? 0.6 : 1 }}
                >
                  {resending ? 'Sending…' : 'Request new link'}
                </button>
              )
            ) : (
              <Link to="/" style={{ display: 'block', textDecoration: 'none', padding: '0.8125rem', borderRadius: 11, background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)', color: 'white', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem' }}>
                Back to GMC Store
              </Link>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
