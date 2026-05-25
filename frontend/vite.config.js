import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 参考：https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
