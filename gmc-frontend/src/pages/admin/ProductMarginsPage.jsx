import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminMargins, updateProduct, updateVariant } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { PageShell, PageHeader, TH_STYLE, TD_STYLE, T } from '../../components/admin/AdminUI'

/* ── margin color coding, shared threshold convention across admin ── */
function marginColor(pct) {
  if (pct == null) return T.textMuted
  if (pct < 10) return '#ef4444'
  if (pct < 25) return '#F5A623'
  return '#3DDC84'
}

function fmtMargin(pct) {
  return pct == null ? '—' : `${Number(pct).toFixed(1)}%`
}

function fmtMoney(v) {
  return v == null ? '—' : `${parseFloat(v).toFixed(2)} DT`
}

/* ── one editable cost-price cell + save button ── */
function CostCell({ productId, variantId, initialCost, missingCost, onSaved }) {
  const [value, setValue]     = useState(initialCost ?? '')
  const [saving, setSaving]   = useState(false)
  const toast = useToast()
  const qc = useQueryClient()

  const dirty = String(value) !== String(initialCost ?? '')

  async function save() {
    if (value === '' || isNaN(Number(value))) {
      toast.error('Enter a valid cost price.')
      return
    }
    setSaving(true)
    try {
      if (variantId) {
        await updateVariant(productId, variantId, { cost_price: value })
      } else {
        const fd = new FormData()
        fd.append('cost_price', value)
        await updateProduct(productId, fd)
      }
      qc.invalidateQueries({ queryKey: ['admin-margins'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success('Cost price saved.')
      onSaved?.()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not save cost price.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="—"
        style={{
          width: 90, padding: '6px 8px', borderRadius: 6,
          background: T.bgInput, border: `1px solid ${missingCost ? 'rgba(239,68,68,0.4)' : T.border}`,
          color: T.textPrimary, fontSize: '0.8125rem', outline: 'none',
          fontFamily: T.mono,
        }}
      />
      <button
        onClick={save}
        disabled={saving || !dirty}
        style={{
          padding: '6px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
          background: dirty ? 'linear-gradient(135deg,#6D28D9,#9B4FED)' : T.bgPanel,
          border: dirty ? 'none' : `1px solid ${T.border}`,
          color: dirty ? '#fff' : T.textMuted,
          cursor: (saving || !dirty) ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? '…' : 'Save'}
      </button>
    </div>
  )
}

export default function ProductMarginsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-margins'],
    queryFn: () => getAdminMargins().then(r => r.data),
  })

  const products = data || []

  return (
    <PageShell>
      <PageHeader
        title="Bulk Cost Setup"
        subtitle="Fill in cost prices for every product/variant to unlock accurate profit tracking"
      />

      <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', overflow: 'hidden', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Product', 'Category', 'Selling Price', 'Cost Price', 'Margin %', ''].map(h => (
                <th key={h} style={TH_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>No products found.</td></tr>
            ) : products.map(p => {
              if (!p.has_variants) {
                return (
                  <tr key={p.id} style={p.missing_cost ? { background: 'rgba(239,68,68,0.06)', boxShadow: 'inset 3px 0 0 rgba(239,68,68,0.5)' } : {}}>
                    <td style={{ ...TD_STYLE, color: T.textPrimary, fontWeight: 500 }}>{p.name}</td>
                    <td style={TD_STYLE}>{p.category}</td>
                    <td style={{ ...TD_STYLE, fontFamily: T.mono }}>{fmtMoney(p.price)}</td>
                    <td style={TD_STYLE}>
                      <CostCell productId={p.id} initialCost={p.cost_price} missingCost={p.missing_cost} />
                    </td>
                    <td style={{ ...TD_STYLE, fontFamily: T.mono, fontWeight: 700, color: marginColor(p.margin_pct) }}>
                      {fmtMargin(p.margin_pct)}
                    </td>
                    <td style={TD_STYLE}>
                      {p.missing_cost && <span style={{ fontSize: '0.6875rem', color: '#ef4444' }}>⚠ missing cost</span>}
                    </td>
                  </tr>
                )
              }
              return p.variants.map((v, i) => (
                <tr key={v.id} style={v.cost_price == null ? { background: 'rgba(239,68,68,0.06)', boxShadow: 'inset 3px 0 0 rgba(239,68,68,0.5)' } : {}}>
                  <td style={{ ...TD_STYLE, color: T.textPrimary, fontWeight: 500 }}>
                    {i === 0 && <div style={{ marginBottom: 4 }}>{p.name}</div>}
                    <div style={{ paddingLeft: 14, color: T.textMuted, fontSize: '0.8125rem' }}>
                      <span style={{ marginRight: 4 }}>└</span>{v.label}
                    </div>
                  </td>
                  <td style={TD_STYLE}>{i === 0 ? p.category : ''}</td>
                  <td style={{ ...TD_STYLE, fontFamily: T.mono }}>{fmtMoney(v.price)}</td>
                  <td style={TD_STYLE}>
                    <CostCell productId={p.id} variantId={v.id} initialCost={v.cost_price} missingCost={v.cost_price == null} />
                  </td>
                  <td style={{ ...TD_STYLE, fontFamily: T.mono, fontWeight: 700, color: marginColor(v.margin_pct) }}>
                    {fmtMargin(v.margin_pct)}
                  </td>
                  <td style={TD_STYLE}>
                    {v.cost_price == null && <span style={{ fontSize: '0.6875rem', color: '#ef4444' }}>⚠ missing cost</span>}
                  </td>
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
