import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'res',
  server: {
    port: 5173,
    proxy: {
      '/spaces': { target: 'http://localhost:8000', changeOrigin: true },
      '/auth': { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
      '/aggregator': { target: 'http://localhost:8000', changeOrigin: true },
      '/generator': { target: 'http://localhost:8000', changeOrigin: true },
      '/compute': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
