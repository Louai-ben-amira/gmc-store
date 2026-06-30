import api from './index'

export const getWallet           = ()       => api.get('/wallet/')
export const getTransactions     = (params) => api.get('/wallet/transactions/', { params })

// Recharge - new ticket/D17 flow
export const getPaymentMethods   = ()       => api.get('/payments/payment-methods/')
export const previewRecharge     = (data)   => api.post('/payments/recharge/preview/', data)
export const submitRecharge      = (data)   => api.post('/payments/recharge/', data, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 60000,
})

// Crypto payments
export const initiateCrypto      = (data)   => api.post('/payments/crypto/', data)
export const getCryptoQR         = (id)     => api.get(`/payments/crypto/${id}/qr/`)
export const submitTxHash        = (id, data) => api.patch(`/payments/crypto/${id}/tx/`, data)
export const getMyCryptoPayments = ()       => api.get('/payments/crypto/mine/')
export const redeemGiftCard      = (data)   => api.post('/wallet/redeem/', data)
