import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register, resendVerification } from '../api/auth'
import useAuthStore from '../store/authStore'
import { useToast } from '../hooks/useToast'
import { UserPlus, MailCheck, ArrowLeft } from 'lucide-react'
import SocialAuthButtons from '../components/SocialAuthButtons'

export default function RegisterPage() {
  const [form,    setForm]    = useState({ username: '', email: '', first_name: '', last_name: '', password: '', confirm_password: '', referral_code: '' })
  const [loading, setLoading] = useState(false)
  const { login: storeLogin } = useAuthStore()
  const navigate = useNavigate()
  const toast    = useToast()

  // Set once registration succeeds for an account that still needs email
  // verification - swaps the form out for the "check your inbox" screen.
  const [checkInbox, setCheckInbox] = useState(null) // { email }
  const [resending,  setResending]  = useState(false)
  const [resent,     setResent]     = useState(false)
  const [remaining,  setRemaining]  = useState(3)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { data } = await register(form)
      storeLogin(data.user, data.access, data.refresh)
      if (data.user.is_email_verified) {
        toast.success('Account created! Welcome to GMC Store 🎮')
        navigate('/')
      } else {
        setCheckInbox({ email: data.user.email })
      }
    } catch (err) {
      const errors = err.response?.data
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError)
      } else {
        toast.error('Registration failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const { data } = await resendVerification()
      setResent(true)
      setRemaining(data.resends_remaining)
      setTimeout(() => setResent(false), 4000)
    } catch (err) {
      if (err.response?.data?.error === 'max_resends_reached') {
        setRemaining(0)
        toast.error('Maximum resend attempts reached. Contact support.')
      } else {
        toast.error('Could not resend the email. Try again shortly.')
      }
    } finally {
      setResending(false)
    }
  }

  const field = (key, label, type = 'text') => (
    <div>
      <label style={{ color: 'var(--muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <input type={type} placeholder={label} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', background: 'var(--bg-deep)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', top: '15%', right: '8%', width: '350px', height: '350px', background: 'rgba(0,245,255,0.06)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', left: '8%', width: '280px', height: '280px', background: 'rgba(245,200,66,0.04)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '500px', position: 'relative', zIndex: 1, animation: 'fadeSlideUp 0.45s ease both' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            background: 'var(--gradient-brand)',
            borderRadius: '14px', width: '56px', height: '56px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 0 32px var(--magenta-glow)',
            fontFamily: 'Orbitron, monospace', fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.375rem',
          }}>G</div>
          <h1 style={{ margin: '0 0 0.25rem', color: 'var(--white-primary)', fontFamily: 'Orbitron, monospace', fontSize: '1.5rem', fontWeight: 800 }}>Create Account</h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9rem' }}>Join GMC Store and start gaming</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-border)',
          borderRadius: '1.25rem', padding: '2rem',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          {checkInbox ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0 0.25rem' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'rgba(61,220,132,0.12)',
                border: '1px solid rgba(61,220,132,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.125rem',
              }}>
                <MailCheck size={24} color="#3DDC84" />
              </div>
              <p style={{ color: 'var(--white-primary)', fontWeight: 700, fontSize: '1.0625rem', margin: '0 0 0.5rem' }}>
                📧 Check your inbox!
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                We sent a verification link to <strong style={{ color: 'var(--white-primary)' }}>{checkInbox.email}</strong>.
                Click the link in the email to activate your account.
              </p>

              <button type="button" className="btn-primary" onClick={() => navigate('/')} style={{ width: '100%', justifyContent: 'center', padding: '0.8125rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Go to Shop
              </button>

              {resent ? (
                <p style={{ color: '#3DDC84', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
                  ✓ Email sent! ({remaining} resend{remaining === 1 ? '' : 's'} remaining)
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || remaining === 0}
                  style={{
                    width: '100%', marginBottom: '0.5rem', padding: '0.5rem', border: 'none', background: 'none',
                    color: remaining === 0 ? 'var(--muted)' : 'var(--magenta)', fontWeight: 600, fontSize: '0.8125rem',
                    cursor: resending || remaining === 0 ? 'not-allowed' : 'pointer', textDecoration: 'underline',
                    opacity: resending ? 0.6 : 1,
                  }}
                >
                  {resending ? 'Sending…' : remaining === 0 ? 'Contact support' : `Resend email (${remaining} left)`}
                </button>
              )}

              <button type="button" onClick={() => setCheckInbox(null)}
                style={{ width: '100%', padding: '0.5rem', border: 'none', background: 'none', color: 'var(--muted)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <ArrowLeft size={13} /> Change email address
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {field('first_name', 'First Name')}
                  {field('last_name',  'Last Name')}
                </div>
                {field('username', 'Username')}
                {field('email',    'Email', 'email')}
                {field('password', 'Password', 'password')}
                {field('confirm_password', 'Confirm Password', 'password')}
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Referral Code <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span></label>
                  <input type="text" placeholder="e.g. GMC-ABC123" value={form.referral_code}
                    onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })}
                    style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '0.8125rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  {loading ? 'Creating accountâ€¦' : <><UserPlus size={16} /> Create Account</>}
                </button>
              </form>

              <div style={{ position: 'relative', margin: '1.5rem 0', textAlign: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--bg-border)' }} />
                <span style={{ position: 'relative', background: 'var(--bg-card)', padding: '0 1rem', color: 'var(--muted)', fontSize: '0.8125rem' }}>or sign up with</span>
              </div>

              <SocialAuthButtons />

              <p style={{ textAlign: 'center', margin: '1.25rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { navigate('/'); setTimeout(() => window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } })), 50) }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--magenta)', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit' }}
                >
                  Sign in →
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}



