import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'

const syncSubtitleCanvas = (): Plugin => ({
  name: 'sync-subtitle-canvas',
  transform(code, id) {
    if (/jassub[\\/]dist[\\/]worker[\\/]renderers/.test(id)) return code.replace(/desynchronized: true/g, 'desynchronized: false')
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), syncSubtitleCanvas()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:3000', changeOrigin: false, ws: true },
    },
  },
  optimizeDeps: {
    exclude: ['jassub'],
  },
  worker: {
    format: 'es',
    plugins: () => [syncSubtitleCanvas()],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
})
