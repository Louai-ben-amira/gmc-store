import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { login, register, socialAuth, forgotPassword, resendVerification } from '../api/auth'
import { googleLogin, facebookLogin } from '../utils/socialAuth'
import useAuthStore from '../store/authStore'
import { useToast } from '../hooks/useToast'
import { X, Eye, EyeOff, Zap, User, Lock, Mail, ArrowRight, Sparkles, Gift, ArrowLeft, MailCheck } from 'lucide-react'

/* ── inject styles once ─────────────────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('auth-modal-style')) {
  const s = document.createElement('style')
  s.id = 'auth-modal-style'
  s.textContent = `
    @keyframes authBackdropIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes authCardIn {
      from { opacity: 0; transform: translateY(32px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    @keyframes authSlideLeft {
      from { opacity: 0; transform: translateX(28px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes authSlideRight {
      from { opacity: 0; transform: translateX(-28px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes authPulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50%       { opacity: 0.8; transform: scale(1.05); }
    }
    .auth-input-wrap { position: relative; }
    .auth-input-wrap input {
      width: 100%; box-sizing: border-box;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text-primary);
      font-family: Inter, sans-serif;
      font-size: 0.875rem;
      padding: 0.75rem 0.875rem 0.75rem 2.625rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .auth-input-wrap input::placeholder { color: var(--text-muted); }
    .auth-input-wrap input:focus {
      border-color: #7C3AED;
      background: var(--input-bg);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
    }
    .auth-input-wrap input.error {
      border-color: #ff4d6d !important;
      box-shadow: 0 0 0 3px rgba(255,77,109,0.12) !important;
    }
    .auth-tab {
      flex: 1; padding: 0.5rem; border: none; cursor: pointer;
      font-family: Sora, sans-serif; font-size: 0.875rem; font-weight: 600;
      border-radius: 8px; transition: all 0.18s;
    }
    .auth-tab.active {
      background: linear-gradient(135deg, #7C3AED, #5b21b6);
      color: white;
      box-shadow: 0 4px 14px rgba(124,58,237,0.4);
    }
    .auth-tab.inactive {
      background: transparent; color: var(--text-muted);
    }
    .auth-tab.inactive:hover { color: var(--text-primary); background: var(--bg-elevated); }
    .auth-submit {
      width: 100%; padding: 0.8125rem; border: none; border-radius: 11px; cursor: pointer;
      font-family: Sora, sans-serif; font-size: 0.9375rem; font-weight: 700;
      background: linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%);
      color: white; display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 6px 24px rgba(124,58,237,0.45);
      transition: opacity 0.15s, transform 0.13s, box-shadow 0.13s;
    }
    .auth-submit:hover:not(:disabled) {
      opacity: 0.92; transform: translateY(-1px); box-shadow: 0 10px 32px rgba(124,58,237,0.55);
    }
    .auth-submit:disabled { opacity: 0.55; cursor: not-allowed; }
    .auth-social-btn {
      width: 100%; padding: 0.6875rem 1rem; border-radius: 10px; cursor: pointer;
      font-family: Inter, sans-serif; font-size: 0.875rem; font-weight: 600;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      transition: all 0.15s; border: 1px solid;
    }
    .auth-social-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .auth-social-btn.google {
      background: var(--bg-elevated); border-color: var(--border); color: var(--text-primary);
    }
    .auth-social-btn.google:hover:not(:disabled) {
      background: var(--bg-surface); border-color: var(--border-strong);
    }
    .auth-social-btn.facebook {
      background: rgba(24,119,242,0.1); border-color: rgba(24,119,242,0.3); color: #5b9cf6;
    }
    .auth-social-btn.facebook:hover:not(:disabled) {
      background: rgba(24,119,242,0.18); border-color: rgba(24,119,242,0.5);
    }
    .auth-divider {
      display: flex; align-items: center; gap: 10px; margin: 1.125rem 0;
    }
    .auth-divider::before, .auth-divider::after {
      content: ''; flex: 1; height: 1px; background: var(--border);
    }
  `
  document.head.appendChild(s)
}

/* ── Google SVG ─────────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
)

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>
)

/* ── Social buttons shared component ────────────────────────────────── */
function SocialButtons({ onSuccess }) {
  const { t } = useTranslation('auth')
  const [gLoading, setGLoading] = useState(false)
  const [fLoading, setFLoading] = useState(false)
  const { login: storeLogin } = useAuthStore()
  const toast = useToast()
  const navigate = useNavigate()

  const handleSocial = async (provider, loginFn, setLoading) => {
    setLoading(true)
    try {
      const token = await loginFn()
      const { data } = await socialAuth(provider, token)
      storeLogin(data.user, data.access, data.refresh)
      toast.success(`Welcome, ${data.user.first_name || data.user.username}! 👋`)
      onSuccess(data.user)
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err.response?.data?.detail || 'Sign-in failed. Try again.')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
      <button
        type="button"
        className="auth-social-btn google"
        disabled={gLoading || fLoading}
        onClick={() => handleSocial('google', googleLogin, setGLoading)}
      >
        {gLoading
          ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopcolor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
          : <GoogleIcon />
        }
        {gLoading ? t('social.signingIn') : t('social.google')}
      </button>

      <button
        type="button"
        className="auth-social-btn facebook"
        disabled={gLoading || fLoading}
        onClick={() => handleSocial('facebook', facebookLogin, setFLoading)}
      >
        {fLoading
          ? <span style={{ width: 16, height: 16, border: '2px solid rgba(24,119,242,0.3)', borderTopColor: '#5b9cf6', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
          : <FacebookIcon />
        }
        {fLoading ? t('social.signingIn') : t('social.facebook')}
      </button>

      <div className="auth-divider">
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>or continue with email</span>
      </div>
    </div>
  )
}

/* ── Icon input field ───────────────────────────────────────────────── */
function InputField({ icon: Icon, type = 'text', placeholder, value, onChange, error, rightEl }) {
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <div className="auth-input-wrap">
        <Icon size={14} style={{
          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
          color: error ? '#ff4d6d' : 'var(--text-muted)', pointerEvents: 'none', zIndex: 1,
        }} />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={error ? 'error' : ''}
        />
        {rightEl && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
            {rightEl}
          </div>
        )}
      </div>
      {error && (
        <p style={{ margin: '4px 0 0 2px', fontSize: '0.72rem', color: '#ff4d6d', fontFamily: 'Inter, sans-serif' }}>{error}</p>
      )}
    </div>
  )
}

