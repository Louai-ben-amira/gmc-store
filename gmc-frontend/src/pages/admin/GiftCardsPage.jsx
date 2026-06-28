import { useState, useRef } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate, mediaUrl } from '../../utils/formatters'
import { Gift, Plus, Copy, Check, ChevronDown, ChevronUp, Loader, ImagePlus, Trash2, Edit2, X } from 'lucide-react'
import api from '../../api/index'
import { PageShell, QuickActionButton, T } from '../../components/admin/AdminUI'

const getGiftCardBatches  = () => api.get('/payments/admin/gift-cards/').then(r => r.data)
const createGiftCardBatch = (fd)  => api.post('/payments/admin/gift-cards/', fd).then(r => r.data)
const updateGiftCardBatch = ({ id, fd }) => api.patch(`/payments/admin/gift-cards/${id}/`, fd).then(r => r.data)
const deleteGiftCardBatch = (id)  => api.delete(`/payments/admin/gift-cards/${id}/`)
const getBatchCodes       = (pk)  => api.get(`/payments/admin/gift-cards/${pk}/codes/`).then(r => r.data)

/* ── Copy button ─────────────────────────────────────────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} title="Copy" style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
      color: copied ? 'var(--success)' : 'var(--text-muted)',
      transition: 'color 0.15s', display: 'flex',
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

/* ── Image picker ────────────────────────────────────────────────────── */
function ImagePicker({ value, onChange }) {
  const ref = useRef()
  const src = value instanceof File ? URL.createObjectURL(value) : value ? mediaUrl(value) : null

  return (
    <div
      onClick={() => ref.current?.click()}
      style={{
        width: '100%', aspectRatio: '16/9',
        borderRadius: 10,
        border: `2px dashed ${src ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.12)'}`,
        background: src ? 'transparent' : 'rgba(255,255,255,0.03)',
        cursor: 'pointer', overflow: 'hidden', position: 'relative',
        transition: 'border-color 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {src ? (
        <>
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
          >
            <ImagePlus size={22} color="var(--text-primary)" />
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <ImagePlus size={24} style={{ marginBottom: 6 }} />
          <p style={{ margin: 0, fontSize: '0.75rem' }}>Click to upload image</p>
        </div>
      )}
      <input
        ref={ref} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) onChange(e.target.files[0]) }}
      />
    </div>
  )
}

/* ── Codes modal ─────────────────────────────────────────────────────── */
function CodesModal({ batch, onClose }) {
  const { data: codes, isLoading } = useQuery({
    queryKey: ['gift-card-codes', batch.id],
    queryFn: () => getBatchCodes(batch.id),
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 16, padding: '1.5rem', maxWidth: 640, width: '100%',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              {batch.label || `Batch #${batch.id}`}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {batch.cards_available} available · {batch.cards_used} used · {formatCurrency(batch.amount)} each
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {(codes || []).map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', borderRadius: 8,
                  background: c.is_used ? 'rgba(255,255,255,0.02)' : 'rgba(124,58,237,0.06)',
                  border: `1px solid ${c.is_used ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.2)'}`,
                }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
                    color: c.is_used ? 'rgba(255,255,255,0.25)' : 'var(--accent)',
                    textDecoration: c.is_used ? 'line-through' : 'none',
                  }}>{c.code}</span>
                  {c.is_used
                    ? <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Used</span>
                    : <CopyBtn text={c.code} />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Create / Edit form modal ────────────────────────────────────────── */
function BatchFormModal({ editing, onClose, onSaved }) {
  const toast = useToast()
  const isEdit = !!editing

  const [form, setForm] = useState({
    label:      editing?.label      ?? '',
    amount:     editing?.amount     ?? '',
    quantity:   editing?.quantity   ?? '',
    expires_at: editing?.expires_at ?? '',
  })
  const [image, setImage] = useState(editing?.image ?? null)

  const createMutation = useMutation({
    mutationFn: createGiftCardBatch,
    onSuccess: (data) => { toast.success('Batch created! Codes generated.'); onSaved(data) },
    onError:   (err) => { toast.error(Object.values(err.response?.data || {}).flat().join(' ') || 'Failed.') },
  })

  const updateMutation = useMutation({
    mutationFn: updateGiftCardBatch,
    onSuccess: (data) => { toast.success('Batch updated.'); onSaved(data) },
    onError:   (err) => { toast.error(Object.values(err.response?.data || {}).flat().join(' ') || 'Failed.') },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isEdit && (!form.amount || !form.quantity)) { toast.error('Amount and quantity are required.'); return }

    const fd = new FormData()
    fd.append('label', form.label)
    if (!isEdit) {
      fd.append('amount', form.amount)
      fd.append('quantity', form.quantity)
      if (form.expires_at) fd.append('expires_at', form.expires_at)
    }
    if (image instanceof File) fd.append('image', image)

    if (isEdit) {
      updateMutation.mutate({ id: editing.id, fd })
    } else {
      createMutation.mutate(fd)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 16, padding: '1.5rem', maxWidth: 520, width: '100%',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Batch' : 'New Gift Card Batch'}
          </p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Image */}
        <div>
          <label style={LBL}>Product Image</label>
          <ImagePicker value={image} onChange={setImage} />
        </div>

        {/* Label */}
        <div>
          <label style={LBL}>Label</label>
          <input
            type="text" placeholder="e.g. 10 DT Gift Card"
            value={form.label}
            onChange={e => setForm({ ...form, label: e.target.value })}
            style={INPUT}
          />
        </div>

        {!isEdit && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={LBL}>Amount (DT) *</label>
                <input type="number" placeholder="10.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required style={INPUT} />
              </div>
              <div>
                <label style={LBL}>Quantity *</label>
                <input type="number" placeholder="5" min="1" max="500" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required style={INPUT} />
              </div>
            </div>
            <div>
              <label style={LBL}>Expires at (optional)</label>
              <input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} style={INPUT} />
            </div>
          </>
        )}

        <button type="submit" disabled={isPending} style={{
          padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: isPending ? 'rgba(124,58,237,0.5)' : '#7C3AED',
          color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem',
        }}>
          {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create & Generate Codes'}
        </button>
      </form>
    </div>
  )
}

const LBL = {
  display: 'block', marginBottom: 5,
  fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
}
const INPUT = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)',
  fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', outline: 'none',
}

