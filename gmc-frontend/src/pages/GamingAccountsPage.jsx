import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SiSteam, SiEpicgames } from 'react-icons/si'
import { TbArrowLeft, TbChevronRight, TbSearch } from 'react-icons/tb'
import { getCategoryProducts } from '../api/products'
import { formatCurrency, mediaUrl } from '../utils/formatters'
import Topbar from '../components/Topbar'
import Footer from '../components/Footer'
import ProductCard from '../components/ProductCard'

/* ── inject keyframes once ──────────────────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('ga-style')) {
  const s = document.createElement('style')
  s.id = 'ga-style'
  s.textContent = `
    @keyframes gaFadeUp {
      from { opacity:0; transform:translateY(16px) scale(0.98); }
      to   { opacity:1; transform:translateY(0)    scale(1);    }
    }
    @keyframes gaShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    .ga-platform-tile {
      position: relative; cursor: pointer; border-radius: 20px;
      overflow: hidden; transition: transform 0.2s, box-shadow 0.2s;
      animation: gaFadeUp 0.35s ease both;
    }
    .ga-platform-tile:hover { transform: translateY(-4px); }
    .ga-platform-tile.active { outline: 2px solid; }
  `
  document.head.appendChild(s)
}

/* ── platform config ────────────────────────────────────────────────────── */
const PLATFORMS = [
  {
    id:    'steam',
    slug:  'steam-keys',
    label: 'Steam',
    Icon:  SiSteam,
    color: '#66C0F4',
    accent:'#1B2838',
    bg:    'linear-gradient(135deg, #1B2838 0%, #2A475E 60%, #1B2838 100%)',
    glow:  'rgba(102,192,244,0.35)',
    desc:  'PC game keys, DLC & more',
    badge: 'PC Gaming',
  },
  {
    id:    'epic',
    slug:  'epic-games-keys',
    label: 'Epic Games',
    Icon:  SiEpicgames,
    color: 'var(--text-primary)',
    accent:'#1A1A1A',
    bg:    'linear-gradient(135deg, #1A1A1A 0%, #2C2C2C 60%, #1A1A1A 100%)',
    glow:  'rgba(255,255,255,0.18)',
    desc:  'Epic exclusives & free games',
    badge: 'PC Gaming',
  },
]

