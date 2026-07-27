import api from './index'

export const getNotifications     = ()     => api.get('/notifications/')
export const getUnreadCount       = ()     => api.get('/notifications/unread-count/')
export const markNotificationRead = (id)   => api.post(`/notifications/${id}/read/`)
export const markAllNotificationsRead = () => api.post('/notifications/read-all/')
