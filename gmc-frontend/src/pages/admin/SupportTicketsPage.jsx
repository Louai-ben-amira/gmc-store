import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminSupportTickets, getSupportTicket, sendSupportTicketMessage, setSupportTicketStatus, deleteSupportTicket } from '../../api/tickets'
import { useToast } from '../../hooks/useToast'
import { formatDate } from '../../utils/formatters'
import TicketThread from '../../components/TicketThread'
import { PageShell, PageHeader, FilterTabs, StatusPill, DataTable, TD_STYLE, QuickActionButton, T } from '../../components/admin/AdminUI'
import { ConfirmModal } from '../../components/Modal'
import { ArrowLeft } from 'lucide-react'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]
const CATEGORY_TABS = [
  { value: '', label: 'All categories' },
  { value: 'account', label: 'Account' },
  { value: 'payment', label: 'Payment' },
  { value: 'bug', label: 'Bug' },
  { value: 'refund', label: 'Refund' },
  { value: 'other', label: 'Other' },
]

export default function SupportTicketsPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const params = {}
  if (status) params.status = status
  if (category) params.category = category

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-support-tickets', status, category],
    queryFn: () => getAdminSupportTickets(params).then(r => r.data?.results || r.data || []),
  })
  const tickets = data || []

  const { data: ticketDetail, isFetching: fetchingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['admin-support-ticket-detail', selectedId],
    queryFn: () => getSupportTicket(selectedId).then(r => r.data),
    enabled: !!selectedId,
    refetchInterval: 3000,
  })

  const handleSendMessage = async ({ body, attachment }) => {
    await sendSupportTicketMessage(selectedId, { body, attachment })
    refetchDetail()
  }

  const handleSetStatus = async (newStatus) => {
    try {
      await setSupportTicketStatus(selectedId, newStatus)
      toast.success(`Ticket marked ${newStatus.replace('_', ' ')}`)
      refetchDetail()
      qc.invalidateQueries({ queryKey: ['admin-support-tickets'] })
      qc.invalidateQueries({ queryKey: ['admin-badge-counts'] })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSupportTicket(deleteTarget)
      toast.success('Ticket deleted.')
      if (selectedId === deleteTarget) setSelectedId(null)
      qc.invalidateQueries({ queryKey: ['admin-support-tickets'] })
      qc.invalidateQueries({ queryKey: ['admin-badge-counts'] })
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not delete ticket.')
    } finally {
      setDeleting(false)
    }
  }

  if (selectedId) {
    return (
      <PageShell>
        <button onClick={() => setSelectedId(null)} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
          background: 'none', border: 'none', cursor: 'pointer', color: T.purpleText, fontSize: '0.8125rem',
        }}>
          <ArrowLeft size={14} /> Back to tickets
        </button>

        {ticketDetail && (
          <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ margin: 0, color: T.textPrimary, fontWeight: 700, fontSize: '0.9375rem' }}>{ticketDetail.subject}</p>
              <p style={{ margin: '2px 0 0', color: T.textMuted, fontSize: '0.75rem' }}>
                {ticketDetail.user_username} · {ticketDetail.category} · {formatDate(ticketDetail.created_at)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <QuickActionButton onClick={() => handleSetStatus('in_progress')}>Mark In Progress</QuickActionButton>
              <QuickActionButton onClick={() => handleSetStatus('resolved')} primary>Resolve</QuickActionButton>
              <QuickActionButton onClick={() => handleSetStatus('closed')} danger>Close</QuickActionButton>
              <QuickActionButton onClick={() => setDeleteTarget(selectedId)} danger>Delete</QuickActionButton>
            </div>
          </div>
        )}

        {ticketDetail ? (
          <TicketThread
            ticket={ticketDetail}
            messages={ticketDetail.messages || []}
            onSendMessage={handleSendMessage}
            onRefresh={() => refetchDetail()}
            isRefreshing={fetchingDetail}
            isAdmin
          />
        ) : (
          <p style={{ color: T.textMuted }}>Loading…</p>
        )}

        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Ticket"
          confirmText="Delete"
          danger
          loading={deleting}
          message="Delete this support ticket? This will permanently remove the ticket and all its messages. This cannot be undone."
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Support Tickets" onRefresh={refetch} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <FilterTabs tabs={STATUS_TABS} value={status} onChange={setStatus} />
        <FilterTabs tabs={CATEGORY_TABS} value={category} onChange={setCategory} />
      </div>
      <DataTable
        headers={['Ticket #', 'Category', 'Subject', 'Client', 'Status', 'Last Message', 'Created', 'Actions']}
        loading={isLoading}
        empty="No support tickets."
      >
        {tickets.map(t => (
          <tr key={t.id}>
            <td style={TD_STYLE}>#{t.id}</td>
            <td style={{ ...TD_STYLE, textTransform: 'capitalize' }}>{t.category}</td>
            <td style={TD_STYLE}>{t.subject}</td>
            <td style={TD_STYLE}>{t.user_username}</td>
            <td style={TD_STYLE}><StatusPill status={t.status} /></td>
            <td style={{ ...TD_STYLE, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last_message?.body || '-'}</td>
            <td style={TD_STYLE}>{formatDate(t.created_at)}</td>
            <td style={TD_STYLE}>
              <div style={{ display: 'flex', gap: 6 }}>
                <QuickActionButton onClick={() => setSelectedId(t.id)}>View</QuickActionButton>
                <QuickActionButton onClick={() => setDeleteTarget(t.id)} danger>Delete</QuickActionButton>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Ticket"
        confirmText="Delete"
        danger
        loading={deleting}
        message="Delete this support ticket? This will permanently remove the ticket and all its messages. This cannot be undone."
      />
    </PageShell>
  )
}
