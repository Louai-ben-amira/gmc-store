import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { revealCode, cancelOrder } from '../api/orders'
import Modal from './Modal'
import TicketStub from './ui/TicketStub'
import Badge from './ui/Badge'
import { useToast } from '../hooks/useToast'
import { formatCurrency } from '../utils/formatters'
import { TbCopy, TbCheck, TbLock } from 'react-icons/tb'

/* ── Code modal (extracted from ProductPage.jsx) ─────────────────────── */
export default function CodeModal({ isOpen, onClose, orderId, orderData }) {
  const { t }    = useTranslation('shop')
  const toast    = useToast()
  const qc       = useQueryClient()
  const [step,    setStep]    = useState('locked')  // locked | warn | revealed
  const [code,    setCode]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) { setStep('locked'); setCode(null); setCopied(false) }
  }, [isOpen])

  const handleReveal = async () => {
    setLoading(true)
    try {
      const { data } = await revealCode(orderId)
      setCode(data.code)
      setStep('revealed')
      qc.invalidateQueries({ queryKey: ['orders'] })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not reveal code.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? Your balance will be refunded.')) return
    setCancelLoading(true)
    try {
      await cancelOrder(orderId)
      toast.success('Order cancelled. Balance refunded.')
      qc.invalidateQueries({ queryKey: ['orders'] })
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not cancel order.')
    } finally {
      setCancelLoading(false)
    }
  }

  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('product.codeReady')} size="md">
      <div style={{ textAlign: 'center' }}>

        {step !== 'revealed' ? (
          /* ─ Pre-reveal ─ */
          <div>
            {/* Lock icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0.5rem auto 1.25rem',
              background: 'rgba(124,58,237,0.1)', border: '2px solid rgba(124,58,237,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TbLock size={32} color="var(--accent)" />
            </div>
            <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Your code is ready
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              {orderData && <><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatCurrency(orderData.amount_paid)}</span> paid · </>}
              Code is locked until you reveal it.
            </p>

            {step === 'warn' ? (
              /* Confirmation step */
              <div>
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12, padding: '1rem', marginBottom: '1.25rem', textAlign: 'left',
                }}>
                  <p style={{ margin: '0 0 6px', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.8125rem', color: '#f87171' }}>
                    ⚠️ Read before revealing
                  </p>
                  <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'rgba(248,113,113,0.85)', lineHeight: 1.55 }}>
                    Once you reveal the code, <strong>this order cannot be cancelled or refunded</strong>.
                    Make sure you are ready to use it now.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn-secondary" onClick={() => setStep('locked')} style={{ flex: 1 }}>
                    Go Back
                  </button>
                  <button className="btn-primary" onClick={handleReveal} disabled={loading} style={{ flex: 1, justifyContent: 'center', background: '#7C3AED' }}>
                    {loading ? 'Revealing…' : 'Confirm & Reveal'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={() => setStep('warn')}
                  style={{ width: '100%', justifyContent: 'center', padding: '0.875rem' }}
                >
                  <TbLock size={15} /> Reveal Code
                </button>
                {orderData?.is_refund_eligible && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    style={{
                      width: '100%', padding: '0.625rem', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600,
                    }}
                  >
                    {cancelLoading ? 'Cancelling…' : '✕ Cancel Order & Get Refund'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ─ Post-reveal ─ */
          <div>
            <TicketStub
              top={
                <div>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{t('product.digitalCode')}</p>
                  <code style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', wordBreak: 'break-all', display: 'block', letterSpacing: '0.06em' }}>
                    {code}
                  </code>
                </div>
              }
              bottom={
                orderData && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{t('product.paid')}</p>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>{formatCurrency(orderData.amount_paid)}</span>
                    </div>
                    <Badge variant="accent">{t('product.delivered')}</Badge>
                  </div>
                )
              }
            />
            <button className="btn-primary" onClick={copy} style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem', marginBottom: '0.75rem', padding: '0.75rem' }}>
              {copied ? <><TbCheck size={15} /> {t('product.copied')}</> : <><TbCopy size={15} /> {t('product.copyCode')}</>}
            </button>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', margin: 0 }}>
              {t('product.alsoIn')} <span style={{ color: 'var(--accent)' }}>{t('product.myOrders')}</span>.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
