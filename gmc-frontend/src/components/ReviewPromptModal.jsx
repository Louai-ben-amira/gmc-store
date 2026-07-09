// Post-purchase review prompt: when a logged-in customer has finished orders
// (completed/closed) whose product they haven't reviewed yet, a modal pops up
// asking them to rate it. "Later" snoozes that product for 12h.
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import Modal from './Modal'
import { StarPicker } from './StarRating'
import { getPendingReviews, submitReview } from '../api/products'
import useAuthStore from '../store/authStore'
import { useToast } from '../hooks/useToast'
import { mediaUrl } from '../utils/formatters'

const SNOOZE_KEY = 'gmc_review_snooze'
const SNOOZE_MS  = 12 * 60 * 60 * 1000 // 12h

const readSnoozes = () => {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY)) || {} } catch { return {} }
}
const snoozeProduct = (productId) => {
  const map = readSnoozes()
  map[productId] = Date.now()
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(map))
}
const isSnoozed = (productId) => {
  const ts = readSnoozes()[productId]
  return ts && Date.now() - ts < SNOOZE_MS
}

export default function ReviewPromptModal() {
  const { t } = useTranslation('shop')
  const { isAuthenticated, user } = useAuthStore()
  const qc    = useQueryClient()
  const toast = useToast()

  const [visible, setVisible]     = useState(false)
  const [dismissed, setDismissed] = useState([]) // product ids skipped this session
  const [rating, setRating]       = useState(0)
  const [body, setBody]           = useState('')
  const [loading, setLoading]     = useState(false)

  const authed = isAuthenticated() && user?.role !== 'admin'

  const { data: pending = [] } = useQuery({
    queryKey: ['pending-reviews'],
    queryFn: () => getPendingReviews().then(r => r.data || []),
    enabled: authed,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  })

  const current = pending.find(p => !isSnoozed(p.product_id) && !dismissed.includes(p.product_id))

  // Small delay so the modal doesn't flash in the instant the page loads
  useEffect(() => {
    if (!current) { setVisible(false); return }
    const id = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(id)
  }, [current?.product_id])

  if (!authed || !current || !visible) return null

  const closeCurrent = () => {
    snoozeProduct(current.product_id)
    setDismissed(d => [...d, current.product_id])
    setRating(0); setBody(''); setVisible(false)
  }

  const handleSubmit = async () => {
    if (rating === 0) return toast.error(t('reviewPrompt.pickRating'))
    setLoading(true)
    try {
      await submitReview(current.product_id, { rating, body })
      toast.success(t('reviewPrompt.thanks'))
      setDismissed(d => [...d, current.product_id])
      setRating(0); setBody('')
      qc.invalidateQueries({ queryKey: ['pending-reviews'] })
      qc.invalidateQueries({ queryKey: ['reviews', current.product_id] })
      qc.invalidateQueries({ queryKey: ['review-eligibility', current.product_id] })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('reviewPrompt.failed'))
      // Already-reviewed or ineligible: don't keep nagging for this product
      if (err.response?.status === 400 || err.response?.status === 403) {
        setDismissed(d => [...d, current.product_id])
        qc.invalidateQueries({ queryKey: ['pending-reviews'] })
      }
    } finally { setLoading(false) }
  }

  return (
    <Modal isOpen onClose={closeCurrent} title={t('reviewPrompt.title')} size="sm">
      {/* Product header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '0.75rem', overflow: 'hidden', flexShrink: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {current.product_image
            ? <img src={mediaUrl(current.product_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Package size={22} style={{ color: 'var(--text-muted)' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--white-primary)', fontWeight: 700, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current.product_name}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
            {t('reviewPrompt.subtitle')}
          </div>
        </div>
      </div>

      {/* Stars */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <StarPicker value={rating} onChange={setRating} size={34} />
      </div>

      {/* Comment (optional) */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={t('reviewPrompt.placeholder')}
        rows={3}
        maxLength={1000}
        style={{
          width: '100%', resize: 'vertical', boxSizing: 'border-box',
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: '0.625rem', padding: '0.75rem',
          color: 'var(--white-primary)', fontSize: '0.875rem', fontFamily: 'inherit',
          marginBottom: '1.25rem',
        }}
      />

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={closeCurrent} disabled={loading}>
          {t('reviewPrompt.later')}
        </button>
        <button className="btn-primary" onClick={handleSubmit} disabled={loading || rating === 0}>
          {loading ? t('product.submitting') : t('product.submitReview')}
        </button>
      </div>
    </Modal>
  )
}
