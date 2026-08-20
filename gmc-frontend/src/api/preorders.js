import api from './index'

// ── Client ────────────────────────────────────────────────────────────────
export const getPreOrders   = (params) => api.get('/preorders/', { params })
export const placePreOrder  = (data)   => api.post('/preorders/', data)
export const cancelPreOrder = (id)     => api.post(`/preorders/${id}/cancel/`)

// ── Admin ─────────────────────────────────────────────────────────────────
export const getAdminPreOrders       = (params)     => api.get('/admin/preorders/', { params })
export const getPreOrderProducts     = ()           => api.get('/admin/preorders/products/')
export const getPreOrderQueue        = (productId)  => api.get(`/admin/preorders/by-product/${productId}/`)
export const deliverPreOrder         = (id, code)   => api.post(`/admin/preorders/${id}/deliver/`, { code })
export const skipPreOrder            = (id, status) => api.post(`/admin/preorders/${id}/skip/`, { status })
export const requeuePreOrder         = (id)         => api.post(`/admin/preorders/${id}/requeue/`)
export const autoFulfillPreOrders    = (productId)  => api.post(`/admin/preorders/auto-fulfill/${productId}/`)
