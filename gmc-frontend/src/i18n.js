import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en_common   from './locales/en/common.json'
import en_auth     from './locales/en/auth.json'
import en_shop     from './locales/en/shop.json'
import en_wallet   from './locales/en/wallet.json'
import en_orders   from './locales/en/orders.json'
import en_profile  from './locales/en/profile.json'

import ar_common   from './locales/ar/common.json'
import ar_auth     from './locales/ar/auth.json'
import ar_shop     from './locales/ar/shop.json'
import ar_wallet   from './locales/ar/wallet.json'
import ar_orders   from './locales/ar/orders.json'
import ar_profile  from './locales/ar/profile.json'

const savedLang = (typeof localStorage !== 'undefined' && localStorage.getItem('gmc-lang')) || 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common:    en_common,
        auth:      en_auth,
        shop:      en_shop,
        wallet:    en_wallet,
        orders:    en_orders,
        profile:   en_profile,
      },
      ar: {
        common:    ar_common,
        auth:      ar_auth,
        shop:      ar_shop,
        wallet:    ar_wallet,
        orders:    ar_orders,
        profile:   ar_profile,
      },
    },
    lng: savedLang,
    fallbackLng: 'en',
    ns: ['common', 'auth', 'shop', 'wallet', 'orders', 'profile'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
