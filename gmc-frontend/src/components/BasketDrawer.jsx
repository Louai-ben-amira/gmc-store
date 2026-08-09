import { useNavigate } from 'react-router-dom'
import { TbX, TbShoppingBag, TbTrash, TbMinus, TbPlus, TbCoins, TbReceipt2 } from 'react-icons/tb'
import useBasketStore, { selectTotalPrice, selectTotalPoints, selectItemCount } from '../store/basketStore'
import useBasketDrawerStore from '../store/basketDrawerStore'
import { mediaUrl } from '../utils/formatters'

const SERVICE_FEE_RATE = 0.01

export default function BasketDrawer() {
  const open        = useBasketDrawerStore(s => s.open)
  const closeDrawer  = useBasketDrawerStore(s => s.closeDrawer)
  const items        = useBasketStore(s => s.items)
  const removeItem    = useBasketStore(s => s.removeItem)
  const updateQuantity = useBasketStore(s => s.updateQuantity)
  const subtotal      = useBasketStore(selectTotalPrice)
  const totalPoints   = useBasketStore(selectTotalPoints)
  const itemCount     = useBasketStore(selectItemCount)
  const navigate      = useNavigate()

  if (!open) return null

  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100
  const total = subtotal + serviceFee

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
        boxShadow: '-16px 0 40px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.125rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TbShoppingBag size={17} color="var(--accent)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Your Basket
              </h2>
              {itemCount > 0 && (
                <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </p>
              )}
            </div>
          </div>
          <button onClick={closeDrawer} className="basket-close-btn" style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
            cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
          }}>
            <TbX size={16} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TbShoppingBag size={26} style={{ opacity: 0.35 }} />
              </div>
              <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0 0 4px' }}>Your basket is empty</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', margin: 0 }}>Add something you like to get started.</p>
            </div>
          ) : items.map(item => {
            const allowQty = !item.requires_account && (!item.required_fields || item.required_fields.length === 0)
            return (
              <div key={item.id} className="basket-item" style={{
                display: 'flex', gap: 10, padding: '0.75rem',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
                transition: 'border-color 0.15s ease',
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#181825', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.thumbnail
                    ? <img src={mediaUrl(item.thumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <TbShoppingBag size={18} color="rgba(255,255,255,0.2)" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.product_name}
                      </p>
                      {item.variant_label && (
                        <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{item.variant_label}</p>
                      )}
                    </div>
                    <button onClick={() => removeItem(item.id)} className="basket-item-trash" style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, flexShrink: 0, borderRadius: 7, transition: 'color 0.15s ease, background 0.15s ease',
                      marginTop: -4, marginRight: -4,
                    }}>
                      <TbTrash size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--accent)' }}>
                      {(item.price * item.quantity).toFixed(2)} DT
                    </span>
                    {allowQty ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} className="basket-qty-btn"
                          style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: item.quantity <= 1 ? 'default' : 'pointer', opacity: item.quantity <= 1 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TbMinus size={12} />
                        </button>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-primary)', minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="basket-qty-btn"
                          style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TbPlus size={12} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Qty {item.quantity}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '1rem 1.25rem calc(1rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10,
              padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Subtotal</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{subtotal.toFixed(2)} DT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#f59e0b' }}>
                  <TbReceipt2 size={13} /> Service fee (1%)
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '0.8125rem', color: '#f59e0b' }}>+{serviceFee.toFixed(2)} DT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginTop: 2, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Total</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--accent)' }}>{total.toFixed(2)} DT</span>
              </div>
            </div>

            {totalPoints > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.125rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <TbCoins size={13} color="#f59e0b" /> Points earned
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', color: '#f59e0b' }}>+{totalPoints}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
              <button className="btn-primary" onClick={handleCheckout} style={{ width: '100%', justifyContent: 'center', padding: '0.8125rem', fontSize: '0.9375rem' }}>
                Checkout — {total.toFixed(2)} DT
              </button>
              <button className="btn-secondary" onClick={closeDrawer} style={{ width: '100%', justifyContent: 'center' }}>
                Continue Shopping
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
        .basket-item:hover { border-color: var(--border-strong); }
        .basket-item-trash:hover { color: var(--urgent); background: var(--urgent-dim); }
        .basket-qty-btn:not(:disabled):hover { background: var(--bg-elevated); color: var(--accent); }
        .basket-close-btn:hover { color: var(--text-primary); border-color: var(--border-strong); }
      `}</style>
    </div>
  )
}
