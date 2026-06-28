import api from './index'

// Categories
export const getCategories       = (params) => api.get('/products/categories/', { params })
export const getCategory         = (slug)   => api.get(`/products/categories/${slug}/`)
export const getCategoryProducts = (slug, params) => api.get(`/products/categories/${slug}/products/`, { params })

// Products
export const getProducts  = (params) => api.get('/products/', { params })
export const getProduct   = (id)     => api.get(`/products/${id}/`)

export const getBundles   = (params) => api.get('/products/bundles/', { params })
export const getBundle    = (id)     => api.get(`/products/bundles/${id}/`)

export const getReviews           = (productId)       => api.get(`/products/${productId}/reviews/`)
export const submitReview         = (productId, data) => api.post(`/products/${productId}/reviews/submit/`, data)
export const getReviewEligibility = (productId)       => api.get(`/products/${productId}/reviews/eligibility/`)

export const getRecommendations = ()   => api.get('/products/recommendations/')
export const getBestSellers     = ()   => api.get('/products/best-sellers/')
export const getWishlist        = ()   => api.get('/products/wishlist/')
export const toggleWishlist     = (id) => api.post(`/products/${id}/wishlist/`)
