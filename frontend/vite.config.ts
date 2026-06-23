import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, proxy the API to the Go backend (run `go run .` in ../backend on :8080).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
