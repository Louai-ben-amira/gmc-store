const BACKEND = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '')

// Ensure media URLs point to the backend, not the Vite dev server
export const mediaUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${BACKEND}${url.startsWith('/') ? '' : '/'}${url}`
}

export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

export const formatCurrency = (amount) => {
  return `${parseFloat(amount || 0).toFixed(2)} DT`
}

export const CATEGORY_LABELS = {
  gift_cards: 'Gift Cards',
  valorant: 'Valorant',
  steam: 'Steam',
  epic: 'Epic Games',
  battle_pass: 'Battle Pass',
  ooredoo: 'Ooredoo',
  other: 'Other',
}

export const CATEGORY_COLORS = {
  gift_cards: 'badge-purple',
  valorant: 'badge-teal',
  steam: 'badge-purple',
  epic: 'badge-teal',
  battle_pass: 'badge-purple',
  ooredoo: 'badge-teal',
  other: 'badge-purple',
}
