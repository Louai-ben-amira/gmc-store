import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, X } from 'lucide-react'
import {
  getNotifications, markAllNotificationsRead, deleteNotification,
} from '../api/notifications'

/* One emoji per event type — announcements read as broadcasts, everything
   else as something that happened to you personally. */
const TYPE_ICON = {
  order_complete:     '✅',
  recharge_approved:  '💰',
  recharge_rejected:  '❌',
  ticket_reply:       '💬',
  referral_bonus:     '🎁',
  tier_upgrade:       '⭐',
  flash_sale:         '🔥',
  preorder_fulfilled: '🎉',
  preorder_failed:    '⚠️',
  announcement:       '📢',
  // Types outside the headline set, still sent by live code
  wishlist_price_drop: '📉',
  preorder_placed:     '📋',
  preorder_reminder:   '⏰',
}
const getNotifIcon = (type) => TYPE_ICON[type] || '🔔'

/* Store-wide announcements get an amber identity so they never read as
   "something happened to my account". */
const ANNOUNCEMENT_BG     = 'rgba(255,200,77,0.07)'
const ANNOUNCEMENT_BORDER = '#FFC84D'

export default function NotificationBell({ isAuthenticated }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Single endpoint returns the feed and the badge count together, so one
  // poll keeps both in sync.
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then(r => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })
  const notifications = data?.notifications || []
  const unread        = data?.unread_count || 0

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isAuthenticated) return null

  /* Opening the dropdown IS the read receipt — clear the badge optimistically
     and let the request settle in the background. */
  const markEverythingRead = () => {
    qc.setQueryData(['notifications'], (old) => old && ({
      ...old,
      unread_count: 0,
      notifications: old.notifications.map(n => ({ ...n, is_read: true })),
    }))
    markAllNotificationsRead().catch(() => {})
  }

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) markEverythingRead()
  }

  const handleItemClick = (n) => {
    setOpen(false)
    if (n.link && n.link !== '/') navigate(n.link)
  }

  const handleDelete = (e, n) => {
    e.stopPropagation()
    qc.setQueryData(['notifications'], (old) => old && ({
      ...old,
      unread_count: n.is_read ? old.unread_count : Math.max(0, old.unread_count - 1),
      notifications: old.notifications.filter(x => x.id !== n.id),
    }))
    deleteNotification(n.id).catch(() => {})
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        title="Notifications"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: open ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.09)'}`,
          cursor: 'pointer', color: open ? 'white' : 'var(--text-secondary)', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)' }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' } }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 3px',
            borderRadius: 999, background: '#ef4444', color: '#fff',
            fontSize: '0.75rem', fontWeight: 700, lineHeight: '16px', textAlign: 'center',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'var(--bg-surface)',
          border: '1px solid rgba(124,58,237,0.25)', borderTop: '2px solid #7C3AED',
          borderRadius: 14, width: 340, maxWidth: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden', zIndex: 9999, animation: 'navDropIn 0.18s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #2A2A38' }}>
            <span style={{ color: '#F0EEE6', fontWeight: 600, fontSize: '0.875rem' }}>Notifications</span>
            {notifications.some(n => !n.is_read) && (
              <button
                onClick={(e) => { e.stopPropagation(); markEverythingRead() }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#7C3AED', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '2.5rem 1rem' }}>
                <Bell size={28} style={{ color: '#6B6960', opacity: 0.4 }} />
                <p style={{ margin: 0, color: '#9E9C94', fontSize: '0.8125rem' }}>No notifications yet.</p>
              </div>
            )}

            {notifications.map(n => {
              const isAnnouncement = n.type === 'announcement'
              const restingBg = isAnnouncement
                ? ANNOUNCEMENT_BG
                : (n.is_read ? 'transparent' : 'rgba(124,58,237,0.06)')
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleItemClick(n) }}
                  style={{
                    display: 'flex', gap: '0.625rem', width: '100%', textAlign: 'left', boxSizing: 'border-box',
                    padding: '0.75rem 1rem', background: restingBg,
                    border: 'none', borderBottom: '1px solid #232330',
                    borderLeft: isAnnouncement ? `2px solid ${ANNOUNCEMENT_BORDER}` : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0F0F13'}
                  onMouseLeave={(e) => e.currentTarget.style.background = restingBg}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: isAnnouncement ? 'rgba(255,200,77,0.12)' : 'rgba(124,58,237,0.12)',
                    border: `1px solid ${isAnnouncement ? 'rgba(255,200,77,0.3)' : 'rgba(124,58,237,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1,
                  }}>
                    {getNotifIcon(n.type)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ margin: 0, color: '#F0EEE6', fontWeight: n.is_read ? 500 : 700, fontSize: '0.8125rem', flex: 1, minWidth: 0 }}>{n.title}</p>
                      {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: isAnnouncement ? ANNOUNCEMENT_BORDER : '#7C3AED', flexShrink: 0 }} />}
                      <button
                        onClick={(e) => handleDelete(e, n)}
                        title="Delete notification"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 18, height: 18, padding: 0, borderRadius: 5, flexShrink: 0,
                          background: 'transparent', border: 'none', color: '#6B6960', cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#ef4444' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B6960' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <p style={{ margin: '2px 0 0', color: '#9E9C94', fontSize: '0.75rem', lineHeight: 1.4 }}>{n.body}</p>
                    {/* time_ago comes from the server, already in the reader's language */}
                    <p style={{ margin: '4px 0 0', color: '#6B6960', fontSize: '0.6875rem' }}>{n.time_ago}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
