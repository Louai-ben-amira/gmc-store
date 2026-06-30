import { create } from 'zustand'
import i18n from '../i18n'
import api from '../api/index'

const ARABIC_FONT = "'Tajawal', 'Inter', system-ui, sans-serif"
const LATIN_FONT  = "'Inter', system-ui, sans-serif"

function applyLanguage(lang) {
  document.documentElement.lang = lang
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr'
  document.body.style.fontFamily = lang === 'ar' ? ARABIC_FONT : LATIN_FONT
  try { localStorage.setItem('gmc-lang', lang) } catch (_) {}
  if (i18n.language !== lang) i18n.changeLanguage(lang)
}

// Apply on module load so direction is set before first render
const _initial = (typeof localStorage !== 'undefined' && localStorage.getItem('gmc-lang')) || 'en'
applyLanguage(_initial)

const useLanguageStore = create((set, get) => ({
  language: _initial,

  setLanguage(lang) {
    applyLanguage(lang)
    set({ language: lang })
  },

  toggleLanguage() {
    const next = get().language === 'en' ? 'ar' : 'en'
    applyLanguage(next)
    set({ language: next })
    try {
      const token = localStorage.getItem('access_token')
      if (token) {
        api.patch('/users/me/language/', { language: next }).catch(() => {})
      }
    } catch (_) {}
  },

  // Called after login - DB preference wins over localStorage
  syncFromUser(userLang) {
    if (userLang && userLang !== get().language) {
      applyLanguage(userLang)
      set({ language: userLang })
    }
  },
}))

export default useLanguageStore
