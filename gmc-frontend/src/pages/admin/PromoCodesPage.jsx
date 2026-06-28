import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPromoCodes, createPromoCode, updatePromoCode, deletePromoCode } from '../../api/admin'
import Modal, { ConfirmModal } from '../../components/Modal'
import { useToast } from '../../hooks/useToast'
import { Plus, Edit2, Trash2, Tag, Copy, Check, ToggleLeft, ToggleRight } from 'lucide-react'
import { PageShell, PageHeader, QuickActionButton, StatusPill, IconBtn, TH_STYLE, TD_STYLE, T } from '../../components/admin/AdminUI'

const EMPTY_FORM = { code: '', discount_type: 'percent', discount_value: '', max_uses: 0, valid_until: '', is_active: true }

function PromoForm({ form, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={LBL}>Promo Code</label>
        <input
          value={form.code}
          onChange={e => onChange('code', e.target.value.toUpperCase().replace(/\s/g, ''))}
          placeholder="e.g. GMC10, WELCOME"
          style={{ ...INP, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', fontWeight: 700 }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={LBL}>Discount Type</label>
          <select value={form.discount_type} onChange={e => onChange('discount_type', e.target.value)} style={INP}>
            <option value="percent">Percentage (%)</option>
            <option value="fixed">Fixed Amount (DT)</option>
          </select>
        </div>
        <div>
          <label style={LBL}>{form.discount_type === 'percent' ? 'Discount %' : 'Discount (DT)'}</label>
          <input
            type="number" step={form.discount_type === 'percent' ? '1' : '0.01'} min="0"
            max={form.discount_type === 'percent' ? '100' : undefined}
            value={form.discount_value}
            onChange={e => onChange('discount_value', e.target.value)}
            placeholder={form.discount_type === 'percent' ? '10' : '5.00'}
            style={INP}
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={LBL}>Max Uses <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(0 = unlimited)</span></label>
          <input type="number" min="0" value={form.max_uses} onChange={e => onChange('max_uses', parseInt(e.target.value) || 0)} placeholder="0" style={INP} />
        </div>
        <div>
          <label style={LBL}>Valid Until <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
          <input type="datetime-local" value={form.valid_until} onChange={e => onChange('valid_until', e.target.value)} style={INP} />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_active} onChange={e => onChange('is_active', e.target.checked)} />
        <span style={{ color: 'var(--lavender)', fontSize: '0.875rem' }}>Active</span>
      </label>
    </div>
  )
}

function CopyCode({ code }) {
  const [copied, setCopied] = useState(false)
  const copy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--aurora)' : 'var(--muted)', padding: '2px', display: 'flex', transition: 'color 0.15s' }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

export default function PromoCodesPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [modal, setModal]       = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [loading, setLoading]   = useState(false)

  const { data } = useQuery({
    queryKey: ['admin-promo-codes'],
    queryFn: () => getPromoCodes().then(r => r.data),
  })
  const codes = data?.results || data || []

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openCreate = () => { setForm(EMPTY_FORM); setModal('create') }
  const openEdit   = (c) => {
    setSelected(c)
    const validUntilLocal = c.valid_until ? new Date(c.valid_until).toISOString().slice(0, 16) : ''
    setForm({ code: c.code, discount_type: c.discount_type, discount_value: c.discount_value, max_uses: c.max_uses, valid_until: validUntilLocal, is_active: c.is_active })
    setModal('edit')
  }
  const openDelete = (c) => { setSelected(c); setModal('delete') }
  const closeModal = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.code || !form.discount_value) return toast.error('Code and discount value are required.')
    setLoading(true)
    try {
      const payload = {
        code: form.code,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        max_uses: form.max_uses,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        is_active: form.is_active,
      }
      if (modal === 'create') {
        await createPromoCode(payload)
        toast.success('Promo code created.')
      } else {
        await updatePromoCode(selected.id, payload)
        toast.success('Promo code updated.')
      }
      qc.invalidateQueries({ queryKey: ['admin-promo-codes'] })
      closeModal()
    } catch (err) {
      toast.error(err.response?.data?.code?.[0] || 'Something went wrong.')
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deletePromoCode(selected.id)
      toast.success('Promo code deleted.')
      qc.invalidateQueries({ queryKey: ['admin-promo-codes'] })
      closeModal()
    } catch { toast.error('Failed to delete.') }
    setLoading(false)
  }

  const handleToggle = async (c) => {
    try {
      await updatePromoCode(c.id, { is_active: !c.is_active })
      qc.invalidateQueries({ queryKey: ['admin-promo-codes'] })
      toast.success(c.is_active ? 'Code deactivated.' : 'Code activated.')
    } catch { toast.error('Update failed.') }
  }

  const isExpired = (c) => c.valid_until && new Date(c.valid_until) < new Date()
  const isExhausted = (c) => c.max_uses > 0 && c.used_count >= c.max_uses

  return (
    <PageShell>
      <PageHeader
        title="Promo Codes"
        subtitle="Create discount codes for customers"
        actions={<QuickActionButton primary onClick={openCreate}><Plus size={14} /> New Code</QuickActionButton>}
      />

      <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Code', 'Discount', 'Uses', 'Valid Until', 'Status', 'Actions'].map(h => (
                <th key={h} style={TH_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>
                <Tag size={32} style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.15 }} />
                No promo codes yet. Create your first one!
              </td></tr>
            ) : codes.map(c => {
              const expired   = isExpired(c)
              const exhausted = isExhausted(c)
              const active    = c.is_active && !expired && !exhausted
              return (
                <tr key={c.id}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,79,219,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ transition: 'background 0.1s' }}
                >
                  <td style={TD_STYLE}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <code style={{ background: 'rgba(139,79,219,0.12)', border: `1px solid ${T.border}`, color: T.purpleText, fontFamily: T.mono, fontWeight: 700, fontSize: '0.875rem', padding: '3px 10px', borderRadius: '0.375rem' }}>{c.code}</code>
                      <CopyCode code={c.code} />
                    </div>
                  </td>
                  <td style={TD_STYLE}>
                    <span style={{ color: T.success, fontFamily: T.mono, fontWeight: 700 }}>
                      {c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value} DT`}
                    </span>
                    <span style={{ color: T.textMuted, fontSize: '0.6875rem', marginLeft: '6px' }}>{c.discount_type === 'percent' ? 'off' : 'fixed'}</span>
                  </td>
                  <td style={TD_STYLE}>
                    <span style={{ color: exhausted ? T.danger : T.textSub, fontFamily: T.mono, fontSize: '0.875rem' }}>
                      {c.used_count}{c.max_uses > 0 ? ` / ${c.max_uses}` : ' / ∞'}
                    </span>
                  </td>
                  <td style={TD_STYLE}>
                    {c.valid_until ? (
                      <span style={{ color: expired ? T.danger : T.textSub, fontSize: '0.8125rem' }}>
                        {new Date(c.valid_until).toLocaleDateString()}
                        {expired && <span style={{ color: T.danger, fontSize: '0.6875rem', marginLeft: '4px' }}>(expired)</span>}
                      </span>
                    ) : (
                      <span style={{ color: T.textMuted, fontSize: '0.8125rem' }}>No expiry</span>
                    )}
                  </td>
                  <td style={TD_STYLE}>
                    <StatusPill
                      status={active ? 'active' : expired ? 'expired' : exhausted ? 'disabled' : 'inactive'}
                      label={active ? 'Active' : expired ? 'Expired' : exhausted ? 'Used up' : 'Inactive'}
                    />
                  </td>
                  <td style={TD_STYLE}>
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                      <IconBtn onClick={() => handleToggle(c)} title={c.is_active ? 'Deactivate' : 'Activate'} color={c.is_active ? T.success : T.textMuted}>
                        {c.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                      </IconBtn>
                      <IconBtn onClick={() => openEdit(c)} title="Edit"><Edit2 size={13} /></IconBtn>
                      <IconBtn onClick={() => openDelete(c)} title="Delete" color={T.danger} bg={T.dangerDim} border={T.dangerBorder}><Trash2 size={13} /></IconBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={closeModal} title={modal === 'create' ? 'New Promo Code' : 'Edit Promo Code'} size="sm">
        <PromoForm form={form} onChange={setField} />
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={closeModal} disabled={loading}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </Modal>

      <ConfirmModal isOpen={modal === 'delete'} onClose={closeModal} onConfirm={handleDelete}
        title="Delete Promo Code" confirmText="Delete" loading={loading}
        message={`Delete code "${selected?.code}"? This cannot be undone.`}
      />
    </PageShell>
  )
}

const LBL = { display: 'block', color: '#B3A4D4', fontSize: '0.8125rem', marginBottom: '0.375rem', fontWeight: 500 }
const INP = { width: '100%', boxSizing: 'border-box' }

