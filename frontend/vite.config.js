import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const basePath = globalThis.process?.env?.VITE_BASE_PATH || '/'

// 参考：https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
})
