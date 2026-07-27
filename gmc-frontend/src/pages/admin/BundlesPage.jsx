import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBundles, createBundle, updateBundle, deleteBundle, getProducts } from '../../api/admin'
import Modal, { ConfirmModal } from '../../components/Modal'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, CATEGORY_LABELS, mediaUrl} from '../../utils/formatters'
import { Plus, Edit2, Trash2, Package } from 'lucide-react'
import { PageShell, PageHeader, QuickActionButton, StatusPill, IconBtn, T } from '../../components/admin/AdminUI'

const BASE_URL  = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '')
const EMPTY_FORM = { name: '', description: '', bundle_price: '', original_price: '', is_active: true, products: [] }

const CARD_ICONS = { valorant: '', steam: '', epic: '', battle_pass: '⚔️', ooredoo: '', gift_cards: '', other: '' }

function BundleForm({ form, onChange, imagePreview, onImageChange, allProducts }) {
  const toggleProduct = (pid) => {
    const already = form.products.includes(pid)
    onChange('products', already ? form.products.filter(p => p !== pid) : [...form.products, pid])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={LBL}>Bundle Name</label>
        <input value={form.name} onChange={e => onChange('name', e.target.value)} placeholder="e.g. Fortnite Starter Pack" style={INP} />
      </div>
      <div>
        <label style={LBL}>Description</label>
        <textarea value={form.description} onChange={e => onChange('description', e.target.value)} rows={2} placeholder="What's included..." style={{ ...INP, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={LBL}>Bundle Price (DT)</label>
          <input type="number" step="0.01" min="0" value={form.bundle_price} onChange={e => onChange('bundle_price', e.target.value)} placeholder="0.00" style={INP} />
        </div>
        <div>
          <label style={LBL}>Original Price (DT)</label>
          <input type="number" step="0.01" min="0" value={form.original_price} onChange={e => onChange('original_price', e.target.value)} placeholder="0.00" style={INP} />
          <p style={{ color: 'var(--muted)', fontSize: '0.6875rem', margin: '4px 0 0' }}>Used to show the discount %</p>
        </div>
      </div>

      {/* Products selector */}
      <div>
        <label style={{ ...LBL, marginBottom: '0.625rem' }}>Include Products ({form.products.length} selected)</label>
        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--bg-border)', borderRadius: '0.625rem', padding: '0.5rem' }}>
          {allProducts.map(p => {
            const selected = form.products.includes(p.id)
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', padding: '5px 8px', borderRadius: '0.375rem', background: selected ? 'rgba(123,47,255,0.12)' : 'transparent', border: selected ? '1px solid rgba(123,47,255,0.3)' : '1px solid transparent', transition: 'all 0.1s' }}>
                <input type="checkbox" checked={selected} onChange={() => toggleProduct(p.id)} />
                <span style={{ fontSize: '1rem' }}>{CARD_ICONS[p.category] || ''}</span>
                <span style={{ color: selected ? 'var(--violet-light)' : 'var(--lavender)', fontSize: '0.875rem', flex: 1 }}>{p.name}</span>
                <span style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{formatCurrency(p.price)}</span>
              </label>
            )
          })}
          {allProducts.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>No products available.</p>}
        </div>
      </div>

      <div>
        <label style={LBL}>Bundle Image (optional)</label>
        <input type="file" accept="image/*" onChange={onImageChange} style={{ color: 'var(--lavender)', fontSize: '0.875rem' }} />
        {imagePreview && <img src={imagePreview} alt="" style={{ marginTop: '0.5rem', maxHeight: '80px', borderRadius: '0.5rem', objectFit: 'cover' }} />}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_active} onChange={e => onChange('is_active', e.target.checked)} />
        <span style={{ color: 'var(--lavender)', fontSize: '0.875rem' }}>Active (visible in store)</span>
      </label>
    </div>
  )
}

