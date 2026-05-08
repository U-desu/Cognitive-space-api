import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/spaces': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/aggregator': 'http://localhost:8000',
      '/generator': 'http://localhost:8000',
      '/compute': 'http://localhost:8000',
    },
  },
})
