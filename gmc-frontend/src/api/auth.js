import api from './index'

export const register = (data) => api.post('/auth/register/', data)
export const login = (data) => api.post('/auth/login/', data)
export const getMe = () => api.get('/auth/me/')
export const updateMe = (data) => api.patch('/auth/me/', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const changePassword    = (data)           => api.post('/auth/change-password/', data)
export const forgotPassword    = (email)          => api.post('/auth/forgot-password/', { email })
export const resetPassword     = (data)           => api.post('/auth/reset-password/', data)
export const socialAuth        = (provider, token) => api.post('/auth/social/', { provider, token })
export const getReferralStats  = ()               => api.get('/wallet/referral/')
export const verifyEmailCode   = (email, code)    => api.post('/auth/verify-email/', { email, code })
export const resendVerification = (email)         => api.post('/auth/resend-verification/', { email })