export default function BundlesPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [modal, setModal]           = useState(null)
  const [selected, setSelected]     = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [imageFile, setImageFile]   = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading]       = useState(false)

  const { data: bundlesData } = useQuery({
    queryKey: ['admin-bundles'],
    queryFn: () => getBundles().then(r => r.data),
  })
  const { data: productsData } = useQuery({
    queryKey: ['admin-products-all'],
    queryFn: () => getProducts({ page_size: 100 }).then(r => r.data),
  })
  const bundles     = bundlesData?.results || bundlesData || []
  const allProducts = productsData?.results || productsData || []

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openCreate = () => {
    setForm(EMPTY_FORM); setImageFile(null); setImagePreview(null)
    setModal('create')
  }
  const openEdit = (b) => {
    setSelected(b)
    setForm({ name: b.name, description: b.description || '', bundle_price: b.bundle_price, original_price: b.original_price, is_active: b.is_active, products: (b.products || []) })
    setImageFile(null); setImagePreview(b.image ? `${mediaUrl(b.image)}` : null)
    setModal('edit')
  }
  const openDelete = (b) => { setSelected(b); setModal('delete') }
  const closeModal = () => { setModal(null); setSelected(null) }

  const handleImageChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setImageFile(f); setImagePreview(URL.createObjectURL(f))
  }

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('name', form.name)
    fd.append('description', form.description)
    fd.append('bundle_price', form.bundle_price)
    fd.append('original_price', form.original_price || 0)
    fd.append('is_active', form.is_active)
    form.products.forEach(pid => fd.append('products', pid))
    if (imageFile) fd.append('image', imageFile)
    return fd
  }

  const handleSave = async () => {
    if (!form.name || !form.bundle_price) return toast.error('Name and bundle price are required.')
    if (form.products.length < 2) return toast.error('Select at least 2 products for a bundle.')
    setLoading(true)
    try {
      if (modal === 'create') {
        await createBundle(buildFormData())
        toast.success('Bundle created.')
      } else {
        await updateBundle(selected.id, buildFormData())
        toast.success('Bundle updated.')
      }
      qc.invalidateQueries({ queryKey: ['admin-bundles'] })
      closeModal()
    } catch { toast.error('Something went wrong.') }
    setLoading(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteBundle(selected.id)
      toast.success('Bundle deleted.')
      qc.invalidateQueries({ queryKey: ['admin-bundles'] })
      closeModal()
    } catch { toast.error('Failed to delete.') }
    setLoading(false)
  }

  return (
    <PageShell>
      <PageHeader
        title="Bundle Deals"
        subtitle="Create product bundles at discounted prices"
        actions={<QuickActionButton primary onClick={openCreate}><Plus size={14} /> New Bundle</QuickActionButton>}
      />

      {bundles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', color: T.textMuted, background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '1rem' }}>
          <Package size={52} style={{ display: 'block', margin: '0 auto 1rem', opacity: 0.15 }} />
          <p style={{ fontSize: '1.125rem', color: T.textSub, fontWeight: 700, margin: '0 0 0.25rem' }}>No bundles yet</p>
          <p style={{ fontSize: '0.875rem', margin: '0 0 1.5rem' }}>Create your first bundle to offer discounted product packs.</p>
          <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Create Bundle</button>
        </div>
      ) : (
        <div className="admin-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {bundles.map(b => (
            <div key={b.id} style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', overflow: 'hidden' }}>
              {b.image && <img src={`${mediaUrl(b.image)}`} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />}
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <p style={{ margin: 0, color: T.textPrimary, fontWeight: 700, fontSize: '1rem' }}>{b.name}</p>
                  {b.discount_percentage > 0 && (
                    <span style={{ background: 'rgba(155,79,237,0.15)', border: `1px solid ${T.border}`, color: T.purpleText, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 10px', borderRadius: '999px' }}>-{b.discount_percentage}%</span>
                  )}
                </div>
                {b.description && <p style={{ margin: '0 0 0.75rem', color: T.textMuted, fontSize: '0.8125rem', lineHeight: 1.5 }}>{b.description}</p>}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {(b.products_detail || []).map(p => (
                    <span key={p.id} style={{ background: 'rgba(155,79,237,0.10)', border: `1px solid ${T.border}`, color: T.purpleText, fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px' }}>
                      {CARD_ICONS[p.category]} {p.name.slice(0, 16)}{p.name.length > 16 ? '...' : ''}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    {parseFloat(b.original_price) > 0 && <span style={{ color: T.textMuted, fontFamily: T.mono, fontSize: '0.75rem', textDecoration: 'line-through', display: 'block' }}>{formatCurrency(b.original_price)}</span>}
                    <span style={{ color: T.success, fontFamily: T.mono, fontWeight: 700, fontSize: '1rem' }}>{formatCurrency(b.bundle_price)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <StatusPill status={b.is_active ? 'active' : 'inactive'} label={b.is_active ? 'Active' : 'Hidden'} />
                    <IconBtn onClick={() => openEdit(b)} title="Edit"><Edit2 size={13} /></IconBtn>
                    <IconBtn onClick={() => openDelete(b)} title="Delete" color={T.danger} bg={T.dangerDim} border={T.dangerBorder}><Trash2 size={13} /></IconBtn>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={closeModal} title={modal === 'create' ? 'New Bundle' : 'Edit Bundle'} size="md">
        <BundleForm form={form} onChange={setField} imagePreview={imagePreview} onImageChange={handleImageChange} allProducts={allProducts} />
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={closeModal} disabled={loading}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Bundle'}</button>
        </div>
      </Modal>

      <ConfirmModal isOpen={modal === 'delete'} onClose={closeModal} onConfirm={handleDelete}
        title="Delete Bundle" confirmText="Delete" loading={loading}
        message={`Delete bundle "${selected?.name}"? This cannot be undone.`}
      />
    </PageShell>
  )
}

const LBL = { display: 'block', color: '#B3A4D4', fontSize: '0.8125rem', marginBottom: '0.375rem', fontWeight: 500 }
const INP = { width: '100%', boxSizing: 'border-box' }

