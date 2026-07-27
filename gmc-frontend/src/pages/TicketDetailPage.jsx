import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getOrderTicket, sendOrderTicketMessage,
  getSupportTicket, sendSupportTicketMessage,
} from '../api/tickets'
import Topbar from '../components/Topbar'
import TicketThread from '../components/TicketThread'
import { TbArrowLeft } from 'react-icons/tb'

/**
 * Shared detail page for both /support/order/:id and /support/general/:id.
 * The ticket "type" is inferred from the route path.
 */
export default function TicketDetailPage() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isOrderTicket = pathname.startsWith('/support/order/')

  const queryKey = [isOrderTicket ? 'order-ticket' : 'support-ticket', id]
  const { data: ticket, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => (isOrderTicket ? getOrderTicket(id) : getSupportTicket(id)).then(r => r.data),
    refetchInterval: 30000,
  })

  const handleSendMessage = async ({ body, attachment }) => {
    if (isOrderTicket) await sendOrderTicketMessage(id, { body, attachment })
    else await sendSupportTicketMessage(id, { body, attachment })
    qc.invalidateQueries({ queryKey })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />
      <div className="pb-nav" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: '1.5rem 1.5rem 2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => navigate('/support')} style={{
            display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 14,
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem',
          }}>
            <TbArrowLeft size={15} /> Back to Support
          </button>

          {isOrderTicket && ticket && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 14 }}>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Order #{ticket.order} - {ticket.product_name || 'Product'}
              </p>
              <p style={{ margin: '2px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Amount paid: {ticket.order_amount_paid ? `${ticket.order_amount_paid} DT` : '-'}
              </p>
            </div>
          )}

          {ticket ? (
            <TicketThread
              ticket={ticket}
              messages={ticket.messages || []}
              onSendMessage={handleSendMessage}
              onRefresh={() => refetch()}
              isRefreshing={isFetching}
              isAdmin={false}
            />
          ) : (
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>Loading ticket…</p>
          )}
        </div>
      </div>
    </div>
  )
}
