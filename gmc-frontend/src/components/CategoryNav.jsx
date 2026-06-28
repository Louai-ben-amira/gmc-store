import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCategories } from '../api/products'

const ROOT_TABS = [
  { slug: 'gaming',           label: 'Gaming',  icon: '🎮', color: '#7c3aed' },
  { slug: 'digital-products', label: 'Digital', icon: '💻', color: '#7c3aed' },
  { slug: 'mobile-telecom',   label: 'Mobile',  icon: '📱', color: '#7c3aed' },
]

function fetchRoot() {
  return getCategories({ parent: 'root' }).then(r => {
    const d = r.data
    return Array.isArray(d) ? d : (d?.results ?? [])
  })
}

/* ─── Shared state hook ──────────────────────────────────────────────── */
export function useCategoryNav({ activeSlug, onSelect }) {
  const [openTab,    setOpenTab]    = useState(null)
  const [activeRoot, setActiveRoot] = useState(null)

  const { data: rootCats = [] } = useQuery({
    queryKey: ['categories', 'root'],
    queryFn:  fetchRoot,
    staleTime: 5 * 60 * 1000,
  })

  function handleTabClick(tab) {
    const cat = rootCats.find(c => c.slug === tab.slug)
    setOpenTab(prev => prev === tab.slug ? null : tab.slug)
    setActiveRoot(tab.slug)
    if (cat) onSelect(cat)
  }

  function handleSubClick(cat) {
    setOpenTab(null)
    onSelect(cat)
  }

  function handleAllClick() {
    setOpenTab(null)
    setActiveRoot(null)
    onSelect(null)
  }

  function closeMenu() { setOpenTab(null) }

  const openTabMeta   = ROOT_TABS.find(t => t.slug === openTab)
  const openRootData  = rootCats.find(c => c.slug === openTab)
  const subCategories = openRootData?.children || []

  return {
    rootCats, openTab, activeRoot, activeSlug,
    openTabMeta, subCategories,
    handleTabClick, handleSubClick, handleAllClick, closeMenu,
  }
}

/* ─── Tabs bar (goes inside header) ─────────────────────────────────── */
export function CategoryTabs({ nav }) {
  const { openTab, activeRoot, handleTabClick, handleAllClick } = nav
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
      {ROOT_TABS.map(tab => {
        const isOpen   = openTab === tab.slug
        const isActive = activeRoot === tab.slug
        return (
          <TabButton
            key={tab.slug}
            tab={tab}
            isOpen={isOpen}
            isActive={isActive}
            onClick={() => handleTabClick(tab)}
          />
        )
      })}
      <button
        onClick={handleAllClick}
        style={{
          padding: '0 14px',
          border: 'none',
          background: 'transparent',
          color: '#333370',
          fontSize: '0.75rem',
          cursor: 'pointer',
          transition: 'color 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#9898c8'}
        onMouseLeave={e => e.currentTarget.style.color = '#333370'}
      >
        All →
      </button>
    </div>
  )
}

/* ─── Mega-menu dropdown (goes below header bar, still inside <header>) */
export function CategoryDropdown({ nav, containerRef }) {
  const { openTab, openTabMeta, subCategories, activeSlug, handleSubClick, closeMenu } = nav

  // Close on outside click
  useEffect(() => {
    if (!openTab) return
    function onDown(e) {
      if (containerRef?.current && !containerRef.current.contains(e.target)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openTab])

  if (!openTab || subCategories.length === 0) return null

  const COL_MAX = 5
  const columns = []
  for (let i = 0; i < subCategories.length; i += COL_MAX)
    columns.push(subCategories.slice(i, i + COL_MAX))

  const color = openTabMeta?.color || '#7c3aed'

  return (
    <div style={{
      borderTop: `1px solid ${color}30`,
      background: 'rgba(7,7,20,0.97)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      boxShadow: `0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 ${color}20`,
      padding: '18px 1.5rem 22px',
      animation: 'megaMenuIn 0.17s cubic-bezier(0.22,0.68,0,1.1) both',
    }}>
      {/* Header label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: `1px solid ${color}18`,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 7,
          background: `${color}18`, fontSize: '0.9rem',
        }}>
          {openTabMeta?.icon}
        </span>
        <span style={{
          fontSize: '0.6875rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color,
        }}>
          {openTabMeta?.label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: '#333370' }}>
          {subCategories.length} categories
        </span>
      </div>

      {/* Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
        gap: '0 12px',
      }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {col.map(cat => (
              <SubItem
                key={cat.slug}
                cat={cat}
                active={activeSlug === cat.slug}
                accentColor={color}
                onClick={() => handleSubClick(cat)}
              />
            ))}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes megaMenuIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ─── Default export: standalone (used on non-header pages) ─────────── */
export default function CategoryNav({ activeSlug, onSelect }) {
  const containerRef = useRef(null)
  const nav = useCategoryNav({ activeSlug, onSelect })

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: 100 }}>
      {/* Tab row */}
      <div style={{ borderBottom: '1px solid #18183a' }}>
        <CategoryTabs nav={nav} />
      </div>
      {/* Dropdown */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 200 }}>
        <CategoryDropdown nav={nav} containerRef={containerRef} />
      </div>
    </div>
  )
}

/* ─── Tab button ─────────────────────────────────────────────────────── */
function TabButton({ tab, isOpen, isActive, onClick }) {
  const [hov, setHov] = useState(false)
  const lit = isOpen || isActive
  const color = tab.color

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '0 18px',
        height: '100%',
        border: 'none',
        borderBottom: lit ? `2px solid ${color}` : '2px solid transparent',
        background: isOpen ? `${color}10` : hov ? 'rgba(255,255,255,0.025)' : 'transparent',
        color: lit ? color : hov ? '#9898c8' : '#55558a',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: lit ? 700 : 500,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        position: 'relative',
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{tab.icon}</span>
      {tab.label}
      {lit && (
        <span style={{
          position: 'absolute',
          bottom: -1, left: 0, right: 0, height: 2,
          background: color,
          boxShadow: `0 0 10px ${color}99, 0 0 20px ${color}44`,
        }} />
      )}
      <span style={{
        fontSize: '0.55rem', opacity: 0.55, marginLeft: 1,
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
        transition: 'transform 0.18s',
        display: 'inline-block',
      }}>▾</span>
    </button>
  )
}

/* ─── Sub-category item ──────────────────────────────────────────────── */
function SubItem({ cat, active, accentColor, onClick }) {
  const [hov, setHov] = useState(false)
  const color = cat.color || accentColor

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 10px',
        borderRadius: 9,
        border: `1px solid ${active ? color + '50' : hov ? color + '20' : 'transparent'}`,
        background: active ? `${color}14` : hov ? `${color}09` : 'transparent',
        color: active ? color : hov ? '#c0c0f0' : '#9898c8',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: active ? 600 : 400,
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.11s',
      }}
    >
      <span style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        background: active ? `${color}22` : hov ? `${color}14` : `${color}0c`,
        border: `1px solid ${active ? color + '45' : color + '18'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.85rem', transition: 'all 0.11s',
      }}>
        {cat.icon}
      </span>
      <span style={{ lineHeight: 1.3, flex: 1 }}>{cat.name}</span>
      {active && <span style={{ color, fontSize: '0.7rem', marginLeft: 'auto' }}>✓</span>}
    </button>
  )
}

export function CategorySidebar() { return null }
