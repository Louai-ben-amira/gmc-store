import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import VerifyCodeStep from '../components/VerifyCodeStep'
import { MailCheck } from 'lucide-react'

/**
 * Fallback page for entering the mandatory verification code manually -
 * e.g. reached from the EmailVerifyBanner's "verify now" link, or by a user
 * who closed the sign-up tab before finishing. Verification itself always
 * happens through VerifyCodeStep; there is no more link-based flow.
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const navigate = useNavigate()
  const { login: storeLogin } = useAuthStore()

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
        {email ? (
          <VerifyCodeStep
            email={email}
            onVerified={(user, access, refresh) => {
              storeLogin(user, access, refresh)
              navigate('/')
            }}
          />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: '0 auto 1.5rem',
              background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MailCheck size={24} color="#7C3AED" />
            </div>
            <h1 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Verify your email
            </h1>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
              Sign up or sign in to enter your verification code.
            </p>
            <Link to="/" style={{ display: 'block', textDecoration: 'none', padding: '0.8125rem', borderRadius: 11, background: 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)', color: 'white', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem' }}>
              Back to GMC Store
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
