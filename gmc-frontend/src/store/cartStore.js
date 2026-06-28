import { create } from 'zustand'

const useCartStore = create((set) => ({
  pendingProduct: null,
  pointsToUse: 0,

  setPendingProduct: (product) => set({ pendingProduct: product, pointsToUse: 0 }),
  setPointsToUse: (points) => set({ pointsToUse: points }),
  clear: () => set({ pendingProduct: null, pointsToUse: 0 }),
}))

export default useCartStore
