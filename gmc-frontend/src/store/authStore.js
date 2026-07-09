import { create } from 'zustand'
import useThemeStore from './themeStore'
import useLanguageStore from './languageStore'
import queryClient from '../lib/queryClient'

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ user, accessToken, refreshToken })
    // Cached API data (wishlist hearts, orders...) belongs to the previous
    // session - drop it so everything refetches for this user
    queryClient.clear()
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
    queryClient.clear()
  },

  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),

  refreshAccess: (newAccessToken) => {
    localStorage.setItem('access_token', newAccessToken)
    set({ accessToken: newAccessToken })
  },

  isAuthenticated: () => !!get().accessToken,
}))

export default useAuthStore
