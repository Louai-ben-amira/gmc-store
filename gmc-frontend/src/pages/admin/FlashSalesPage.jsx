import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getProducts, setFlashSale, clearFlashSale } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, mediaUrl } from '../../utils/formatters'
import { Zap, X, Clock, Tag } from 'lucide-react'
import { PageShell, FilterTabs, T } from '../../components/admin/AdminUI'

const CATEGORY_LABELS = {
  gift_cards: 'Gift Cards', valorant: 'Valorant', steam: 'Steam',
  epic: 'Epic Games', battle_pass: 'Battle Pass', ooredoo: 'Ooredoo', other: 'Other',
}

function countdown(endStr) {
  if (!endStr) return null
  const diff = new Date(endStr) - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m left`
}

function ProductCard({ product, onSave, onClear, loading }) {
  const active = product.flash_sale_active
  const [price, setPrice] = useState(product.flash_sale_price || '')
  const [endsAt, setEndsAt] = useState(
    product.flash_sale_end
      ? new Date(product.flash_sale_end).toISOString().slice(0, 16)
      : ''
  )
  const [open, setOpen] = useState(false)

  const discount = price && product.price
    ? Math.round((1 - parseFloat(price) / parseFloat(product.price)) * 100)
    : 0

  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${active ? 'rgba(139,61,255,0.4)' : 'var(--bg-border)'}`,
      borderRadius: '1rem', overflow: 'hidden',
      boxShadow: active ? '0 0 24px rgba(139,61,255,0.12)' : 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* Image */}
      <div style={{ position: 'relative', height: '120px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        {product.image
          ? <img src={mediaUrl(product.image)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>🎮</div>
        }
        {active && (
          <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#8B3DFF', color: 'var(--text-primary)', borderRadius: '999px', padding: '2px 10px', fontSize: '0.6875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={10} /> LIVE
          </div>
        )}
        {active && product.flash_sale_end && (
          <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', borderRadius: '999px', padding: '2px 8px', fontSize: '0.6875rem', color: '#FFB800', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={9} /> {countdown(product.flash_sale_end)}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '0.875rem' }}>
        <p style={{ margin: '0 0 2px', color: 'var(--white-primary)', fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{CATEGORY_LABELS[product.category] || product.category}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {active && (
              <span style={{ color: '#8B3DFF', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem' }}>
                {formatCurrency(product.flash_sale_price)}
              </span>
            )}
            <span style={{ color: active ? 'var(--muted)' : 'var(--white-primary)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem', textDecoration: active ? 'line-through' : 'none' }}>
              {formatCurrency(product.price)}
            </span>
          </div>
        </div>

        {/* Stock badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
          <span style={{
            padding: '2px 8px', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700,
            background: product.stock_count > 5 ? 'rgba(0,210,106,0.12)' : product.stock_count > 0 ? 'rgba(255,184,0,0.12)' : 'rgba(255,77,77,0.12)',
            color: product.stock_count > 5 ? '#00D26A' : product.stock_count > 0 ? '#FFB800' : '#FF4D4D',
            border: `1px solid ${product.stock_count > 5 ? 'rgba(0,210,106,0.25)' : product.stock_count > 0 ? 'rgba(255,184,0,0.25)' : 'rgba(255,77,77,0.25)'}`,
          }}>{product.stock_count} in stock</span>
          {active && discount > 0 && (
            <span style={{ background: 'rgba(139,61,255,0.15)', border: '1px solid rgba(139,61,255,0.3)', color: '#B14EFF', borderRadius: '999px', padding: '2px 8px', fontSize: '0.6875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Tag size={9} /> -{discount}%
            </span>
          )}
        </div>

        {/* Controls */}
        {!open && !active && (
          <button onClick={() => setOpen(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            padding: '0.5rem', borderRadius: '0.625rem', border: '1px solid rgba(139,61,255,0.3)',
            background: 'rgba(139,61,255,0.08)', color: '#B14EFF', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,61,255,0.18)'; e.currentTarget.style.borderColor = '#8B3DFF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,61,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(139,61,255,0.3)' }}
          >
            <Zap size={14} /> Schedule Flash Sale
          </button>
        )}

        {(open || active) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '3px' }}>Sale Price (DT)</label>
                <input type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                  placeholder={product.price} style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem' }} />
              </div>
              {price && product.price && parseFloat(price) < parseFloat(product.price) && (
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                  <span style={{ color: '#00D26A', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>-{discount}%</span>
                </div>
              )}
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '3px' }}>Ends At</label>
              <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button
                onClick={() => onSave(product.id, price, endsAt)}
                disabled={loading || !price || !endsAt}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  padding: '0.5rem', borderRadius: '0.625rem', border: 'none',
                  background: 'linear-gradient(135deg, #8B3DFF, #B14EFF)', color: 'var(--text-primary)',
                  cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 700,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <Zap size={12} /> {active ? 'Update' : 'Activate'}
              </button>
              {active && (
                <button onClick={() => onClear(product.id)} disabled={loading} style={{
                  padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1px solid rgba(255,77,77,0.3)',
                  background: 'rgba(255,77,77,0.08)', color: '#FF4D4D', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}>
                  <X size={14} />
                </button>
              )}
              {!active && (
                <button onClick={() => setOpen(false)} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1px solid var(--bg-border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FlashSalesPage() {
  const qc      = useQueryClient()
  const toast   = useToast()
  const [loading, setLoading] = useState({})
  const [filter, setFilter]   = useState('all')

  const { data: productsData } = useQuery({
    queryKey: ['admin-products-flash'],
    queryFn:  () => getProducts().then(r => r.data),
    refetchInterval: 30000,
  })

  const products = (productsData?.results || productsData || []).filter(p => {
    if (filter === 'active')   return p.flash_sale_active
    if (filter === 'inactive') return !p.flash_sale_active
    return true
  })

  const activeSales = (productsData?.results || productsData || []).filter(p => p.flash_sale_active).length

  const handleSave = async (id, price, endsAt) => {
    setLoading(l => ({ ...l, [id]: true }))
    try {
      await setFlashSale(id, {
        is_flash_sale:   true,
        flash_sale_price: parseFloat(price),
        flash_sale_end:  new Date(endsAt).toISOString(),
      })
      toast.success('Flash sale activated!')
      qc.invalidateQueries({ queryKey: ['admin-products-flash'] })
    } catch {
      toast.error('Failed to set flash sale.')
    }
    setLoading(l => ({ ...l, [id]: false }))
  }

  const handleClear = async (id) => {
    setLoading(l => ({ ...l, [id]: true }))
    try {
      await clearFlashSale(id)
      toast.success('Flash sale cleared.')
      qc.invalidateQueries({ queryKey: ['admin-products-flash'] })
    } catch {
      toast.error('Failed to clear flash sale.')
    }
    setLoading(l => ({ ...l, [id]: false }))
  }

  return (
    <PageShell>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontFamily: T.heading, fontWeight: 700, fontSize: 26, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Zap size={22} color={T.purple} /> Flash Sales
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
            Schedule discounts with auto-expiry via Celery Beat.
            {activeSales > 0 && <span style={{ color: T.purpleText, fontWeight: 600, marginLeft: '6px' }}>{activeSales} active now</span>}
          </div>
        </div>
        <FilterTabs
          tabs={[{ value: 'all', label: 'All' }, { value: 'active', label: '⚡ Active' }, { value: 'inactive', label: 'Inactive' }]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <div style={{ background: 'rgba(155,79,237,0.07)', border: `1px solid ${T.border}`, borderRadius: '0.875rem', padding: '0.875rem 1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Clock size={16} color={T.purple} style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, color: T.textSub, fontSize: '0.8125rem', lineHeight: 1.5 }}>
          Flash sales auto-expire via <strong style={{ color: T.purpleText }}>Celery Beat</strong> (checks every minute). Set a price + end time and it runs automatically — no manual intervention needed.
        </p>
      </div>

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', color: T.textMuted, padding: '4rem', background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '1rem' }}>
          <Zap size={40} style={{ opacity: 0.1, display: 'block', margin: '0 auto 1rem' }} />
          <p style={{ margin: 0, fontWeight: 600, color: T.textSub }}>No products found</p>
        </div>
      ) : (
        <div className="admin-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {products.map(p => (
            <ProductCard key={p.id} product={p} loading={!!loading[p.id]} onSave={handleSave} onClear={handleClear} />
          ))}
        </div>
      )}
    </PageShell>
  )
}

