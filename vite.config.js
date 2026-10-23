import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

function pagesBase() {
  const raw = process.env.PAGES_BASE
  if (!raw || raw === '/') return '/'
  return `${raw.replace(/\/$/, '')}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: pagesBase(),
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Булочка',
        short_name: 'Булочка',
        description: 'Размер малыша по неделям беременности',
        lang: 'ru',
        theme_color: '#f3ebe3',
        background_color: '#f3ebe3',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,ico,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
