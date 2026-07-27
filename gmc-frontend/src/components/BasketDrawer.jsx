import { useNavigate } from 'react-router-dom'
import { TbX, TbShoppingBag, TbTrash, TbMinus, TbPlus, TbCoins } from 'react-icons/tb'
import useBasketStore, { selectTotalPrice, selectTotalPoints } from '../store/basketStore'
import useBasketDrawerStore from '../store/basketDrawerStore'
import { mediaUrl } from '../utils/formatters'

export default function BasketDrawer() {
  const open        = useBasketDrawerStore(s => s.open)
  const closeDrawer  = useBasketDrawerStore(s => s.closeDrawer)
  const items        = useBasketStore(s => s.items)
  const removeItem    = useBasketStore(s => s.removeItem)
  const updateQuantity = useBasketStore(s => s.updateQuantity)
  const totalPrice    = useBasketStore(selectTotalPrice)
  const totalPoints   = useBasketStore(selectTotalPoints)
  const navigate      = useNavigate()

  if (!open) return null

  const handleCheckout = () => {
    closeDrawer()
    navigate('/checkout')
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && closeDrawer()}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(5,2,12,0.72)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 400, height: '100%',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        animation: 'basketSlideIn 0.24s ease both',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TbShoppingBag size={18} color="var(--accent)" />
            <h2 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Your Basket
            </h2>
          </div>
          <button onClick={closeDrawer} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', padding: 4,
          }}>
            <TbX size={18} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
              <TbShoppingBag size={40} style={{ opacity: 0.25, marginBottom: 12 }} />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', margin: 0 }}>Your basket is empty.</p>
            </div>
          ) : items.map(item => {
            const allowQty = !item.requires_account && (!item.required_fields || item.required_fields.length === 0)
            return (
              <div key={item.id} style={{
                display: 'flex', gap: 10, padding: '0.75rem',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 9, overflow: 'hidden', flexShrink: 0, background: '#181825', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.thumbnail
                    ? <img src={mediaUrl(item.thumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <TbShoppingBag size={18} color="rgba(255,255,255,0.2)" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.product_name}
                  </p>
                  {item.variant_label && (
                    <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{item.variant_label}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--accent)' }}>
                      {(item.price * item.quantity).toFixed(2)} DT
                    </span>
                    {allowQty ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}
                          style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: item.quantity <= 1 ? 'default' : 'pointer', opacity: item.quantity <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TbMinus size={11} />
                        </button>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-primary)', minWidth: 16, textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TbPlus size={11} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Qty {item.quantity}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => removeItem(item.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'flex-start', padding: 2, flexShrink: 0,
                }}>
                  <TbTrash size={15} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Subtotal</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{totalPrice.toFixed(2)} DT</span>
            </div>
            {totalPoints > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <TbCoins size={13} color="#f59e0b" /> Points earned
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', color: '#f59e0b' }}>+{totalPoints}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn-secondary" onClick={closeDrawer} style={{ flex: 1, justifyContent: 'center' }}>
                Continue Shopping
              </button>
              <button className="btn-primary" onClick={handleCheckout} style={{ flex: 1, justifyContent: 'center' }}>
                Checkout →
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes basketSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
