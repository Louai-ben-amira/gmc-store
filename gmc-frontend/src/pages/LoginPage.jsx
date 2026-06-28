import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import useAuthStore from '../store/authStore'
import { useToast } from '../hooks/useToast'
import { Eye, EyeOff, Zap } from 'lucide-react'
import SocialAuthButtons from '../components/SocialAuthButtons'

export default function LoginPage() {
  const [form,     setForm]     = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const { login: storeLogin } = useAuthStore()
  const navigate = useNavigate()
  const toast    = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await login(form)
      storeLogin(data.user, data.access, data.refresh)
      toast.success('Welcome back!')
      navigate(data.user.role === 'admin' ? '/admin' : '/')
    } catch (err) {
      toast.error(err.response?.data?.non_field_errors?.[0] || 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', background: 'var(--bg-deep)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow orbs */}
      <div style={{ position: 'fixed', top: '20%', left: '10%', width: '400px', height: '400px', background: 'rgba(0,245,255,0.06)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '15%', right: '10%', width: '300px', height: '300px', background: 'rgba(245,200,66,0.05)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1, animation: 'fadeSlideUp 0.45s ease both' }}>
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
          <h1 style={{ margin: '0 0 0.25rem', color: 'var(--white-primary)', fontFamily: 'Orbitron, monospace', fontSize: '1.5rem', fontWeight: 800 }}>GMC Store</h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9rem' }}>Sign in to your gaming account</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-border)',
          borderRadius: '1.25rem', padding: '2rem',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Username or Email
              </label>
              <input
                type="text" placeholder="Enter your username"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                required autoComplete="username"
              />
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} placeholder="Enter your password"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required autoComplete="current-password"
                  style={{ paddingRight: '2.75rem' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--white-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '0.8125rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {loading ? 'Signing inâ€¦' : <><Zap size={16} /> Sign In</>}
            </button>
          </form>

          <div style={{ position: 'relative', margin: '1.5rem 0', textAlign: 'center' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--bg-border)' }} />
            <span style={{ position: 'relative', background: 'var(--bg-card)', padding: '0 1rem', color: 'var(--muted)', fontSize: '0.8125rem' }}>or continue with</span>
          </div>

          <SocialAuthButtons />

          <p style={{ textAlign: 'center', margin: '1.25rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--magenta)', textDecoration: 'none', fontWeight: 600 }}>
              Create one â†'
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}



