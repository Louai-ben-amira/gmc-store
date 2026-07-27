import api from './index'

function toFormData(fields) {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, v)
  })
  return fd
}

// -- Order tickets (client) --------------------------------------------------
export const createOrderTicket = (orderId, { subject, description } = {}) =>
  api.post('/tickets/order/', { order: orderId, subject, description })
export const getOrderTickets = () => api.get('/tickets/order/')
export const getOrderTicket  = (id) => api.get(`/tickets/order/${id}/`)
export const sendOrderTicketMessage = (id, { body, attachment }) => {
  if (attachment) {
    return api.post(`/tickets/order/${id}/messages/`, toFormData({ body, attachment }), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
  return api.post(`/tickets/order/${id}/messages/`, { body })
}
export const setOrderTicketStatus = (id, status) => api.patch(`/tickets/order/${id}/status/`, { status })

// -- Support tickets (client) ------------------------------------------------
export const createSupportTicket = ({ category, subject, description, attachment }) => {
  if (attachment) {
    return api.post('/tickets/support/', toFormData({ category, subject, description, attachment }), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
  return api.post('/tickets/support/', { category, subject, description })
}
export const getSupportTickets = () => api.get('/tickets/support/')
export const getSupportTicket  = (id) => api.get(`/tickets/support/${id}/`)
export const sendSupportTicketMessage = (id, { body, attachment }) => {
  if (attachment) {
    return api.post(`/tickets/support/${id}/messages/`, toFormData({ body, attachment }), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
  return api.post(`/tickets/support/${id}/messages/`, { body })
}
export const setSupportTicketStatus = (id, status) => api.patch(`/tickets/support/${id}/status/`, { status })

// -- Admin --------------------------------------------------------------------
export const getAdminOrderTickets   = (params) => api.get('/admin/tickets/order/', { params })
export const getAdminSupportTickets = (params) => api.get('/admin/tickets/support/', { params })
