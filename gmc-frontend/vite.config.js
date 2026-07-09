import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'GMC Store',
        short_name: 'GMC Store',
        description: 'Digital codes & gift cards - Tunisia\'s gaming store',
        theme_color: '#0a0512',
        background_color: '#0a0512',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        screenshots: [
          { src: '/og-image.jpg', sizes: '1200x630', type: 'image/jpeg', form_factor: 'wide', label: 'GMC Store Shop' },
        ],
        categories: ['shopping', 'games', 'entertainment'],
        shortcuts: [
          {
            name: 'My Orders',
            url: '/orders',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'My Wallet',
            url: '/wallet',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Real files/server routes must bypass the SPA navigation fallback,
        // otherwise the installed service worker answers them with index.html.
        navigateFallbackDenylist: [
          /^\/robots\.txt$/,
          /^\/sitemap\.xml$/,
          /^\/api\//,
          /^\/admin\//,
          /^\/oauth\//,
          /^\/media\//,
        ],
        runtimeCaching: [
          {
            // API calls - network first, fall back to cache for up to 5 minutes
            urlPattern: /^https:\/\/gmcstore\.tn\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 8,
            },
          },
          {
            // Media files (product images, avatars) - cache first
            urlPattern: /^https:\/\/gmcstore\.tn\/media\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Google Fonts - cache first
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        // Disable SW in dev to avoid stale-cache confusion while coding
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
