import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { join } from 'path'
import { platform, arch } from 'os'

// 检测平台兼容性并配置 esbuild
function getEsbuildConfig() {
  const currentPlatform = platform()
  const currentArch = arch()
  
  console.log(`检测到平台: ${currentPlatform}-${currentArch}`)
  
  try {
    // 尝试使用原生 esbuild
    require.resolve('esbuild')
    return {
      target: 'esnext'
    }
  } catch (error) {
    console.warn('原生 esbuild 不可用，尝试使用替代方案...')
    
    try {
      // 尝试使用 esbuild-wasm 作为后备
      require.resolve('esbuild-wasm')
      return {
        target: 'esnext',
        // 使用 wasm 版本可能较慢，但兼容性更好
        minify: false
      }
    } catch (wasmError) {
      console.warn('esbuild-wasm 也不可用，禁用 esbuild 优化')
      return false
    }
  }
}

const esbuildConfig = getEsbuildConfig()

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 3000,
    strictPort: false, // 允许端口自动递增
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.VITE_PORT || 3000}`,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    // 配置 esbuild 或禁用它
    ...(esbuildConfig === false ? {
      minify: 'terser', // 使用 terser 替代 esbuild
    } : {
      esbuild: esbuildConfig
    }),
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  optimizeDeps: {
    include: ['video.js'],
    // 如果 esbuild 有问题，禁用预构建优化
    ...(esbuildConfig === false ? {
      disabled: true
    } : {})
  },
  // 添加平台特定的配置
  define: {
    __PLATFORM__: JSON.stringify(platform()),
    __ARCH__: JSON.stringify(arch())
  }
}) 