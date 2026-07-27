/* Social OAuth helpers - no npm SDK needed, pure browser APIs */

const GOOGLE_CLIENT_ID  = import.meta.env.VITE_GOOGLE_CLIENT_ID  || ''
const FACEBOOK_APP_ID   = import.meta.env.VITE_FACEBOOK_APP_ID   || ''

/* ── Google (GSI - id_token via One-Tap / button callback) ─────────── */
let googleResolve = null
let googleReject  = null
let gsiLoaded     = false

function loadGSI() {
  if (gsiLoaded || document.getElementById('gsi-script')) { gsiReady(); return }
  const s = document.createElement('script')
  s.id  = 'gsi-script'
  s.src = 'https://accounts.google.com/gsi/client'
  s.async = true
  s.defer = true
  s.onload = gsiReady
  s.onerror = () => googleReject?.('Failed to load Google SDK')
  document.head.appendChild(s)
}

function gsiReady() {
  gsiLoaded = true
  window.google?.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (resp) => {
      if (resp.credential) googleResolve?.(resp.credential)
      else googleReject?.('Google sign-in cancelled')
    },
    cancel_on_tap_outside: true,
  })
}

export function googleLogin() {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) { reject('Google Client ID not configured (VITE_GOOGLE_CLIENT_ID)'); return }
    googleResolve = resolve
    googleReject  = reject

    const trigger = () => {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fall back to a manual popup OAuth flow if One-Tap was blocked
          googleOAuthPopup(resolve, reject)
        }
      })
    }

    if (gsiLoaded && window.google?.accounts) { trigger() }
    else { loadGSI(); const t = setInterval(() => { if (window.google?.accounts) { clearInterval(t); trigger() } }, 100) }
  })
}

function googleOAuthPopup(resolve, reject) {
  const nonce  = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  `${window.location.origin}/oauth/google`,
    response_type: 'id_token',
    scope:         'openid email profile',
    prompt:        'select_account',
    nonce,
  })
  const popup = window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    'google-oauth', 'width=520,height=620,top=100,left=200'
  )
  if (!popup) { reject('Popup blocked'); return }

  const handler = (e) => {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'gmc:oauth:google') {
      window.removeEventListener('message', handler)
      if (e.data.token) resolve(e.data.token)
      else reject(e.data.error || 'Google sign-in failed')
    }
  }
  window.addEventListener('message', handler)

  const timer = setInterval(() => {
    if (popup.closed) { clearInterval(timer); window.removeEventListener('message', handler); reject('Google sign-in cancelled') }
  }, 500)
}

/* ── Facebook (JS SDK popup) ────────────────────────────────────────── */
let fbLoaded = false

function loadFB() {
  return new Promise((resolve, reject) => {
    if (fbLoaded && window.FB) { resolve(); return }
    if (document.getElementById('fb-sdk')) {
      const t = setInterval(() => { if (window.FB) { clearInterval(t); resolve() } }, 100)
      return
    }
    window.fbAsyncInit = () => {
      window.FB.init({ appId: FACEBOOK_APP_ID, cookie: true, xfbml: false, version: 'v20.0' })
      fbLoaded = true
      resolve()
    }
    const s = document.createElement('script')
    s.id  = 'fb-sdk'
    s.src = 'https://connect.facebook.net/en_US/sdk.js'
    s.async = true
    s.onerror = () => reject('Failed to load Facebook SDK')
    document.head.appendChild(s)
  })
}

export async function facebookLogin() {
  if (!FACEBOOK_APP_ID) throw new Error('Facebook App ID not configured (VITE_FACEBOOK_APP_ID)')
  if (window.location.protocol !== 'https:') {
    throw new Error('Facebook login requires HTTPS - it will not work on http:// pages.')
  }
  await loadFB()
  return new Promise((resolve, reject) => {
    // FB.login's callback never fires in some failure modes (e.g. the SDK
    // silently refuses on non-https pages), which used to leave the caller's
    // "Connecting..." spinner stuck forever with no feedback. Always resolve
    // one way or another within a few seconds.
    const timer = setTimeout(() => reject('Facebook sign-in timed out. Please try again.'), 15000)
    window.FB.login((response) => {
      clearTimeout(timer)
      if (response.authResponse?.accessToken) resolve(response.authResponse.accessToken)
      else reject('Facebook sign-in cancelled or failed')
    }, { scope: 'public_profile,email' })
  })
}
