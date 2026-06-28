import api from './index'

// -- Client ------------------------------------------------------------------
export const getConversation  = ()       => api.get('/chat/conversation/')
export const getMessages      = (params) => api.get('/chat/messages/', { params })
export const sendMessage      = (data)   => api.post('/chat/messages/', data, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
export const markMessagesRead = (data)   => api.patch('/chat/messages/read/', data)

// -- Admin -------------------------------------------------------------------
export const getAdminConversations = ()               => api.get('/admin/conversations/')
export const getAdminMessages      = (conversationId) =>
  api.get('/chat/messages/', { params: { conversation_id: conversationId } })
export const sendAdminMessage      = (data)           => api.post('/chat/messages/', data, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
export const markAdminMessagesRead = (conversationId) =>
  api.patch('/chat/messages/read/', { conversation_id: conversationId })

// -- Canned Responses (admin) ------------------------------------------------
export const getCannedResponses  = ()         => api.get('/chat/canned/')
export const createCannedResponse = (data)   => api.post('/chat/canned/', data)
export const updateCannedResponse = (id, data) => api.patch(`/chat/canned/${id}/`, data)
export const deleteCannedResponse = (id)      => api.delete(`/chat/canned/${id}/`)
export const useCannedResponse    = (id)      => api.post(`/chat/canned/${id}/use/`)

// -- Order Context Panel (admin) ---------------------------------------------
export const getUserContext = (userId) => api.get(`/chat/context/${userId}/`)
