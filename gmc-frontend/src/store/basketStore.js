import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Derive the effective price/points for a product + optional variant,
// matching ProductPage.jsx's pricing logic.
function priceFor(product, variant) {
  if (variant) return parseFloat(variant.price)
  return parseFloat(product.effective_price ?? product.price ?? 0)
}
function pointsFor(product, variant) {
  if (variant && variant.points_earned != null) return Number(variant.points_earned) || 0
  return Number(product.points_earned) || 0
}

const useBasketStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, variant, qty = 1) => {
        const price        = priceFor(product, variant)
        const points_earned = pointsFor(product, variant)
        const item = {
          id: crypto.randomUUID(),
          product_id: product.id,
          product_name: product.name,
          thumbnail: product.image || null,
          variant_id: variant?.id || null,
          variant_label: variant?.label || null,
          price,
          points_earned,
          requires_account: !!product.requires_account,
          required_fields: product.required_fields || [],
          quantity: Math.max(1, qty),
          credentials: {},
        }
        set((state) => ({ items: [...state.items, item] }))
        return item
      },

      removeItem: (basketItemId) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== basketItemId) }))
      },

      updateQuantity: (basketItemId, qty) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === basketItemId ? { ...i, quantity: Math.max(1, qty) } : i
          ),
        }))
      },

      setCredentials: (basketItemId, data) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === basketItemId ? { ...i, credentials: { ...i.credentials, ...data } } : i
          ),
        }))
      },

      clearBasket: () => set({ items: [] }),
    }),
    { name: 'gmc-basket' }
  )
)

// Derived selectors
export const selectTotalPrice = (state) =>
  state.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
export const selectTotalPoints = (state) =>
  state.items.reduce((sum, i) => sum + i.points_earned * i.quantity, 0)
export const selectItemCount = (state) =>
  state.items.reduce((sum, i) => sum + i.quantity, 0)

export default useBasketStore
