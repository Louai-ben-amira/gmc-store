import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import Topbar from '../components/Topbar'
import CodeModal from '../components/CodeModal'
import { formatCurrency, mediaUrl } from '../utils/formatters'
import { TbCircleCheck, TbShoppingBag, TbAlertTriangle, TbLock, TbClock } from 'react-icons/tb'

export default function CheckoutSuccessPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const orders = location.state?.orders || []
  const failedItems = location.state?.failed_items || []
  const [codeModal, setCodeModal] = useState({ open: false, orderId: null, order: null })

  useEffect(() => {
    if (!location.state || (orders.length === 0 && failedItems.length === 0)) {
      navigate('/orders', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!location.state || (orders.length === 0 && failedItems.length === 0)) return null

  const totalPaid = orders.reduce((s, o) => s + parseFloat(o.amount_paid || 0), 0)
  const totalPoints = orders.reduce((s, o) => s + (o.points_earned || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />
      <div className="pb-nav" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(61,220,132,0.12)', border: '2px solid rgba(61,220,132,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <TbCircleCheck size={32} color="#3DDC84" />
            </div>
            <h1 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
              Your order is complete! 🎉
            </h1>
          </div>

          {failedItems.length > 0 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '1rem 1.125rem', marginBottom: '1.5rem' }}>
              <TbAlertTriangle size={18} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ margin: '0 0 6px', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: '#f87171' }}>
                  {failedItems.length} item{failedItems.length > 1 ? 's' : ''} could not be completed
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'rgba(248,113,113,0.9)' }}>
                  {failedItems.map((f, i) => (
                    <li key={i}>{f.product_name} — {f.reason}</li>
                  ))}
                </ul>
                <p style={{ margin: '6px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'rgba(248,113,113,0.7)' }}>You were not charged for these items.</p>
              </div>
            </div>
          )}

          {orders.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid</p>
                  <p style={{ margin: '4px 0 0', fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: '#3DDC84' }}>{formatCurrency(totalPaid)}</p>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Points Earned</p>
                  <p style={{ margin: '4px 0 0', fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: '#f59e0b' }}>+{totalPoints}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
                {orders.map(order => (
                  <div key={order.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.125rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#181825', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {order.product_detail?.image
                        ? <img src={mediaUrl(order.product_detail.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <TbShoppingBag size={18} color="rgba(255,255,255,0.2)" />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {order.product_detail?.name || 'Product'}
                        {order.variant_detail?.label && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {order.variant_detail.label}</span>}
                      </p>
                      <p style={{ margin: '2px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#3DDC84' }}>{formatCurrency(order.amount_paid)}</p>
                    </div>
                    {order.status === 'completed' ? (
                      <button className="btn-primary" onClick={() => setCodeModal({ open: true, orderId: order.id, order })} style={{ flexShrink: 0, padding: '7px 14px', fontSize: '0.8125rem' }}>
                        <TbLock size={13} /> Reveal Code
                      </button>
                    ) : order.status === 'paid_escrow' ? (
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#f59e0b' }}>
                        <TbClock size={13} /> Being processed
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ textAlign: 'center' }}>
            <Link to="/orders" className="btn-secondary" style={{ display: 'inline-flex' }}>View My Orders</Link>
          </div>
        </div>
      </div>

      <CodeModal
        isOpen={codeModal.open}
        onClose={() => setCodeModal({ open: false, orderId: null, order: null })}
        orderId={codeModal.orderId}
        orderData={codeModal.order}
      />
    </div>
  )
}
