import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

function pagesBase() {
  const raw = process.env.PAGES_BASE
  if (!raw || raw === '/') return '/'
  return `${raw.replace(/\/$/, '')}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: pagesBase(),
  plugins: [vue()],
})