/* ── Login form ─────────────────────────────────────────────────────── */
function LoginForm({ onSuccess, switchToRegister, switchToForgot }) {
  const { t } = useTranslation('auth')
  const [form, setForm]       = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})
  const { login: storeLogin } = useAuthStore()
  const toast = useToast()
  const navigate = useNavigate()

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const validate = () => {
    const e = {}
    if (!form.username.trim()) e.username = 'Username is required'
    if (!form.password)        e.password = 'Password is required'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { data } = await login(form)
      storeLogin(data.user, data.access, data.refresh)
      toast.success(`Welcome back, ${data.user.first_name || data.user.username}! 👋`)
      onSuccess(data.user)
    } catch (err) {
      const msg = err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || 'Invalid credentials'
      setErrors({ general: msg })
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{ animation: 'authSlideRight 0.22s ease both' }}>
      <SocialButtons onSuccess={onSuccess} />

      {errors.general && (
        <div style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.25)', borderRadius: 9, padding: '9px 13px', marginBottom: '1rem', fontSize: '0.8125rem', color: '#ff4d6d', fontFamily: 'Inter, sans-serif' }}>
          {errors.general}
        </div>
      )}

      <InputField
        icon={User} placeholder={t('fields.usernameOrEmail')}
        value={form.username} onChange={e => set('username', e.target.value)}
        error={errors.username}
      />
      <InputField
        icon={Lock} type={showPass ? 'text' : 'password'} placeholder={t('fields.password')}
        value={form.password} onChange={e => set('password', e.target.value)}
        error={errors.password}
        rightEl={
          <button type="button" onClick={() => setShowPass(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-0.375rem 0 0.875rem' }}>
        <button type="button" onClick={switchToForgot}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          Forgot password?
        </button>
      </div>

      <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: '0.25rem' }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopcolor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            {t('submit.signingIn')}
          </span>
        ) : (
          <><Zap size={15} /> {t('submit.signIn')}</>
        )}
      </button>

      <div className="auth-divider">
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{t('links.noAccount')}</span>
      </div>

      <button type="button" onClick={switchToRegister}
        style={{ width: '100%', padding: '0.6875rem', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 11, background: 'rgba(124,58,237,0.07)', color: 'var(--accent)', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.14)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.07)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)' }}
      >
        {t('links.createAccount')} <ArrowRight size={13} />
      </button>
    </form>
  )
}

