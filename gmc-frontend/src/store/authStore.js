import { create } from 'zustand'
import useThemeStore from './themeStore'
import useLanguageStore from './languageStore'

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ user, accessToken, refreshToken })
    // Sync theme and language from DB on login
    if (user?.theme_preference) {
      useThemeStore.getState().syncFromUser(user.theme_preference)
    }
    if (user?.language_preference) {
      useLanguageStore.getState().syncFromUser(user.language_preference)
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, accessToken: null, refreshToken: null })
  },

  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),

  refreshAccess: (newAccessToken) => {
    localStorage.setItem('access_token', newAccessToken)
    set({ accessToken: newAccessToken })
  },

  isAuthenticated: () => !!get().accessToken,
}))

export default useAuthStore
