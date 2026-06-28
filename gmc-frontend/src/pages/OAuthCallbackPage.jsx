import { useEffect } from 'react'

export default function OAuthCallbackPage() {
  useEffect(() => {
    const hash   = new URLSearchParams(window.location.hash.slice(1))
    const idToken = hash.get('id_token')
    const error   = hash.get('error')

    if (window.opener) {
      window.opener.postMessage(
        idToken
          ? { type: 'gmc:oauth:google', token: idToken }
          : { type: 'gmc:oauth:google', error: error || 'No token received' },
        window.location.origin,
      )
      window.close()
    }
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-deep)', color: 'var(--muted)',
      fontSize: '0.95rem',
    }}>
      Completing sign-in…
    </div>
  )
}