/* ── skeleton card ──────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        height: 168,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '400px 100%',
        animation: 'gaShimmer 1.5s infinite',
      }} />
      <div style={{ padding: '12px 14px' }}>
        <div style={{ height: 14, borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: 8 }} />
        <div style={{ height: 14, borderRadius: 6, background: 'var(--bg-elevated)', width: '60%' }} />
      </div>
    </div>
  )
}

/* ── empty state ────────────────────────────────────────────────────────── */
function EmptyState({ platform }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '5rem 1rem', gap: '1rem',
      animation: 'gaFadeUp 0.4s ease both',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `${platform.color}12`,
        border: `1px solid ${platform.color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <platform.Icon size={30} color={platform.color} />
      </div>
      <p style={{
        fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.0625rem',
        color: 'var(--text-secondary)', margin: 0, textAlign: 'center',
      }}>
        No {platform.label} games yet
      </p>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
        color: 'rgba(255,255,255,0.28)', margin: 0, textAlign: 'center', maxWidth: 320,
      }}>
        Check back soon — we're adding new titles regularly.
      </p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function GamingAccountsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()

  const platformId = search.get('platform') || null
  const activePlatform = PLATFORMS.find(p => p.id === platformId) || null

  function selectPlatform(id) {
    setSearch({ platform: id })
  }

  /* fetch products for selected platform */
  const { data, isLoading } = useQuery({
    queryKey: ['gaming-accounts', activePlatform?.slug],
    queryFn:  () => getCategoryProducts(activePlatform.slug, { page_size: 48 }).then(r => r.data),
    enabled:  !!activePlatform,
  })

  const products = data?.results || data || []

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--bg-base, #09090F)' }}>
      <Topbar />

      <main style={{ flex:1, overflowY:'auto' }}>
        <div style={{ maxWidth: 1280, margin:'0 auto', padding:'2rem 1.25rem 4rem' }}>

          {/* ── breadcrumb ───────────────────────────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:'1.5rem', flexWrap:'wrap' }}>
            <button
              onClick={() => navigate('/')}
              style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', fontFamily:'Inter,sans-serif', fontSize:'0.8rem', padding:0, display:'flex', alignItems:'center', gap:4 }}
              onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.35)'}
            >
              <TbArrowLeft size={13} /> Home
            </button>
            <TbChevronRight size={12} color="var(--text-primary)" />
            <span style={{ color:'rgba(255,255,255,0.35)', fontFamily:'Inter,sans-serif', fontSize:'0.8rem' }}>Accounts</span>
            <TbChevronRight size={12} color="var(--text-primary)" />
            {activePlatform
              ? <>
                  <button
                    onClick={() => setSearch({})}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', fontFamily:'Inter,sans-serif', fontSize:'0.8rem', padding:0 }}
                    onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.35)'}
                  >
                    Gaming Accounts
                  </button>
                  <TbChevronRight size={12} color="var(--text-primary)" />
                  <span style={{ color: activePlatform.color, fontFamily:'Inter,sans-serif', fontSize:'0.8rem', fontWeight:600 }}>
                    {activePlatform.label}
                  </span>
                </>
              : <span style={{ color:'rgba(255,255,255,0.7)', fontFamily:'Inter,sans-serif', fontSize:'0.8rem', fontWeight:600 }}>
                  Gaming Accounts
                </span>
            }
          </div>

          {/* ── page title ───────────────────────────────────────────── */}
          {!activePlatform && (
            <div style={{ marginBottom:'2rem', animation:'gaFadeUp 0.3s ease both' }}>
              <h1 style={{
                fontFamily:'Sora,sans-serif', fontWeight:800, fontSize:'clamp(1.5rem,4vw,2.125rem)',
                color:'#fff', margin:'0 0 0.375rem', letterSpacing:'-0.02em',
              }}>
                Gaming Accounts
              </h1>
              <p style={{
                fontFamily:'Inter,sans-serif', fontSize:'0.9rem',
                color:'rgba(255,255,255,0.38)', margin:0,
              }}>
                Choose your platform to browse available games
              </p>
            </div>
          )}

          {/* ── platform selector (shown always, compact when one selected) */}
          {!activePlatform ? (
            /* ── big platform tiles ──────────────────────────────────── */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
              maxWidth: 720,
            }}>
              {PLATFORMS.map((p, i) => (
                <div
                  key={p.id}
                  className="ga-platform-tile"
                  style={{
                    background: p.bg,
                    boxShadow: `0 8px 40px ${p.glow}`,
                    border: `1px solid ${p.color}22`,
                    animationDelay: `${i * 0.08}s`,
                  }}
                  onClick={() => selectPlatform(p.id)}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = `0 16px 56px ${p.glow}`}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = `0 8px 40px ${p.glow}`}
                >
                  {/* glow blob */}
                  <div style={{
                    position:'absolute', top:-40, right:-40, width:160, height:160,
                    borderRadius:'50%', background:`${p.color}14`, filter:'blur(48px)',
                    pointerEvents:'none',
                  }} />

                  <div style={{ padding:'2.25rem 2rem', position:'relative' }}>
                    {/* badge */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:4,
                      background:`${p.color}14`, border:`1px solid ${p.color}22`,
                      borderRadius:6, padding:'3px 10px', marginBottom:'1.25rem',
                    }}>
                      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'0.575rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:p.color }}>
                        {p.badge}
                      </span>
                    </div>

                    {/* icon + label */}
                    <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.875rem' }}>
                      <div style={{
                        width:56, height:56, borderRadius:16,
                        background:`${p.color}15`, border:`1px solid ${p.color}25`,
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      }}>
                        <p.Icon size={28} color={p.color} />
                      </div>
                      <div>
                        <p style={{ margin:0, fontFamily:'Sora,sans-serif', fontWeight:800, fontSize:'1.4375rem', color:'#fff', letterSpacing:'-0.02em' }}>
                          {p.label}
                        </p>
                        <p style={{ margin:'2px 0 0', fontFamily:'Inter,sans-serif', fontSize:'0.8rem', color:`${p.color}99` }}>
                          {p.desc}
                        </p>
                      </div>
                    </div>

                    {/* CTA */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      fontFamily:'Inter,sans-serif', fontSize:'0.8rem', fontWeight:600,
                      color: p.color, opacity:0.8,
                    }}>
                      Browse games <TbChevronRight size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── compact platform strip + products ───────────────────── */
            <>
              {/* compact platform tabs */}
              <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.75rem', flexWrap:'wrap' }}>
                {PLATFORMS.map(p => {
                  const active = p.id === activePlatform.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectPlatform(p.id)}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'9px 18px', borderRadius:10, cursor:'pointer',
                        fontFamily:'Inter,sans-serif', fontSize:'0.875rem', fontWeight: active ? 700 : 500,
                        background: active ? `${p.color}18` : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${active ? p.color : 'rgba(255,255,255,0.09)'}`,
                        color: active ? p.color : 'rgba(255,255,255,0.45)',
                        transition:'all 0.15s',
                        boxShadow: active ? `0 0 18px ${p.color}22` : 'none',
                      }}
                      onMouseEnter={e => { if(!active) { e.currentTarget.style.color='rgba(255,255,255,0.75)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.2)' } }}
                      onMouseLeave={e => { if(!active) { e.currentTarget.style.color='rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.09)' } }}
                    >
                      <p.Icon size={16} />
                      {p.label}
                    </button>
                  )
                })}
              </div>

              {/* section title */}
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem' }}>
                <div style={{
                  width:36, height:36, borderRadius:10,
                  background:`${activePlatform.color}15`,
                  border:`1px solid ${activePlatform.color}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <activePlatform.Icon size={18} color={activePlatform.color} />
                </div>
                <div>
                  <h2 style={{
                    margin:0, fontFamily:'Sora,sans-serif', fontWeight:800,
                    fontSize:'1.3125rem', color:'#fff', letterSpacing:'-0.02em',
                  }}>
                    {activePlatform.label} Games
                  </h2>
                  {!isLoading && products.length > 0 && (
                    <p style={{ margin:0, fontFamily:'JetBrains Mono,monospace', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:`${activePlatform.color}80` }}>
                      {products.length} available
                    </p>
                  )}
                </div>
              </div>

              {/* product grid */}
              {isLoading ? (
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))',
                  gap:'1rem',
                }}>
                  {Array(8).fill(0).map((_,i) => <SkeletonCard key={i} />)}
                </div>
              ) : products.length === 0 ? (
                <EmptyState platform={activePlatform} />
              ) : (
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))',
                  gap:'1rem',
                }}>
                  {products.map((product, i) => (
                    <div key={product.id} style={{ animation:`gaFadeUp 0.35s ${i * 0.04}s ease both` }}>
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <Footer />
      </main>
    </div>
  )
}



