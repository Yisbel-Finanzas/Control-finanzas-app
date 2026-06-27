import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Finanzas Yisbel',
        short_name: 'Finanzas',
        description: 'Control personal de finanzas en DOP y USD',
        theme_color: '#6FAE8A',
        background_color: '#FAFAF8',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/Control-finanzas-app/',
        start_url: '/Control-finanzas-app/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // No interceptar llamadas a Supabase — siempre deben ir a la red
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\//,
            handler: 'NetworkOnly',
          },
        ],
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,html,svg,ico}', 'icons/*.png'],
        globIgnores: ['img/**'],
      },
    }),
  ],
  base: '/Control-finanzas-app/',
})
