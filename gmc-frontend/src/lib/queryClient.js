import { QueryClient } from '@tanstack/react-query'

// Shared instance so non-component code (e.g. authStore) can reset the cache.
// Cached responses are user-specific (is_wishlisted, orders...), so the cache
// must be dropped whenever the logged-in user changes.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

export default queryClient
