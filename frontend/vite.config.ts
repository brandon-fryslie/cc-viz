import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    allowedHosts: true,
    host: "0.0.0.0",
    proxy: {
      '/api': {
        // In dev mode: proxy to viz-server (future name for proxy-data)
        target: process.env.VITE_API_URL || 'http://localhost:8002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