/* ── Register form ──────────────────────────────────────────────────── */
function RegisterForm({ onSuccess, switchToLogin }) {
  const { t } = useTranslation('auth')
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', referral_code: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [errors, setErrors]     = useState({})
  const { login: storeLogin }   = useAuthStore()
  const toast = useToast()

  // Set once registration succeeds for an account that still needs email
  // verification - swaps the form out for the "check your inbox" screen.
  const [checkInbox, setCheckInbox]   = useState(null) // { email, user }
  const [resending, setResending]     = useState(false)
  const [resent, setResent]           = useState(false)
  const [remaining, setRemaining]     = useState(3)

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const validate = () => {
    const e = {}
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    if (!form.username.trim()) e.username = 'Username is required'
    if (!form.email.trim()) e.email = 'Email is required - used for order notifications'
    else if (!emailRe.test(form.email.trim())) e.email = 'Enter a valid email address'
    if (form.password.length < 8)  e.password = 'Min 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        confirm_password: form.password,
      }
      if (form.referral_code.trim()) payload.referral_code = form.referral_code.trim()
      const { data } = await register(payload)
      // Register already returns tokens - the user is logged in immediately
      storeLogin(data.user, data.access, data.refresh)
      if (data.user.is_email_verified) {
        toast.success(`Account created! Welcome, ${data.user.first_name || data.user.username}! 🎉`)
        onSuccess(data.user)
      } else {
        setCheckInbox({ email: data.user.email, user: data.user })
      }
    } catch (err) {
      const d = err.response?.data || {}
      const e = {}
      if (d.username) e.username = Array.isArray(d.username) ? d.username[0] : d.username
      if (d.email)    e.email    = Array.isArray(d.email) ? d.email[0] : d.email
      if (d.password) e.password = Array.isArray(d.password) ? d.password[0] : d.password
      if (d.detail)   e.general  = d.detail
      if (!Object.keys(e).length) e.general = 'Registration failed. Try again.'
      setErrors(e)
    } finally { setLoading(false) }
  }

  const strength = (() => {
    const p = form.password
    if (!p) return 0
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  })()
  const strengthColors = ['#ff4d6d', '#f97316', '#f59e0b', '#3DDC84']
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong']

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

  if (checkInbox) {
    return (
      <div style={{ animation: 'authSlideLeft 0.22s ease both', textAlign: 'center', padding: '0.5rem 0 0.25rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: 'rgba(61,220,132,0.12)',
          border: '1px solid rgba(61,220,132,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem',
        }}>
          <MailCheck size={22} color="#3DDC84" />
        </div>
        <p style={{ color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>
          📧 Check your inbox!
        </p>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
          We sent a verification link to <strong style={{ color: 'var(--text-secondary)' }}>{checkInbox.email}</strong>.
          Click the link in the email to activate your account.
        </p>

        <button type="button" className="auth-submit" onClick={() => onSuccess(checkInbox.user)} style={{ marginBottom: '0.75rem' }}>
          Continue to Shop
        </button>

        {resent ? (
          <p style={{ color: '#3DDC84', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
            ✓ Email sent! ({remaining} resend{remaining === 1 ? '' : 's'} remaining)
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
            {resending ? 'Sending…' : remaining === 0 ? 'Contact support' : `Resend email (${remaining} left)`}
          </button>
        )}

        <button type="button" onClick={() => setCheckInbox(null)}
          style={{ width: '100%', padding: '0.5rem', border: 'none', background: 'none', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <ArrowLeft size={13} /> Change email address
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ animation: 'authSlideLeft 0.22s ease both' }}>
      <SocialButtons onSuccess={onSuccess} />

      {errors.general && (
        <div style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.25)', borderRadius: 9, padding: '9px 13px', marginBottom: '1rem', fontSize: '0.8125rem', color: '#ff4d6d', fontFamily: 'Inter, sans-serif' }}>
          {errors.general}
        </div>
      )}

      <InputField icon={User} placeholder={t('fields.username')} value={form.username} onChange={e => set('username', e.target.value)} error={errors.username} />
      <InputField icon={Mail} type="email" placeholder={t('fields.email')} value={form.email} onChange={e => set('email', e.target.value)} error={errors.email} required />
      <InputField
        icon={Lock} type={showPass ? 'text' : 'password'} placeholder={t('fields.passwordMin')}
        value={form.password} onChange={e => set('password', e.target.value)} error={errors.password}
        rightEl={
          <button type="button" onClick={() => setShowPass(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        }
      />

      {/* Password strength bar */}
      {form.password && (
        <div style={{ marginTop: '-0.5rem', marginBottom: '0.875rem' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < strength ? strengthColors[strength - 1] : 'rgba(255,255,255,0.08)', transition: 'background 0.25s' }} />
            ))}
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '0.6875rem', color: strengthColors[strength - 1] || 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>
            {strength > 0 ? strengthLabels[strength - 1] : ''}
          </p>
        </div>
      )}

      <InputField icon={Lock} type="password" placeholder={t('fields.confirmPassword')} value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} error={errors.confirmPassword} />

      {/* Referral code - optional */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div className="auth-input-wrap">
          <Gift size={14} style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            color: form.referral_code ? '#f59e0b' : 'var(--text-muted)', pointerEvents: 'none', zIndex: 1,
          }} />
          <input
            type="text"
            placeholder="Referral code (optional)"
            value={form.referral_code}
            onChange={e => set('referral_code', e.target.value.toUpperCase())}
            style={{ letterSpacing: form.referral_code ? '0.12em' : '0', fontWeight: form.referral_code ? 700 : 400 }}
          />
        </div>
        {form.referral_code && (
          <p style={{ margin: '3px 0 0 2px', fontSize: '0.6875rem', color: '#f59e0b', fontFamily: 'Inter, sans-serif' }}>
            🎁 Referral code applied - your friend earns a bonus!
          </p>
        )}
      </div>

      <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: '0.25rem' }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopcolor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            {t('submit.creatingAccount')}
          </span>
        ) : (
          <><Sparkles size={15} /> {t('submit.createAccount')}</>
        )}
      </button>

      <div className="auth-divider">
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{t('links.alreadyHaveAccount')}</span>
      </div>

      <button type="button" onClick={switchToLogin}
        style={{ width: '100%', padding: '0.6875rem', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 11, background: 'rgba(124,58,237,0.07)', color: 'var(--accent)', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.14)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.07)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)' }}
      >
        {t('links.signInInstead')} <ArrowRight size={13} />
      </button>
    </form>
  )
}

