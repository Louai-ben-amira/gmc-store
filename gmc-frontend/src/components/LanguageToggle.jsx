import useLanguageStore from '../store/languageStore'

export default function LanguageToggle({ style = {} }) {
  const { language, toggleLanguage } = useLanguageStore()
  const isAr = language === 'ar'

  return (
    <button
      onClick={toggleLanguage}
      title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
      style={{
        width: 44, height: 44, borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isAr ? 'rgba(124,58,237,0.10)' : 'rgba(255,255,255,0.05)',
        border: isAr ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.09)',
        cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.18s, border-color 0.18s, transform 0.18s',
        fontFamily: isAr ? "'Tajawal', sans-serif" : "'Inter', sans-serif",
        fontSize: isAr ? '0.8rem' : '0.72rem',
        fontWeight: 700,
        color: isAr ? '#A78BFA' : 'rgba(255,255,255,0.6)',
        letterSpacing: isAr ? 0 : '0.04em',
        ...style,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {isAr ? 'EN' : 'ع'}
    </button>
  )
}
