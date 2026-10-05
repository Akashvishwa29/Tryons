import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'https://anywear.decart.ai',
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': 'https://anywear.decart.ai',
          'Referer': 'https://anywear.decart.ai/'
        }
      }
    }
  }
})
