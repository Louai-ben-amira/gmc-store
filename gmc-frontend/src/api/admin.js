import api from './index'

export const getStats            = ()         => api.get('/admin/stats/')
export const getAdminUsers       = (params)   => api.get('/admin/users/', { params })
export const updateAdminUser     = (id, data) => api.patch(`/admin/users/${id}/`, data)
export const deleteAdminUser     = (id)       => api.delete(`/admin/users/${id}/`)
export const getAdminOrders      = (params)   => api.get('/admin/orders/', { params })
export const markAdminOrdersSeen = ()         => api.post('/admin/orders/seen/')
export const adminCancelOrder    = (id)       => api.post(`/admin/orders/${id}/cancel/`)
export const getAdminRecharges      = (params)   => api.get('/payments/admin/recharges/', { params })
export const approveAdminRecharge   = (id, data) => api.post(`/payments/admin/recharges/${id}/approve/`, data)
export const rejectAdminRecharge    = (id, data) => api.post(`/payments/admin/recharges/${id}/reject/`, data)

// Products (admin CRUD)
export const getProducts    = (params)   => api.get('/products/', { params })
export const createProduct  = (data)     => api.post('/products/', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const updateProduct  = (id, data) => api.patch(`/products/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteProduct  = (id)       => api.delete(`/products/${id}/`)
export const uploadCodes     = (id, data)        => api.post(`/products/${id}/codes/`, data)
export const getCodes        = (id, params)       => api.get(`/products/${id}/codes/`, { params })
export const deleteCode      = (id, codeId)       => api.delete(`/products/${id}/codes/${codeId}/`)
export const syncProductStock = (id)              => api.post(`/products/${id}/sync-stock/`)
export const setProductStock  = (id, stock_count) => api.patch(`/products/${id}/`, { stock_count })

// Product Variants (admin)
export const getVariants    = (productId)           => api.get(`/products/${productId}/variants/`)
export const createVariant  = (productId, data)     => api.post(`/products/${productId}/variants/`, data)
export const updateVariant  = (productId, varId, data) => api.patch(`/products/${productId}/variants/${varId}/`, data)
export const deleteVariant  = (productId, varId)    => api.delete(`/products/${productId}/variants/${varId}/`)

// Bundles (admin CRUD)
export const getBundles     = (params)   => api.get('/products/bundles/', { params })
export const createBundle   = (data)     => api.post('/products/bundles/', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const updateBundle   = (id, data) => api.patch(`/products/bundles/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteBundle   = (id)       => api.delete(`/products/bundles/${id}/`)

// Promo Codes (admin CRUD)
export const getPromoCodes   = (params)   => api.get('/orders/promo-codes/', { params })
export const createPromoCode = (data)     => api.post('/orders/promo-codes/', data)
export const updatePromoCode = (id, data) => api.patch(`/orders/promo-codes/${id}/`, data)
export const deletePromoCode = (id)       => api.delete(`/orders/promo-codes/${id}/`)

// Analytics
export const getAnalytics = () => api.get('/admin/analytics/')

// Flash Sales
export const setFlashSale   = (id, data) => api.patch(`/products/${id}/`, data)
export const clearFlashSale = (id)       => api.patch(`/products/${id}/`, {
  is_flash_sale: false, flash_sale_price: null, flash_sale_end: null,
})

// Categories
export const getCategories    = (params)   => api.get('/products/categories/', { params })
export const createCategory   = (data)     => api.post('/products/categories/', data)
export const updateCategory   = (slug, data) => api.patch(`/products/categories/${slug}/`, data)
export const deleteCategory   = (slug)     => api.delete(`/products/categories/${slug}/`)

// Credentials (admin only)
export const getOrderCredentials  = (orderId)      => api.get(`/orders/${orderId}/credentials/`)
export const updateServiceStatus  = (orderId, data) => api.patch(`/orders/${orderId}/service-status/`, data)

// Crypto payments (admin)
export const getAdminCryptoPayments = (params)    => api.get('/payments/admin/crypto/', { params })
export const adminCryptoAction      = (id, data)  => api.patch(`/payments/admin/crypto/${id}/`, data)

// Public hero slides (no auth required)
export const getPublicHeroSlides = () => api.get('/payments/hero-slides/')

// Site settings
export const getSiteSettings    = ()         => api.get('/payments/settings/')
export const updateSiteSetting  = (id, data) => api.patch(`/payments/settings/${id}/`, data)
export const createSiteSetting  = (data)     => api.post('/payments/settings/', data)
export const uploadHeroImage    = (file)     => {
  const fd = new FormData(); fd.append('image', file)
  return api.post('/payments/settings/upload-hero-image/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
