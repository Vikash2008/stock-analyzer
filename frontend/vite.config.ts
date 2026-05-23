import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // /api/portfolio → http://localhost:8000/api/portfolio
      // Avoids CORS in dev; no env vars needed
      '/api': 'http://localhost:8000',
    },
  },
})
