import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminOrderTickets, getOrderTicket, sendOrderTicketMessage, setOrderTicketStatus } from '../../api/tickets'
import { useToast } from '../../hooks/useToast'
import { formatDate, formatCurrency } from '../../utils/formatters'
import TicketThread from '../../components/TicketThread'
import { PageShell, PageHeader, FilterTabs, StatusPill, DataTable, TD_STYLE, QuickActionButton, T } from '../../components/admin/AdminUI'
import { ArrowLeft } from 'lucide-react'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export default function OrderTicketsPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-order-tickets', status],
    queryFn: () => getAdminOrderTickets(status ? { status } : {}).then(r => r.data?.results || r.data || []),
  })
  const tickets = data || []

  const { data: ticketDetail, isFetching: fetchingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['admin-order-ticket-detail', selectedId],
    queryFn: () => getOrderTicket(selectedId).then(r => r.data),
    enabled: !!selectedId,
    refetchInterval: 30000,
  })

  const handleSendMessage = async ({ body, attachment }) => {
    await sendOrderTicketMessage(selectedId, { body, attachment })
    refetchDetail()
  }

  const handleSetStatus = async (newStatus) => {
    try {
      await setOrderTicketStatus(selectedId, newStatus)
      toast.success(`Ticket marked ${newStatus.replace('_', ' ')}`)
      refetchDetail()
      qc.invalidateQueries({ queryKey: ['admin-order-tickets'] })
      qc.invalidateQueries({ queryKey: ['admin-badge-counts'] })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not update status.')
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
              <p style={{ margin: 0, color: T.textPrimary, fontWeight: 700, fontSize: '0.9375rem' }}>
                Order #{ticketDetail.order} — {ticketDetail.product_name || 'Product'}
              </p>
              <p style={{ margin: '2px 0 0', color: T.textMuted, fontSize: '0.75rem' }}>
                {ticketDetail.user_username} · {formatCurrency(ticketDetail.order_amount_paid || 0)} · {formatDate(ticketDetail.created_at)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <QuickActionButton onClick={() => handleSetStatus('in_progress')}>Mark In Progress</QuickActionButton>
              <QuickActionButton onClick={() => handleSetStatus('resolved')} primary>Resolve</QuickActionButton>
              <QuickActionButton onClick={() => handleSetStatus('closed')} danger>Close</QuickActionButton>
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
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Order Tickets" onRefresh={refetch} />
      <FilterTabs tabs={STATUS_TABS} value={status} onChange={setStatus} style={{ marginBottom: 16 }} />
      <DataTable
        headers={['Ticket #', 'Order #', 'Product', 'Client', 'Status', 'Last Message', 'Created', 'Actions']}
        loading={isLoading}
        empty="No order tickets."
      >
        {tickets.map(t => (
          <tr key={t.id}>
            <td style={TD_STYLE}>#{t.id}</td>
            <td style={TD_STYLE}>#{t.order}</td>
            <td style={TD_STYLE}>{t.product_name || '-'}</td>
            <td style={TD_STYLE}>{t.user_username}</td>
            <td style={TD_STYLE}><StatusPill status={t.status} /></td>
            <td style={{ ...TD_STYLE, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last_message?.body || '-'}</td>
            <td style={TD_STYLE}>{formatDate(t.created_at)}</td>
            <td style={TD_STYLE}>
              <QuickActionButton onClick={() => setSelectedId(t.id)}>View</QuickActionButton>
            </td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  )
}