/* ── Forgot password form ───────────────────────────────────────────── */
function ForgotPasswordForm({ switchToLogin }) {
  const [email, setEmail]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    setLoading(true)
    setError('')
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch {
      // Backend always returns 200 to avoid leaking whether the email exists,
      // so a failure here means a real network/server error.
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div style={{ animation: 'authSlideRight 0.22s ease both', textAlign: 'center', padding: '0.5rem 0 0.25rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: 'rgba(61,220,132,0.12)',
          border: '1px solid rgba(61,220,132,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem',
        }}>
          <MailCheck size={22} color="#3DDC84" />
        </div>
        <p style={{ color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>
          Check your inbox
        </p>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
          If an account exists for <strong style={{ color: 'var(--text-secondary)' }}>{email.trim()}</strong>, we've sent a link to reset your password.
        </p>
        <button type="button" onClick={switchToLogin} className="auth-submit">
          <ArrowLeft size={15} /> Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ animation: 'authSlideRight 0.22s ease both' }}>
      <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', lineHeight: 1.5, margin: '0 0 1.125rem' }}>
        Enter the email tied to your account and we'll send you a link to reset your password.
      </p>

      <InputField
        icon={Mail} type="email" placeholder="Email address"
        value={email} onChange={e => { setEmail(e.target.value); setError('') }}
        error={error}
      />

      <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: '0.25rem' }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            Sending link…
          </span>
        ) : (
          <><Mail size={15} /> Send reset link</>
        )}
      </button>

      <button type="button" onClick={switchToLogin}
        style={{ width: '100%', marginTop: '0.875rem', padding: '0.5rem', border: 'none', background: 'none', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={13} /> Back to sign in
      </button>
    </form>
  )
}

