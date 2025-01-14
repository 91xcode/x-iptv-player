import { createApp } from 'vue'
import App from './App.vue'
import 'video.js/dist/video-js.css'

// 创建应用实例
const app = createApp(App)

// 挂载应用
app.mount('#app')

// 开发环境下的错误处理
if (process.env.NODE_ENV === 'development') {
  app.config.errorHandler = (err) => {
    console.error('Vue Error:', err)
  }
} 