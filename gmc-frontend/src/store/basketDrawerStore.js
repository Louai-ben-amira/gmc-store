import { create } from 'zustand'

const useBasketDrawerStore = create((set) => ({
  open: false,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  toggleDrawer: () => set((state) => ({ open: !state.open })),
}))

export default useBasketDrawerStore
