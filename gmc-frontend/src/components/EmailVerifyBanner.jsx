import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TbAlertTriangle } from 'react-icons/tb'
import useAuthStore from '../store/authStore'
import { resendVerification } from '../api/auth'

/**
 * Persistent warning shown on every page until the user verifies their
 * email. Existing accounts are grandfathered in as verified (backend
 * migration), so this only ever renders for new, unverified accounts.
 */
export default function EmailVerifyBanner() {
  const user = useAuthStore(s => s.user)
  const [resending, setResending] = useState(false)
  const [sent, setSent]           = useState(false)
  const [remaining, setRemaining] = useState(3)

  if (!user || user.is_email_verified) return null

  const handleResend = async () => {
    setResending(true)
    try {
      const { data } = await resendVerification(user.email)
      setSent(true)
      setRemaining(data.resends_remaining)
      setTimeout(() => setSent(false), 5000)
    } catch (err) {
      if (err.response?.data?.error === 'max_resends_reached') {
        setRemaining(0)
      }
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 8,
      padding: '9px 1.25rem',
      background: 'rgba(245,158,11,0.1)',
      borderBottom: '1px solid rgba(245,158,11,0.3)',
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600,
        color: '#f59e0b',
      }}>
        <TbAlertTriangle size={15} /> Please verify your email address to enable purchases
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {sent ? (
          <span style={{ color: '#3DDC84', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600 }}>
            ✓ Email sent! Check your inbox ({remaining} resend{remaining === 1 ? '' : 's'} left)
          </span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending || remaining === 0}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: '#f59e0b', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600,
              textDecoration: 'underline', cursor: resending || remaining === 0 ? 'not-allowed' : 'pointer',
              opacity: resending || remaining === 0 ? 0.5 : 1,
            }}
          >
            {resending ? 'Sending…' : remaining === 0 ? 'Contact support' : 'Resend verification code'}
          </button>
        )}
        <Link to={`/verify-email?email=${encodeURIComponent(user.email)}`}
          style={{ color: '#f59e0b', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline' }}
        >
          Enter code
        </Link>
      </div>
    </div>
  )
}
