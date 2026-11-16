import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  server: {
    allowedHosts: [,'https://511ffd4d.r29.cpolar.top'],
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        // target: 'http://localhost:8123',
        target: 'http://192.168.86.128:8123',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
})
