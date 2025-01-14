import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { join } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: process.env.ELECTRON == "true" ? './' : ".",
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: '.',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'video.js']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['video.js']
  }
}) 