import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getProducts, createProduct, updateProduct, deleteProduct,
  uploadCodes, getCodes, deleteCode, syncProductStock,
  setProductStock, getCategories,
  getVariants, createVariant, updateVariant, deleteVariant,
} from '../../api/admin'
import Modal, { ConfirmModal } from '../../components/Modal'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, mediaUrl } from '../../utils/formatters'
import { Plus, Edit2, Trash2, Upload, Search, Eye, EyeOff, Layers } from 'lucide-react'
import { PageShell, PageHeader, QuickActionButton, IconBtn, TH_STYLE, TD_STYLE, T } from '../../components/admin/AdminUI'

/* ── flatten nested category tree ──────────────────────────────────────── */
function flattenCats(nodes, depth = 0, acc = []) {
  for (const node of nodes) {
    acc.push({ id: node.id, name: node.name, slug: node.slug, icon: node.icon || '', color: node.color || '#7C3AED', depth })
    if (node.children?.length) flattenCats(node.children, depth + 1, acc)
  }
  return acc
}

/* ── Custom category picker ─────────────────────────────────────────────── */
function CategoryPicker({ value, onChange, flatCategories }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return flatCategories
    const q = search.toLowerCase()
    return flatCategories.filter(c => c.name.toLowerCase().includes(q))
  }, [flatCategories, search])

  const selected = flatCategories.find(c => c.id === Number(value))

  const pick = (cat) => {
    onChange(cat ? cat.id : '')
    setOpen(false)
    setSearch('')
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px', height: 36, borderRadius: 7,
          border: `1px solid ${open ? '#7C3AED' : 'rgba(255,255,255,0.1)'}`,
          background: 'var(--bg-elevated)', cursor: 'pointer',
          transition: 'border-color 0.15s',
          outline: 'none',
        }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: '0.875rem', lineHeight: 1, flexShrink: 0 }}>{selected.icon || '📦'}</span>
            {selected.depth > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                {'›'.repeat(selected.depth)}
              </span>
            )}
            <span style={{ flex: 1, textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.name}
            </span>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: selected.color, flexShrink: 0, opacity: 0.7 }} />
          </>
        ) : (
          <span style={{ flex: 1, textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No category
          </span>
        )}
        <svg width="10" height="6" viewBox="0 0 10 6" style={{ flexShrink: 0, opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M1 1l4 4 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div onClick={() => { setOpen(false); setSearch('') }} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
            background: '#0f0a1e', border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
            overflow: 'hidden',
          }}>
            {/* Search */}
            <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search categories..."
                  style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 28, height: 32, fontSize: '0.8125rem', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
              {/* Clear option */}
              <button
                type="button"
                onClick={() => pick(null)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', border: 'none', background: !value ? 'rgba(124,58,237,0.12)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (value) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (value) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '0.875rem' }}>🚫</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No category</span>
              </button>

              {filtered.map(cat => {
                const isSelected = cat.id === Number(value)
                const indent = cat.depth * 16
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => pick(cat)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: `6px 12px 6px ${12 + indent}px`,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: isSelected ? 'rgba(124,58,237,0.18)' : 'transparent',
                      borderLeft: isSelected ? '2px solid #7C3AED' : '2px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    {cat.depth > 0 && (
                      <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', flexShrink: 0 }}>└</span>
                    )}
                    <span style={{ fontSize: cat.depth === 0 ? '0.9375rem' : '0.8125rem', lineHeight: 1, flexShrink: 0 }}>{cat.icon || '📦'}</span>
                    <span style={{
                      flex: 1, fontSize: cat.depth === 0 ? '0.875rem' : '0.8125rem',
                      fontWeight: cat.depth === 0 ? 600 : 400,
                      color: isSelected ? '#C4B5FD' : cat.depth === 0 ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {cat.name}
                    </span>
                    {cat.depth === 0 && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0, opacity: 0.8 }} />
                    )}
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                        <path d="M2 6l3 3 5-5" stroke="#A78BFA" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                )
              })}

              {filtered.length === 0 && (
                <p style={{ margin: 0, padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No categories match
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── form default ───────────────────────────────────────────────────────── */
const EMPTY_FORM = {
  name: '', category: '', price: '', description: '',
  visible: true, is_flash_sale: false, flash_sale_price: '', flash_sale_end: '',
  requires_account: false, has_variants: false, required_fields: [], points_purchasable: false,
  points_earned: 0,
}

const EMPTY_RF = { key: '', label: '', type: 'text', required: true, placeholder: '' }

/* ── Required Fields editor ─────────────────────────────────────────────── */
function RequiredFieldsEditor({ fields, onChange }) {
  const add    = () => onChange([...fields, { ...EMPTY_RF }])
  const remove = (i) => onChange(fields.filter((_, idx) => idx !== i))
  const setF   = (i, k, v) => onChange(fields.map((f, idx) => idx === i ? { ...f, [k]: v } : f))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={LBL}>Required Fields (shown to buyer at checkout)</label>
        <button type="button" onClick={add}
          style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.1)', color: 'var(--accent)', cursor: 'pointer' }}>
          + Add Field
        </button>
      </div>
      {fields.length === 0 && (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
          No required fields — buyers won't be asked for extra info.
        </p>
      )}
      {fields.map((f, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px', marginBottom: 8 }}>
          {/* Row 1: key + label + type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 6, marginBottom: 6 }}>
            <div>
              <label style={{ ...LBL, marginBottom: 2 }}>Key</label>
              <input value={f.key} onChange={e => setF(i, 'key', e.target.value)}
                placeholder="e.g. phone" style={{ ...INP, height: 32, fontSize: '0.8rem' }} />
            </div>
            <div>
              <label style={{ ...LBL, marginBottom: 2 }}>Label (shown to buyer)</label>
              <input value={f.label} onChange={e => setF(i, 'label', e.target.value)}
                placeholder="e.g. Phone Number" style={{ ...INP, height: 32, fontSize: '0.8rem' }} />
            </div>
            <div>
              <label style={{ ...LBL, marginBottom: 2 }}>Type</label>
              <select value={f.type} onChange={e => setF(i, 'type', e.target.value)}
                style={{ ...INP, height: 32, fontSize: '0.8rem' }}>
                <option value="text">Text</option>
                <option value="tel">📱 Phone (tel)</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="password">Password</option>
                <option value="textarea">Textarea</option>
              </select>
            </div>
          </div>
          {/* Row 2: placeholder + required toggle + remove */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center' }}>
            <input value={f.placeholder || ''} onChange={e => setF(i, 'placeholder', e.target.value)}
              placeholder="Placeholder text (optional)" style={{ ...INP, height: 32, fontSize: '0.8rem' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={!!f.required} onChange={e => setF(i, 'required', e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
              Required
            </label>
            <button type="button" onClick={() => remove(i)}
              style={{ width: 28, height: 28, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              ×
            </button>
          </div>
          {f.type === 'tel' && (
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#34D399' }}>
              📱 Phone field — buyers will see the topup waiting screen after purchase instead of a code.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Product Form ───────────────────────────────────────────────────────── */
function ProductForm({ form, onChange, imagePreview, onImageChange, flatCategories }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Name + Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={LBL}>Name *</label>
          <input
            value={form.name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="Product name"
            style={INP}
          />
        </div>

        <div>
          <label style={LBL}>Category</label>
          <CategoryPicker
            value={form.category}
            onChange={val => onChange('category', val)}
            flatCategories={flatCategories}
          />
        </div>
      </div>

      {/* Price + Points Earned */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={LBL}>Price (DT) *</label>
          <input
            type="number" step="0.01" min="0"
            value={form.price}
            onChange={e => onChange('price', e.target.value)}
            placeholder="0.00"
            style={INP}
          />
        </div>
        <div>
          <label style={LBL}>⭐ Points Earned on Purchase</label>
          <input
            type="number" min="0" step="1"
            value={form.points_earned ?? 0}
            onChange={e => onChange('points_earned', parseInt(e.target.value) || 0)}
            placeholder="0 = use global rate"
            style={INP}
          />
          <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: '0.7rem' }}>
            0 = use global POINTS_RATE setting
          </p>
        </div>
      </div>

      {/* Description */}
      <div>
        <label style={LBL}>Description</label>
        <textarea
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          rows={3} placeholder="Optional description"
          style={{ ...INP, resize: 'vertical' }}
        />
      </div>

      {/* Image */}
      <div>
        <label style={LBL}>Image</label>
        <input type="file" accept="image/*" onChange={onImageChange}
          style={{ color: 'var(--lavender)', fontSize: '0.875rem' }} />
        {imagePreview && (
          <img src={imagePreview} alt=""
            style={{ marginTop: '0.5rem', maxHeight: '80px', borderRadius: '0.5rem', objectFit: 'cover' }} />
        )}
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.visible} onChange={e => onChange('visible', e.target.checked)} />
          <span style={{ color: 'var(--lavender)', fontSize: '0.875rem' }}>Visible in store</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.requires_account} onChange={e => onChange('requires_account', e.target.checked)} />
          <span style={{ color: 'var(--lavender)', fontSize: '0.875rem' }}>Requires account</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.has_variants} onChange={e => onChange('has_variants', e.target.checked)} />
          <span style={{ color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 500 }}>Has variants (amounts/packs)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.points_purchasable} onChange={e => onChange('points_purchasable', e.target.checked)} />
          <span style={{ color: '#F5A623', fontSize: '0.875rem', fontWeight: 500 }}>Purchasable with points</span>
        </label>
      </div>

      {/* Required Fields */}
      <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: '0.875rem' }}>
        <RequiredFieldsEditor
          fields={form.required_fields || []}
          onChange={v => onChange('required_fields', v)}
        />
      </div>

      {/* Flash sale */}
      <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: '0.875rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={form.is_flash_sale} onChange={e => onChange('is_flash_sale', e.target.checked)} />
          <span style={{ color: '#FF6B00', fontSize: '0.875rem', fontWeight: 600 }}>Flash Sale</span>
        </label>
        {form.is_flash_sale && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={LBL}>Flash Sale Price (DT)</label>
              <input type="number" step="0.01" min="0" value={form.flash_sale_price}
                onChange={e => onChange('flash_sale_price', e.target.value)} placeholder="0.00" style={INP} />
            </div>
            <div>
              <label style={LBL}>Sale Ends At</label>
              <input type="datetime-local" value={form.flash_sale_end}
                onChange={e => onChange('flash_sale_end', e.target.value)} style={INP} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Variants Panel ─────────────────────────────────────────────────────── */
const EMPTY_VARIANT = { label: '', price: '', amount_value: '', stock_count: 0, is_active: true, order: 0, points_earned: 0 }

function VariantsPanel({ productId, productName, onClose }) {
  const qc    = useQueryClient()
  const toast = useToast()
  const [editId,   setEditId]   = useState(null)
  const [editForm, setEditForm] = useState({})
  const [newForm,  setNewForm]  = useState({ ...EMPTY_VARIANT })
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['admin-variants', productId],
    queryFn: () => getVariants(productId).then(r => r.data),
    enabled: !!productId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-variants', productId] })

  const handleAdd = async () => {
    if (!newForm.label || !newForm.price) { toast.error('Label and price are required.'); return }
    setSaving(true)
    try {
      await createVariant(productId, {
        label: newForm.label,
        price: newForm.price,
        amount_value: newForm.amount_value || null,
        stock_count: parseInt(newForm.stock_count) || 0,
        is_active: newForm.is_active,
        order: parseInt(newForm.order) || 0,
        points_earned: parseInt(newForm.points_earned) || 0,
      })
      toast.success('Variant added.')
      setNewForm({ ...EMPTY_VARIANT })
      setAdding(false)
      invalidate()
    } catch { toast.error('Failed to add variant.') }
    setSaving(false)
  }

  const handleUpdate = async (id) => {
    setSaving(true)
    try {
      await updateVariant(productId, id, editForm)
      toast.success('Variant updated.')
      setEditId(null)
      invalidate()
    } catch { toast.error('Failed to update.') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this variant?')) return
    try {
      await deleteVariant(productId, id)
      toast.success('Variant deleted.')
      invalidate()
    } catch { toast.error('Failed to delete.') }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--white-primary)', fontSize: '1.375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={20} /> Variants
          </h1>
          <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>{productName}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAdding(v => !v)} className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.875rem' }}>
            <Plus size={14} /> Add Variant
          </button>
          <button onClick={onClose} className="btn-secondary">Back to Products</button>
        </div>
      </div>

      {/* Add new form */}
      {adding && (
        <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Variant</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 70px 60px 60px auto', gap: 8, alignItems: 'end' }}>
            {[
              { k: 'label',         label: 'Label *',      type: 'text',   placeholder: 'e.g. 2050 VP' },
              { k: 'price',         label: 'Price (DT) *', type: 'number', placeholder: '0.00' },
              { k: 'amount_value',  label: 'Amount',       type: 'number', placeholder: 'e.g. 2050' },
              { k: 'stock_count',   label: 'Stock',        type: 'number', placeholder: '0' },
              { k: 'points_earned', label: '⭐ Points',    type: 'number', placeholder: '0' },
              { k: 'order',         label: 'Order',        type: 'number', placeholder: '0' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ ...LBL, fontSize: '0.7rem' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder}
                  value={newForm[f.k]}
                  onChange={e => setNewForm(v => ({ ...v, [f.k]: e.target.value }))}
                  style={{ ...INP, height: 32, fontSize: '0.8rem' }} />
              </div>
            ))}
            <div>
              <label style={{ ...LBL, fontSize: '0.7rem' }}>Active</label>
              <input type="checkbox" checked={newForm.is_active}
                onChange={e => setNewForm(v => ({ ...v, is_active: e.target.checked }))}
                style={{ marginTop: 8 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button onClick={handleAdd} disabled={saving}
                style={{ height: 32, padding: '0 12px', borderRadius: 6, border: 'none', background: '#7C3AED', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                {saving ? '...' : 'Add'}
              </button>
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <button onClick={() => setAdding(false)}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #1e1e2e', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Variants table */}
      {isLoading ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>Loading...</p>
      ) : variants.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid #1e1e2e', borderRadius: '0.875rem', padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
          No variants yet. Click "Add Variant" to create the first one.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid #1e1e2e', borderRadius: '0.875rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Label','Price','Amount','Stock','⭐ Points','Order','Active','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.id}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {editId === v.id ? (
                    <>
                      {['label','price','amount_value','stock_count','points_earned','order'].map(k => (
                        <td key={k} style={TD}>
                          <input type={k === 'label' ? 'text' : 'number'}
                            value={editForm[k] ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))}
                            style={{ width: k === 'label' ? 130 : 70, height: 28, fontSize: '0.8rem', boxSizing: 'border-box' }} />
                        </td>
                      ))}
                      <td style={TD}>
                        <input type="checkbox" checked={editForm.is_active ?? true}
                          onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))} />
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleUpdate(v.id)} disabled={saving}
                            style={{ ...ICON_BTN, color: '#1D9E75', fontSize: '0.75rem', padding: '4px 8px' }}>Save</button>
                          <button onClick={() => setEditId(null)}
                            style={{ ...ICON_BTN, fontSize: '0.75rem', padding: '4px 8px' }}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...TD, fontWeight: 600, color: 'var(--white-primary)' }}>{v.label}</td>
                      <td style={{ ...TD, color: '#3DDC84', fontWeight: 700 }}>{formatCurrency(v.price)}</td>
                      <td style={TD}>{v.amount_value ?? '--'}</td>
                      <td style={{ ...TD, color: v.stock_count === 0 ? '#ef4444' : 'var(--white-primary)', fontWeight: 600 }}>{v.stock_count}</td>
                      <td style={{ ...TD, color: v.points_earned > 0 ? '#F5A623' : 'var(--muted)' }}>{v.points_earned || '--'}</td>
                      <td style={{ ...TD, color: 'var(--muted)' }}>{v.order}</td>
                      <td style={TD}>
                        <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: v.is_active ? 'rgba(29,158,117,0.15)' : 'rgba(239,68,68,0.15)', color: v.is_active ? '#1D9E75' : '#ef4444' }}>
                          {v.is_active ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setEditId(v.id); setEditForm({ label: v.label, price: v.price, amount_value: v.amount_value ?? '', stock_count: v.stock_count, is_active: v.is_active, order: v.order }) }}
                            style={ICON_BTN}><Edit2 size={13} /></button>
                          <button onClick={() => handleDelete(v.id)}
                            style={{ ...ICON_BTN, color: '#ef4444' }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function ProductsPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState(null)
  const [selected, setSelected] = useState(null)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [codesText, setCodesText]         = useState('')
  const [codesPlatform, setCodesPlatform] = useState('other')
  const [codesFilter, setCodesFilter]     = useState('all')
  const [codesSearch, setCodesSearch]     = useState('')
  const [codesPage, setCodesPage]         = useState(1)
  const [codesProductId, setCodesProductId] = useState(null)
  const [deletingCodeId, setDeletingCodeId] = useState(null)
  const [syncingStock, setSyncingStock]     = useState(false)
  const [loading,   setLoading]  = useState(false)
  const [stockLoading, setStockLoading] = useState({})
  const [variantProduct, setVariantProduct] = useState(null)

  /* ── queries ──────────────────────────────────────────────────────── */
  const { data: productsData } = useQuery({
    queryKey: ['admin-products', search],
    queryFn:  () => getProducts({ search, page_size: 50 }).then(r => r.data),
  })
  const { data: catsData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn:  () => getCategories({ ordering: 'name' }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: codesData, isLoading: codesLoading } = useQuery({
    queryKey: ['admin-codes', codesProductId, codesFilter, codesSearch, codesPage],
    queryFn:  () => {
      const params = { page: codesPage, page_size: 50 }
      if (codesFilter !== 'all') params.status = codesFilter
      if (codesSearch.trim()) params.search = codesSearch.trim()
      return getCodes(codesProductId, params).then(r => r.data)
    },
    enabled:       !!codesProductId && modal === 'view-codes',
    refetchOnMount: true,
    staleTime:      0,
  })

  const products = productsData?.results || productsData || []

  const flatCategories = useMemo(() => {
    const tree = catsData?.results || catsData || []
    const roots = tree.filter(c => !c.parent)
    return flattenCats(roots)
  }, [catsData])

  /* ── handlers ─────────────────────────────────────────────────────── */
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openCreate = () => {
    const firstId = flatCategories[0]?.id || ''
    setForm({ ...EMPTY_FORM, category: firstId })
    setImageFile(null); setImagePreview(null)
    setModal('create')
  }

  const openEdit = (p) => {
    setSelected(p)
    const flashEndLocal = p.flash_sale_end ? new Date(p.flash_sale_end).toISOString().slice(0, 16) : ''
    setForm({
      name: p.name,
      category: p.category || '',
      price: p.price,
      description: p.description || '',
      visible: p.visible,
      is_flash_sale: p.is_flash_sale || false,
      flash_sale_price: p.flash_sale_price || '',
      flash_sale_end: flashEndLocal,
      requires_account: p.requires_account || false,
      has_variants: p.has_variants || false,
      required_fields: Array.isArray(p.required_fields) ? p.required_fields : [],
      points_purchasable: p.points_purchasable || false,
      points_earned: p.points_earned || 0,
    })
    setImageFile(null)
    setImagePreview(p.image ? mediaUrl(p.image) : null)
    setModal('edit')
  }

  const openCodes     = (p) => { setSelected(p); setCodesText(''); setCodesPlatform('other'); setModal('codes') }
  const openViewCodes = (p) => {
    setSelected(p)
    setCodesProductId(p.id)
    setCodesFilter('all')
    setCodesSearch('')
    setCodesPage(1)
    setModal('view-codes')
  }
  const openDelete  = (p) => { setSelected(p); setModal('delete') }
  const closeModal  = () => { setModal(null); setSelected(null) }

  const handleImageChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('name', form.name)
    if (form.category) fd.append('category', form.category)
    fd.append('price', form.price)
    fd.append('description', form.description)
    fd.append('visible', form.visible)
    fd.append('requires_account', form.requires_account)
    fd.append('has_variants', form.has_variants)
    fd.append('points_purchasable', form.points_purchasable)
    fd.append('points_earned', form.points_earned ?? 0)
    fd.append('required_fields', JSON.stringify(form.required_fields || []))
    fd.append('is_flash_sale', form.is_flash_sale)
    if (form.is_flash_sale && form.flash_sale_price) fd.append('flash_sale_price', form.flash_sale_price)
    if (form.is_flash_sale && form.flash_sale_end)   fd.append('flash_sale_end', new Date(form.flash_sale_end).toISOString())
    if (imageFile) fd.append('image', imageFile)
    return fd
  }

  const handleSave = async () => {
    if (!form.name || !form.price) return toast.error('Name and price are required.')
    setLoading(true)
    try {
      if (modal === 'create') {
        await createProduct(buildFormData())
        toast.success('Product created.')
      } else {
        await updateProduct(selected.id, buildFormData())
        toast.success('Product updated.')
      }
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      closeModal()
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.name?.[0] || 'Something went wrong.'
      toast.error(msg)
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteProduct(selected.id)
      toast.success('Product deleted.')
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      closeModal()
    } catch { toast.error('Failed to delete.') }
    setLoading(false)
  }

  const handleUploadCodes = async () => {
    if (!codesText.trim()) return toast.error('Paste at least one code.')
    setLoading(true)
    try {
      const { data } = await uploadCodes(selected.id, { csv_text: codesText, platform: codesPlatform })
      const msg = data.duplicates > 0
        ? `${data.created} codes added (${data.duplicates} duplicates skipped).`
        : `${data.created} codes added.`
      toast.success(msg)
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-codes'] })
      closeModal()
    } catch { toast.error('Upload failed.') }
    setLoading(false)
  }

  const handleDeleteCode = async (codeId) => {
    if (!window.confirm('Delete this code? This cannot be undone.')) return
    setDeletingCodeId(codeId)
    try {
      await deleteCode(codesProductId, codeId)
      toast.success('Code deleted.')
      qc.invalidateQueries({ queryKey: ['admin-codes', codesProductId] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed.')
    }
    setDeletingCodeId(null)
  }

  const handleSyncStock = async () => {
    setSyncingStock(true)
    try {
      const { data } = await syncProductStock(codesProductId)
      if (data.synced) {
        toast.success(`Stock synced: ${data.old_stock_count} → ${data.new_stock_count}`)
      } else {
        toast.success(`Stock already in sync (${data.new_stock_count} available).`)
      }
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    } catch {
      toast.error('Sync failed.')
    }
    setSyncingStock(false)
  }

  const handleStockChange = async (product, delta) => {
    const next = Math.max(0, product.stock_count + delta)
    if (next === product.stock_count) return
    setStockLoading(s => ({ ...s, [product.id]: true }))
    try {
      await setProductStock(product.id, next)
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    } catch { toast.error('Failed to update stock.') }
    setStockLoading(s => ({ ...s, [product.id]: false }))
  }

  /* ── render ───────────────────────────────────────────────────────── */

  if (variantProduct) {
    return (
      <VariantsPanel
        productId={variantProduct.id}
        productName={variantProduct.name}
        onClose={() => setVariantProduct(null)}
      />
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Products"
        actions={<QuickActionButton primary onClick={openCreate}><Plus size={14} /> New Product</QuickActionButton>}
      />

      <div style={{ position: 'relative', marginBottom: '1.25rem', maxWidth: '340px' }}>
        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: T.textMuted }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." style={{ paddingLeft: '2.25rem', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, color: T.textPrimary, width: '100%', padding: '8px 12px 8px 2.25rem', outline: 'none', fontSize: '0.875rem' }} />
      </div>

      <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Image','Name','Category','Price','Stock','Variants','Visible','Actions'].map(h => (
                <th key={h} style={TH_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>No products found.</td></tr>
            ) : products.map(p => (
              <tr key={p.id}
                style={{ transition: 'background 0.1s', opacity: p.visible ? 1 : 0.55 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,79,219,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={TD_STYLE}>
                  {p.image
                    ? <img src={mediaUrl(p.image)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '0.5rem', border: `1px solid ${T.border}` }} />
                    : <div style={{ width: 40, height: 40, background: T.bgStrip, borderRadius: '0.5rem', border: `1px solid ${T.border}` }} />
                  }
                </td>
                <td style={{ ...TD_STYLE, fontWeight: 600, color: T.textPrimary }}>
                  {p.name}
                  {p.required_fields?.length > 0 && (
                    <span title="Has required buyer fields" style={{ marginLeft: 6, fontSize: '0.6rem', color: T.warning, background: T.warningDim, padding: '1px 5px', borderRadius: 4, border: `1px solid ${T.warningBorder}` }}>
                      {p.required_fields.length}F
                    </span>
                  )}
                </td>
                <td style={TD_STYLE}>
                  {p.category_detail
                    ? <span style={{ background: 'rgba(155,79,237,0.15)', color: T.purpleText, padding: '2px 8px', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {p.category_detail.name}
                      </span>
                    : <span style={{ color: T.textMuted, fontSize: '0.75rem' }}>--</span>
                  }
                </td>
                <td style={{ ...TD_STYLE, color: T.success, fontWeight: 600, fontFamily: T.mono }}>{formatCurrency(p.price)}</td>
                <td style={TD_STYLE}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => handleStockChange(p, -1)} disabled={stockLoading[p.id] || p.stock_count <= 0}
                      style={{ ...STOCK_BTN, color: T.danger, borderColor: T.dangerBorder }}>-</button>
                    <span style={{
                      minWidth: 28, textAlign: 'center', fontFamily: T.mono,
                      fontWeight: 700, fontSize: '0.875rem',
                      color: p.stock_count === 0 ? T.danger : p.stock_count <= 3 ? T.warning : T.textPrimary,
                    }}>
                      {stockLoading[p.id] ? '...' : p.stock_count}
                    </span>
                    <button onClick={() => handleStockChange(p, +1)} disabled={stockLoading[p.id]}
                      style={{ ...STOCK_BTN, color: T.success, borderColor: T.successBorder }}>+</button>
                  </div>
                </td>
                <td style={TD_STYLE}>
                  {p.has_variants ? (
                    <button onClick={() => setVariantProduct(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'rgba(155,79,237,0.10)', color: T.purpleText, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <Layers size={12} /> {p.variants?.length ?? 0} variants
                    </button>
                  ) : (
                    <span style={{ color: T.textMuted, fontSize: '0.75rem' }}>--</span>
                  )}
                </td>
                <td style={TD_STYLE}>
                  <button
                    title={p.visible ? 'Click to hide' : 'Click to show'}
                    onClick={async () => {
                      try {
                        const fd = new FormData(); fd.append('visible', !p.visible)
                        await updateProduct(p.id, fd)
                        qc.invalidateQueries({ queryKey: ['admin-products'] })
                      } catch { toast.error('Failed to toggle visibility.') }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    {p.visible
                      ? <Eye size={15} color={T.success} />
                      : <EyeOff size={15} color={T.danger} />
                    }
                  </button>
                </td>
                <td style={TD_STYLE}>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <IconBtn onClick={() => openEdit(p)} title="Edit"><Edit2 size={14} /></IconBtn>
                    <IconBtn onClick={() => openCodes(p)} title="Upload Codes" color={T.success} bg={T.successDim} border={T.successBorder}><Upload size={14} /></IconBtn>
                    <IconBtn onClick={() => openViewCodes(p)} title="View Codes" color="#60A5FA" bg="rgba(96,165,250,0.08)" border="rgba(96,165,250,0.25)"><Eye size={14} /></IconBtn>
                    <IconBtn onClick={() => openDelete(p)} title="Delete" color={T.danger} bg={T.dangerDim} border={T.dangerBorder}><Trash2 size={14} /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modal === 'create' || modal === 'edit'}
        onClose={closeModal}
        title={modal === 'create' ? 'New Product' : `Edit -- ${selected?.name}`}
        size="md"
      >
        <ProductForm
          form={form}
          onChange={setField}
          imagePreview={imagePreview}
          onImageChange={handleImageChange}
          flatCategories={flatCategories}
        />
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={closeModal} disabled={loading}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'codes'} onClose={closeModal} title={`Upload Codes - ${selected?.name}`} size="md">
        <p style={{ color: T.textSub, fontSize: '0.875rem', marginTop: 0 }}>
          One code per line. Duplicates are added as-is.
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <label style={LBL}>Platform</label>
          <select
            value={codesPlatform} onChange={e => setCodesPlatform(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            <option value="steam">Steam</option>
            <option value="epic">Epic Games</option>
            <option value="gog">GOG</option>
            <option value="xbox">Xbox</option>
            <option value="psn">PlayStation</option>
            <option value="battlenet">Battle.net</option>
            <option value="ubisoft">Ubisoft Connect</option>
            <option value="ea">EA App</option>
            <option value="other">Other</option>
          </select>
        </div>
        <textarea
          value={codesText} onChange={e => setCodesText(e.target.value)}
          rows={10} placeholder={'CODE001\nCODE002\nCODE003'}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8125rem', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <p style={{ color: T.textMuted, fontSize: '0.8125rem', margin: '0.5rem 0 0' }}>
          {codesText.split('\n').filter(l => l.trim()).length} codes detected
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={closeModal} disabled={loading}>Cancel</button>
          <button className="btn-primary" onClick={handleUploadCodes} disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'view-codes'} onClose={closeModal} title={`Codes — ${selected?.name}`} size="lg">
        {/* summary pills + sync button */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'stretch' }}>
          {[
            { label: 'Total',     value: codesData?.total,     color: '#B57BFF', bg: 'rgba(181,123,255,0.1)' },
            { label: 'Available', value: codesData?.available, color: '#34D399', bg: 'rgba(52,211,153,0.1)'  },
            { label: 'Sold',      value: codesData?.sold,      color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', padding: '0.5rem', borderRadius: 8, background: bg, border: `1px solid ${color}33` }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{codesLoading ? '…' : (value ?? 0)}</div>
              <div style={{ fontSize: '0.75rem', color: T.textMuted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
          <button
            onClick={handleSyncStock}
            disabled={syncingStock}
            title="Sync product stock_count to match actual available codes"
            style={{
              alignSelf: 'stretch', padding: '0 14px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)',
              background: 'rgba(52,211,153,0.06)', color: '#34D399', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            {syncingStock ? '…' : '⟳ Sync Stock'}
          </button>
        </div>

        {/* stock mismatch warning */}
        {codesData && selected && codesData.available !== selected.stock_count && (
          <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 8, padding: '0.5rem 0.875rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#F5A623' }}>
            ⚠️ Stock count mismatch — product shows <b>{selected.stock_count}</b> in stock but there are <b>{codesData.available}</b> available codes.{' '}
            Click <b>⟳ Sync Stock</b> to fix.
          </div>
        )}

        {/* filter tabs + search */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {['all', 'available', 'sold'].map(f => (
            <button
              key={f}
              onClick={() => { setCodesFilter(f); setCodesPage(1) }}
              style={{
                padding: '0.25rem 0.875rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, textTransform: 'capitalize',
                background: codesFilter === f ? '#7C3AED' : 'rgba(255,255,255,0.06)',
                color: codesFilter === f ? '#fff' : T.textSub,
                transition: 'all 0.15s',
              }}
            >{f}</button>
          ))}
          <div style={{ flex: 1, position: 'relative', minWidth: 160 }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
            <input
              value={codesSearch}
              onChange={e => { setCodesSearch(e.target.value); setCodesPage(1) }}
              placeholder="Search code…"
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 26, height: 30, fontSize: '0.8rem', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: T.textPrimary, outline: 'none' }}
            />
          </div>
        </div>

        {/* codes table */}
        <div style={{ maxHeight: 340, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(139,79,219,0.15)' }}>
          {codesLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: T.textMuted }}>Loading…</div>
          ) : !codesData?.codes?.length ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: T.textMuted }}>
              {codesSearch ? `No codes matching "${codesSearch}".` : 'No codes found.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Platform', 'Code', 'Status', 'Added', ''].map((h, i) => (
                    <th key={i} style={{ ...TH_STYLE, background: 'rgba(0,0,0,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codesData.codes.map(c => (
                  <tr key={c.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={TD_STYLE}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#B57BFF', textTransform: 'capitalize' }}>
                        {PLATFORM_LABELS[c.platform] || c.platform}
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE, fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', maxWidth: 260 }}>{c.code}</td>
                    <td style={TD_STYLE}>
                      <span style={{
                        display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 99,
                        fontSize: '0.75rem', fontWeight: 600,
                        background: c.status === 'available' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                        color:      c.status === 'available' ? '#34D399' : '#F87171',
                        border: `1px solid ${c.status === 'available' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE, whiteSpace: 'nowrap', color: T.textMuted }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'right' }}>
                      {c.status === 'available' && (
                        <button
                          onClick={() => handleDeleteCode(c.id)}
                          disabled={deletingCodeId === c.id}
                          title="Delete this code"
                          style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
                        >
                          {deletingCodeId === c.id ? '…' : <Trash2 size={12} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* pagination */}
        {codesData && codesData.count > 50 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem' }}>
            <button
              disabled={codesPage <= 1}
              onClick={() => setCodesPage(p => p - 1)}
              style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: T.textSub, cursor: codesPage > 1 ? 'pointer' : 'not-allowed', opacity: codesPage <= 1 ? 0.4 : 1 }}
            >←</button>
            <span style={{ fontSize: '0.8rem', color: T.textMuted }}>
              Page {codesPage} · {codesData.count} results
            </span>
            <button
              disabled={codesPage * 50 >= codesData.count}
              onClick={() => setCodesPage(p => p + 1)}
              style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: T.textSub, cursor: codesPage * 50 < codesData.count ? 'pointer' : 'not-allowed', opacity: codesPage * 50 >= codesData.count ? 0.4 : 1 }}
            >→</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: T.textMuted }}>
            {codesData?.total > 0 && `${codesData.available} available · ${codesData.sold} sold`}
          </span>
          <button className="btn-secondary" onClick={closeModal}>Close</button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={modal === 'delete'} onClose={closeModal} onConfirm={handleDelete}
        title="Delete Product" confirmText="Delete" loading={loading}
        message={`Delete "${selected?.name}"? This cannot be undone and will remove all associated codes.`}
      />
    </PageShell>
  )
}

/* ── style constants ──────────────────────────────────────────────────── */
const PLATFORM_LABELS = {
  steam: 'Steam', epic: 'Epic Games', gog: 'GOG', xbox: 'Xbox',
  psn: 'PlayStation', battlenet: 'Battle.net', ubisoft: 'Ubisoft Connect', ea: 'EA App', other: 'Other',
}
const LBL      = { display: 'block', color: '#B3A4D4', fontSize: '0.8125rem', marginBottom: '0.375rem', fontWeight: 500 }
const INP      = { width: '100%', boxSizing: 'border-box' }
const STOCK_BTN = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.375rem', border: '1px solid', background: 'transparent', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, lineHeight: 1, padding: 0, transition: 'all 0.15s' }
const TH       = { padding: '10px 14px', textAlign: 'left', fontFamily: "'JetBrains Mono',monospace", fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A6A9E', borderBottom: '1px solid rgba(139,79,219,0.18)', whiteSpace: 'nowrap' }
const TD       = { padding: '10px 14px', fontSize: '0.8125rem', color: '#B3A4D4', borderBottom: '1px solid rgba(139,79,219,0.10)', verticalAlign: 'middle' }
const ICON_BTN = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: '1px solid rgba(139,79,219,0.25)', background: 'rgba(139,79,219,0.08)', cursor: 'pointer', color: '#B57BFF', transition: 'all 0.15s', padding: 0 }



