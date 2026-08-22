import api from './index'

// One call feeds the bell: { unread_count, notifications: [...] }
export const getNotifications         = ()      => api.get('/notifications/')
export const getUnreadCount           = ()      => api.get('/notifications/unread-count/')
export const markNotificationsRead    = (body)  => api.post('/notifications/mark-read/', body)
export const markAllNotificationsRead = ()      => api.post('/notifications/mark-read/', { all: true })
export const markNotificationRead     = (id)    => api.post('/notifications/mark-read/', { ids: [id] })
export const deleteNotification       = (id)    => api.delete(`/notifications/${id}/`)

// Admin broadcast
export const getBroadcastAudience = ()     => api.get('/admin/notifications/broadcast/audience/')
export const sendBroadcast        = (data) => api.post('/admin/notifications/broadcast/', data)
