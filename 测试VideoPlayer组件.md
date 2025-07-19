# 如何测试 VideoPlayerTest 组件

## 🚀 简单测试方法

### 方法1: 临时修改App.vue（推荐）

1. **备份当前的App.vue**
   ```bash
   cp src/App.vue src/App.vue.backup
   ```

2. **替换App.vue内容**
   将以下内容临时替换到 `src/App.vue` 中：

```vue
<template>
  <div class="test-app">
    <div class="test-header">
      <h1>🎬 VideoPlayer 错误处理测试</h1>
      <p>测试优化后的VideoPlayer组件功能</p>
      <div class="nav-buttons">
        <button @click="currentView = 'test'" :class="{ active: currentView === 'test' }">
          🧪 错误处理测试
        </button>
        <button @click="currentView = 'example'" :class="{ active: currentView === 'example' }">
          📋 使用示例
        </button>
        <button @click="restoreApp" class="restore-btn">
          🔄 恢复主应用
        </button>
      </div>
    </div>

    <div class="test-content">
      <VideoPlayerTest v-if="currentView === 'test'" />
      <VideoPlayerExample v-if="currentView === 'example'" />
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import VideoPlayerTest from './components/VideoPlayerTest.vue'
import VideoPlayerExample from './components/VideoPlayerExample.vue'

export default {
  name: 'TestApp',
  components: {
    VideoPlayerTest,
    VideoPlayerExample
  },
  setup() {
    const currentView = ref('test')

    const restoreApp = () => {
      alert('请手动恢复App.vue文件:\n1. 停止开发服务器\n2. 恢复App.vue.backup\n3. 重启服务器')
    }

    return {
      currentView,
      restoreApp
    }
  }
}
</script>

<style scoped>
.test-app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.test-header {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.test-header h1 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 28px;
}

.test-header p {
  margin: 0 0 20px 0;
  color: #666;
}

.nav-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.nav-buttons button {
  padding: 10px 20px;
  border: 2px solid #667eea;
  border-radius: 8px;
  background: white;
  color: #667eea;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-buttons button:hover,
.nav-buttons button.active {
  background: #667eea;
  color: white;
}

.restore-btn {
  border-color: #ff6b6b !important;
  color: #ff6b6b !important;
  margin-left: auto;
}

.restore-btn:hover {
  background: #ff6b6b !important;
  color: white !important;
}

.test-content {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}
</style>
```

3. **启动开发服务器**
   ```bash
   npm run electron:dev
   ```

4. **测试完成后恢复**
   ```bash
   cp src/App.vue.backup src/App.vue
   ```

## 🧪 测试功能

### VideoPlayerTest 组件功能：
- ✅ **测试不同的URL**: 正常URL、无效URL、超时URL、CORS错误
- ✅ **错误日志监控**: 实时查看错误处理效果
- ✅ **播放器状态**: 监控播放器的各种状态
- ✅ **错误统计**: 查看错误分类和频率

### VideoPlayerExample 组件功能：
- ✅ **完整示例**: 展示所有播放器功能
- ✅ **配置选项**: 测试不同的播放器配置
- ✅ **事件监听**: 查看所有播放器事件
- ✅ **性能统计**: 实时性能监控

## 🎯 具体测试步骤

### 1. 测试错误处理
1. 启动测试页面
2. 点击"无效URL"按钮
3. 观察错误日志，应该看到：
   - 详细的错误信息（不再是 [object Object]）
   - 智能的错误过滤
   - 错误统计报告

### 2. 测试网络超时
1. 点击"超时URL"按钮
2. 观察：
   - 加载进度指示器
   - 网络质量检测
   - 自动错误恢复

### 3. 测试正常播放
1. 点击"正常URL"按钮
2. 观察：
   - 流畅的加载过程
   - 渐进式加载策略
   - 缓冲区管理

## 📊 预期结果

### 优化前（问题）：
```
⚠️ HLS错误: [object Object]
⚠️ HLS错误: [object Object]
⚠️ HLS错误: [object Object]
```

### 优化后（正常）：
```
⚠️ HLS错误详情: {
  type: "networkError",
  details: "fragLoadError",
  fatal: false,
  reason: "连接超时",
  url: "segment001.ts",
  errorRate: 2
}

📊 错误统计报告: {
  总错误数: 15,
  致命错误: 1,
  网络错误: 8,
  忽略错误: 6,
  错误率: "2/分钟"
}
```

## 🔧 故障排除

如果还是出现错误：

1. **清除浏览器缓存**
   - 按 Ctrl+Shift+R (或 Cmd+Shift+R)

2. **检查控制台**
   - 按 F12 打开开发者工具
   - 查看 Console 标签页

3. **重启开发服务器**
   ```bash
   # 停止服务器 (Ctrl+C)
   npm run electron:dev
   ```

## ⚡ 快速命令

```bash
# 备份并替换App.vue
cp src/App.vue src/App.vue.backup

# 启动测试
npm run electron:dev

# 恢复原文件
cp src/App.vue.backup src/App.vue
```

这样您就可以完整测试VideoPlayerTest组件的所有功能了！ 