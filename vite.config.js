import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/road_data/tom-route-optimizer/' : '/',
  server: {
    port: 5173,
    // Only proxy to local API if VITE_API_URL is not set
    proxy: process.env.VITE_API_URL ? {} : {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  }
})
