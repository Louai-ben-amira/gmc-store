import api from './index'

export const register = (data) => api.post('/auth/register/', data)
export const login = (data) => api.post('/auth/login/', data)
export const getMe = () => api.get('/auth/me/')
export const updateMe = (data) => api.patch('/auth/me/', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const changePassword    = (data)           => api.post('/auth/change-password/', data)
export const socialAuth        = (provider, token) => api.post('/auth/social/', { provider, token })
export const getReferralStats  = ()               => api.get('/wallet/referral/')