/* ── Main AuthModal ─────────────────────────────────────────────────── */
export default function AuthModal({ isOpen, onClose, defaultTab = 'login' }) {
  const { t } = useTranslation('auth')
  const [tab, setTab] = useState(defaultTab)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => { if (isOpen) setTab(defaultTab) }, [isOpen, defaultTab])
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const handleSuccess = (user) => {
    onClose()
    if (user.role === 'admin') navigate('/admin')
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'authBackdropIn 0.2s ease both',
      }}
    >
      {/* Blurred dark backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,2,12,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={onClose} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 400,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.08), 0 0 60px rgba(124,58,237,0.08)',
        overflow: 'hidden',
        animation: 'authCardIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>

        {/* Top glow accent */}
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 220, height: 120, background: 'radial-gradient(ellipse, rgba(124,58,237,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, zIndex: 10,
          width: 30, height: 30, borderRadius: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,77,109,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,77,109,0.3)'; e.currentTarget.style.color = '#ff4d6d' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div style={{ padding: '1.75rem 1.75rem 0', position: 'relative' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.375rem' }}>
            <img src="/logo png.png" alt="GMC Store" style={{ height: 96, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 18px rgba(124,58,237,0.45))' }} />
          </div>

          {/* Tab switcher */}
          {tab !== 'forgot' && (
            <div style={{
              display: 'flex', gap: 4, padding: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12, marginBottom: '1.375rem',
            }}>
              <button className={`auth-tab ${tab === 'login' ? 'active' : 'inactive'}`} onClick={() => setTab('login')}>
                {t('tabs.signIn')}
              </button>
              <button className={`auth-tab ${tab === 'register' ? 'active' : 'inactive'}`} onClick={() => setTab('register')}>
                {t('tabs.signUp')}
              </button>
            </div>
          )}
        </div>

        {/* Form area */}
        <div style={{ padding: '0 1.75rem 1.75rem', overflowY: 'auto', maxHeight: 'calc(90vh - 160px)' }}>
          {tab === 'login' && <LoginForm key="login" onSuccess={handleSuccess} switchToRegister={() => setTab('register')} switchToForgot={() => setTab('forgot')} />}
          {tab === 'register' && <RegisterForm key="register" onSuccess={handleSuccess} switchToLogin={() => setTab('login')} />}
          {tab === 'forgot' && <ForgotPasswordForm key="forgot" switchToLogin={() => setTab('login')} />}
        </div>
      </div>
    </div>
  )
}