/* ── Gift card product card ──────────────────────────────────────────── */
function BatchCard({ batch, onEdit, onDelete, onViewCodes }) {
  const usedPct = batch.cards_total > 0 ? (batch.cards_used / batch.cards_total) * 100 : 0

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden',
      transition: 'border-color 0.2s, transform 0.2s',
      display: 'flex', flexDirection: 'column',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'none' }}
    >
      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0d0d18', overflow: 'hidden' }}>
        {batch.image ? (
          <img src={mediaUrl(batch.image)} alt={batch.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
            <Gift size={32} />
            <span style={{ fontSize: '0.75rem' }}>No image</span>
          </div>
        )}

        {/* Amount badge */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(11,11,18,0.9)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(124,58,237,0.4)', borderRadius: 8,
          padding: '4px 10px',
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.875rem',
          color: 'var(--accent)',
        }}>
          {formatCurrency(batch.amount)}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1 }}>
        <div>
          <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {batch.label || `Gift Card #${batch.id}`}
          </p>
          {batch.expires_at && (
            <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              Expires {formatDate(batch.expires_at)}
            </p>
          )}
        </div>

        {/* Usage bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>Codes used</span>
            <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
              {batch.cards_used} / {batch.cards_total}
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${usedPct}%`, borderRadius: 999, background: usedPct > 80 ? 'var(--urgent)' : '#7C3AED', transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 4 }}>
          <button
            onClick={() => onViewCodes(batch)}
            style={{
              flex: 1, padding: '7px', borderRadius: 8,
              border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)',
              color: 'var(--accent)', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
          >
            View Codes
          </button>
          <button
            onClick={() => onEdit(batch)}
            title="Edit"
            style={{
              padding: '7px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.color = '#A78BFA' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(batch)}
            title="Delete"
            style={{
              padding: '7px 10px', borderRadius: 8,
              border: '1px solid rgba(255,68,102,0.2)', background: 'rgba(255,68,102,0.05)',
              color: 'rgba(255,68,102,0.6)', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,68,102,0.15)'; e.currentTarget.style.color = '#FF4466' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,68,102,0.05)'; e.currentTarget.style.color = 'rgba(255,68,102,0.6)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function GiftCardsPage() {
  const toast = useToast()
  const qc = useQueryClient()

  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [viewCodes,  setViewCodes]  = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['gift-card-batches'],
    queryFn: getGiftCardBatches,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteGiftCardBatch,
    onSuccess: () => { toast.success('Batch deleted.'); qc.invalidateQueries(['gift-card-batches']); setConfirmDel(null) },
    onError:   () => { toast.error('Failed to delete.') },
  })

  const handleSaved = () => {
    qc.invalidateQueries(['gift-card-batches'])
    setShowForm(false)
    setEditing(null)
  }

  return (
    <PageShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Gift size={22} color={T.purple} />
          <div style={{ fontFamily: T.heading, fontWeight: 700, fontSize: 26, color: T.textPrimary }}>Gift Cards</div>
          <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, fontFamily: T.mono, background: 'rgba(155,79,237,0.12)', color: T.purpleText, border: `1px solid ${T.border}` }}>
            {batches.length} batches
          </span>
        </div>
        <QuickActionButton primary onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus size={15} /> New Batch
        </QuickActionButton>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: T.textMuted }}>
          <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : batches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', border: `1px dashed ${T.border}`, borderRadius: 16, color: T.textMuted }}>
          <Gift size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No gift card batches yet.</p>
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', opacity: 0.7 }}>Click "New Batch" to create your first gift card.</p>
        </div>
      ) : (
        <div className="admin-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {batches.map(b => (
            <BatchCard
              key={b.id}
              batch={b}
              onEdit={(b) => { setEditing(b); setShowForm(true) }}
              onDelete={setConfirmDel}
              onViewCodes={setViewCodes}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <BatchFormModal
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* View codes modal */}
      {viewCodes && (
        <CodesModal batch={viewCodes} onClose={() => setViewCodes(null)} />
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setConfirmDel(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#0f0f1a', border: '1px solid rgba(255,68,102,0.3)',
            borderRadius: 14, padding: '1.5rem', maxWidth: 380, width: '100%', textAlign: 'center',
          }}>
            <Trash2 size={28} color="#FF4466" style={{ marginBottom: 12 }} />
            <p style={{ margin: '0 0 6px', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Delete Batch?
            </p>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              "{confirmDel.label || `Batch #${confirmDel.id}`}" and all its codes will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDel(null)} style={{
                flex: 1, padding: '9px', borderRadius: 8,
                border: '1px solid var(--border-strong)', background: 'transparent',
                color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600,
              }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirmDel.id)} disabled={deleteMutation.isPending} style={{
                flex: 1, padding: '9px', borderRadius: 8, border: 'none',
                background: '#FF4466', color: 'var(--text-primary)', cursor: 'pointer',
                fontFamily: 'Sora, sans-serif', fontWeight: 700,
              }}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PageShell>
  )
}




