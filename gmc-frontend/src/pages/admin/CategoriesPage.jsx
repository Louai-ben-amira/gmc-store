import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { PageShell, PageHeader, T } from '../../components/admin/AdminUI'
import { Plus, Edit2, Trash2, ChevronRight, FolderOpen, X, Save, ToggleLeft, ToggleRight } from 'lucide-react'

/* ── Slug generator ───────────────────────────────────────────────────── */
const toSlug = (str) => str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

/* ── Empty form ───────────────────────────────────────────────────────── */
const EMPTY = { name: '', slug: '', icon: '', color: '#7C3AED', parent: '', description: '', is_active: true, order: 0, requires_account: false }

/* ── Category row (recursive) ─────────────────────────────────────────── */
function CategoryRow({ cat, depth = 0, onEdit, onDelete }) {
  const [open, setOpen] = useState(true)
  const hasChildren = cat.children?.length > 0
  const indent = depth * 18

  return (
    <>
      <tr
        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <td style={{ padding: '7px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: indent }}>
            {/* collapse toggle or indent spacer */}
            {hasChildren ? (
              <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
              </button>
            ) : (
              depth > 0
                ? <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.7rem', flexShrink: 0 }}>└</span>
                : <span style={{ width: 17, flexShrink: 0 }} />
            )}

            {/* root category: colored label like picker header */}
            {depth === 0 ? (
              <>
                <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>{cat.icon || '📁'}</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.75rem',
                  color: cat.color || '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>{cat.name}</span>
                <div style={{ flex: 1, height: 1, background: `${cat.color || '#7C3AED'}25`, marginLeft: 4 }} />
              </>
            ) : (
              <>
                <span style={{ fontSize: '0.875rem', lineHeight: 1, flexShrink: 0 }}>{cat.icon || '📦'}</span>
                <span style={{
                  fontFamily: 'Sora, sans-serif',
                  fontWeight: depth === 1 ? 600 : 400,
                  fontSize: depth === 1 ? '0.875rem' : '0.8125rem',
                  color: depth === 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>{cat.name}</span>
                {!cat.is_active && (
                  <span style={{ background: 'rgba(255,77,109,0.15)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: '0.6rem', color: '#ff4d6d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hidden</span>
                )}
              </>
            )}
          </div>
        </td>

        <td style={{ padding: '7px 14px' }}>
          <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 5, padding: '2px 7px', color: '#A78BFA' }}>
            {cat.slug}
          </code>
        </td>

        <td style={{ padding: '7px 14px', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {hasChildren ? cat.children.length : <span style={{ opacity: 0.3 }}>—</span>}
        </td>

        <td style={{ padding: '7px 14px', textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
            <button onClick={() => onEdit(cat)} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s' }}>
              <Edit2 size={12} /> Edit
            </button>
            <button onClick={() => onDelete(cat)} style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.22)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: '#ff4d6d', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s' }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </td>
      </tr>

      {open && hasChildren && cat.children.map(child => (
        <CategoryRow key={child.id} cat={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  )
}

/* ── Modal ────────────────────────────────────────────────────────────── */
function CategoryModal({ isOpen, onClose, editing, allCategories, onSave }) {
  const [form, setForm] = useState(EMPTY)
  const [slugManual, setSlugManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (editing) {
      setForm({
        name:             editing.name || '',
        slug:             editing.slug || '',
        icon:             editing.icon || '',
        color:            editing.color || '#7C3AED',
        parent:           editing.parent || '',
        description:      editing.description || '',
        is_active:        editing.is_active ?? true,
        order:            editing.order ?? 0,
        requires_account: editing.requires_account ?? false,
      })
      setSlugManual(true)
    } else {
      setForm(EMPTY)
      setSlugManual(false)
    }
  }, [editing, isOpen])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleNameChange = (v) => {
    set('name', v)
    if (!slugManual) set('slug', toSlug(v))
  }

  const handleSlugChange = (v) => {
    setSlugManual(true)
    set('slug', toSlug(v))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return }
    if (!form.slug.trim()) { toast.error('Slug is required.'); return }
    setSaving(true)
    try {
      const payload = {
        name:             form.name.trim(),
        slug:             form.slug.trim(),
        icon:             form.icon.trim(),
        color:            form.color,
        parent:           form.parent || null,
        description:      form.description.trim(),
        is_active:        form.is_active,
        order:            parseInt(form.order) || 0,
        requires_account: form.requires_account,
      }
      if (editing) {
        await updateCategory(editing.slug, payload)
        toast.success('Category updated.')
      } else {
        await createCategory(payload)
        toast.success('Category created.')
      }
      onSave()
      onClose()
    } catch (err) {
      const data = err.response?.data
      const msg = data?.slug?.[0] || data?.name?.[0] || data?.detail || 'Failed to save.'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  const flatCats = []
  const flatten = (cats, depth = 0) => cats.forEach(c => {
    if (!editing || c.id !== editing.id) flatCats.push({ ...c, _depth: depth })
    if (c.children?.length) flatten(c.children, depth + 1)
  })
  flatten(allCategories)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid #2a2a3e', borderRadius: '1rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
            {editing ? 'Edit Category' : 'New Category'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Name + Icon row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Name *</label>
              <input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Steam Europe" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Icon</label>
              <input value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🎮" style={{ textAlign: 'center', fontSize: '1.25rem' }} />
            </div>
          </div>

          {/* Slug */}
          <div>
            <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              Slug * <span style={{ color: '#A78BFA', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(used in URL: /?cat=<strong>{form.slug || '...'}</strong>)</span>
            </label>
            <input
              value={form.slug}
              onChange={e => handleSlugChange(e.target.value)}
              placeholder="e.g. steam-europe"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: '#A78BFA' }}
            />
            <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Lowercase letters, numbers and dashes only. Must match the dropdown link exactly.
            </p>
          </div>

          {/* Parent */}
          <div>
            <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Parent Category</label>
            <select value={form.parent || ''} onChange={e => set('parent', e.target.value ? parseInt(e.target.value) : '')} style={{ width: '100%' }}>
              <option value="">— No parent (top level) —</option>
              {flatCats.map(c => (
                <option key={c.id} value={c.id}>{'  '.repeat(c._depth)}{c._depth > 0 ? '└ ' : ''}{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Color + Order row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 40, height: 36, padding: 2, cursor: 'pointer', borderRadius: 6 }} />
                <input value={form.color} onChange={e => set('color', e.target.value)} style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Order</label>
              <input type="number" value={form.order} onChange={e => set('order', e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Description</label>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description..." style={{ resize: 'vertical' }} />
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => set('is_active', !form.is_active)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, color: form.is_active ? '#3DDC84' : 'var(--text-muted)', transition: 'color 0.15s' }}>
              {form.is_active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600 }}>Visible in store</span>
            </button>
            <button type="button" onClick={() => set('requires_account', !form.requires_account)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, color: form.requires_account ? '#f59e0b' : 'var(--text-muted)', transition: 'color 0.15s' }}>
              {form.requires_account ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600 }}>Requires account</span>
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '0.625rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '0.625rem', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#9B4FED)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'Sora, sans-serif', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
              <Save size={14} /> {saving ? 'Saving…' : editing ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */
export default function CategoriesPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => getCategories({ parent: 'root' }).then(r => Array.isArray(r.data) ? r.data : r.data.results || []),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-categories'] })

  const handleEdit = (cat) => { setEditing(cat); setModalOpen(true) }
  const handleNew  = ()    => { setEditing(null); setModalOpen(true) }

  const handleDelete = async (cat) => {
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return
    try {
      await deleteCategory(cat.slug)
      toast.success(`"${cat.name}" deleted.`)
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed - category may have products.')
    }
  }

  /* Flat list for search */
  const flatAll = []
  const flatten = (cats) => cats.forEach(c => { flatAll.push(c); if (c.children?.length) flatten(c.children) })
  flatten(categories)

  const filtered = search.trim()
    ? flatAll.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase()))
    : null

  const totalCount = flatAll.length

  return (
    <PageShell>
      <PageHeader
        title="Categories"
        subtitle={`${totalCount} categories total`}
        icon={FolderOpen}
        actions={<button onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5625rem 1.125rem', background: 'linear-gradient(135deg,#6D28D9,#9B4FED)', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}><Plus size={14} /> New Category</button>}
      />

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or slug…"
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* Slug quick-reference */}
      <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#A78BFA', lineHeight: 1.6 }}>
          💡 The <strong>Slug</strong> connects the category to the dropdown menu. It must match exactly the <code style={{ background: 'rgba(124,58,237,0.15)', borderRadius: 4, padding: '1px 6px', fontFamily: 'JetBrains Mono, monospace' }}>/?cat=</code> value in the navigation links.
        </p>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {['Category Name', 'Slug', 'Sub-categories', 'Actions'].map((h, i) => (
                <th key={h} style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i === 3 ? 'right' : i === 2 ? 'center' : 'left', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>Loading…</td></tr>
            ) : filtered ? (
              filtered.length === 0
                ? <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>No categories found.</td></tr>
                : filtered.map(c => <CategoryRow key={c.id} cat={c} onEdit={handleEdit} onDelete={handleDelete} />)
            ) : (
              categories.map(c => (
                <CategoryRow key={c.id} cat={c} onEdit={handleEdit} onDelete={handleDelete} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <CategoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        allCategories={categories}
        onSave={refresh}
      />
    </PageShell>
  )
}
