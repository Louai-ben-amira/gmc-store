import { create } from 'zustand'
import api from '../api/index'

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem('gmc-theme', theme) } catch (_) {}
}

const useThemeStore = create((set, get) => ({
  theme: (typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme')
    : null) || 'dark',

  setTheme(theme) {
    applyTheme(theme)
    set({ theme })
  },

  toggleTheme() {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
    // Persist to backend if logged in
    try {
      const token = localStorage.getItem('access_token')
      if (token) {
        api.patch('/users/me/theme/', { theme: next }).catch(() => {})
      }
    } catch (_) {}
  },

  // Called after login - apply DB preference (DB wins over localStorage)
  syncFromUser(userTheme) {
    if (userTheme && userTheme !== get().theme) {
      applyTheme(userTheme)
      set({ theme: userTheme })
    }
  },
}))

export default useThemeStore
