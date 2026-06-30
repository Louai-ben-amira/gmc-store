import api from './index'

export const getOrders        = (params) => api.get('/orders/', { params })
export const getOrder         = (id)     => api.get(`/orders/${id}/`)
export const placeOrder       = (data)   => api.post('/orders/', data)
export const validatePromo    = (data)   => api.post('/orders/validate-promo/', data)
export const reorder          = (id)     => api.post(`/orders/${id}/reorder/`)
export const updateServiceStatus = (id, data) => api.patch(`/orders/${id}/service-status/`, data)
export const confirmDelivery  = (id)     => api.post(`/orders/${id}/confirm/`)
export const openDispute      = (id, data) => api.post(`/orders/${id}/dispute/`, data)
export const revealCredentials = (id)   => api.get(`/orders/${id}/credentials/`)
export const revealCode        = (id)   => api.post(`/orders/${id}/reveal-code/`)
export const cancelOrder       = (id)   => api.post(`/orders/${id}/cancel/`)
