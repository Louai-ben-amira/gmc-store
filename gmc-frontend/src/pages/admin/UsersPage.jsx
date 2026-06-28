import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminUsers, updateAdminUser } from '../../api/admin'
import Modal from '../../components/Modal'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { Search, Edit2, CheckCircle, XCircle } from 'lucide-react'
import { PageShell, PageHeader, StatusPill, IconBtn, TH_STYLE, TD_STYLE, T } from '../../components/admin/AdminUI'

export default function UsersPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const [balance,  setBalance]  = useState('')
  const [loading,  setLoading]  = useState(false)

  const { data } = useQuery({
    queryKey: ['admin-users', search],
    queryFn:  () => getAdminUsers({ search: search || undefined }).then(r => r.data),
  })
  const users = data?.results || data || []

  const openEdit = (u) => {
    setSelected(u)
    setBalance(String(u.balance || '0'))
  }
  const closeEdit = () => { setSelected(null); setBalance('') }

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateAdminUser(selected.id, { balance: parseFloat(balance) })
      toast.success('Balance updated.')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      closeEdit()
    } catch { toast.error('Failed to update.') }
    setLoading(false)
  }

  const toggleActive = async (u) => {
    try {
      await updateAdminUser(u.id, { is_active: !u.is_active })
      toast.success(u.is_active ? 'User deactivated.' : 'User activated.')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    } catch { toast.error('Failed to update.') }
  }

  return (
    <PageShell>
      <PageHeader title="Users" />

      <div style={{ position: 'relative', marginBottom: '1.25rem', maxWidth: '340px' }}>
        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: T.textMuted }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." style={{ paddingLeft: '2.25rem', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, color: T.textPrimary, width: '100%', padding: '8px 12px 8px 2.25rem', outline: 'none', fontSize: '0.875rem' }} />
      </div>

      <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.875rem', overflow: 'hidden', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['#','Username','Email','Balance','Points','Orders','Referral Code','Status','Actions'].map(h => <th key={h} style={TH_STYLE}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.id}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,79,219,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...TD_STYLE, color: T.textMuted }}>#{u.id}</td>
                <td style={{ ...TD_STYLE, color: T.textPrimary, fontWeight: 600 }}>{u.username}</td>
                <td style={TD_STYLE}>{u.email}</td>
                <td style={{ ...TD_STYLE, color: T.success, fontWeight: 600, fontFamily: T.mono }}>{formatCurrency(u.balance)}</td>
                <td style={{ ...TD_STYLE, color: T.purpleText }}>{u.points}</td>
                <td style={TD_STYLE}>{u.orders_count ?? 0}</td>
                <td style={TD_STYLE}>
                  {u.referral_code
                    ? <span style={{ fontFamily: T.mono, fontSize: '0.75rem', color: T.purpleText, background: 'rgba(139,79,219,0.12)', padding: '2px 7px', borderRadius: 5 }}>{u.referral_code}</span>
                    : <span style={{ color: T.textMuted }}>—</span>
                  }
                </td>
                <td style={TD_STYLE}><StatusPill status={u.is_active ? 'active' : 'inactive'} /></td>
                <td style={TD_STYLE}>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <IconBtn onClick={() => openEdit(u)} title="Edit balance"><Edit2 size={14} /></IconBtn>
                    <IconBtn
                      onClick={() => toggleActive(u)}
                      title={u.is_active ? 'Deactivate' : 'Activate'}
                      color={u.is_active ? T.danger : T.success}
                      bg={u.is_active ? T.dangerDim : T.successDim}
                      border={u.is_active ? T.dangerBorder : T.successBorder}
                    >
                      {u.is_active ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!selected} onClose={closeEdit} title={`Edit — ${selected?.username}`} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={LBL}>Current Balance</label>
            <p style={{ margin: 0, color: T.textPrimary, fontWeight: 700, fontSize: '1.25rem', fontFamily: T.mono }}>{formatCurrency(selected?.balance)}</p>
          </div>
          <div>
            <label style={LBL}>Set New Balance (DT)</label>
            <input type="number" step="0.01" min="0" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" />
          </div>
          <div style={{ background: 'rgba(139,79,219,0.08)', border: `1px solid ${T.border}`, borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8125rem', color: T.textSub }}>
            Points: <strong style={{ color: T.purpleText }}>{selected?.points}</strong> &nbsp;·&nbsp; Orders: <strong style={{ color: T.textPrimary }}>{selected?.orders_count}</strong>
          </div>
          {selected?.referral_code && (
            <div style={{ background: 'rgba(139,79,219,0.07)', border: `1px solid ${T.border}`, borderRadius: '0.5rem', padding: '0.75rem' }}>
              <p style={{ margin: '0 0 4px', color: T.textMuted, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Referral Code</p>
              <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.purpleText, fontSize: '1rem' }}>{selected.referral_code}</span>
              {selected.referred_by_username && (
                <p style={{ margin: '6px 0 0', color: T.textMuted, fontSize: '0.75rem' }}>Referred by: <strong style={{ color: T.textSub }}>{selected.referred_by_username}</strong></p>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={closeEdit} disabled={loading}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Balance'}</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}

const LBL = { display: 'block', color: '#B3A4D4', fontSize: '0.8125rem', marginBottom: '0.375rem', fontWeight: 500 }


