<template>
  <div class="video-player-example">
    <div class="example-header">
      <h2>优化视频播放器示例</h2>
      <div class="example-controls">
        <label class="control-item">
          <input type="checkbox" v-model="autoplay" />
          自动播放
        </label>
        <label class="control-item">
          <input type="checkbox" v-model="showControls" />
          显示控件
        </label>
        <label class="control-item">
          重试次数:
          <select v-model="maxRetryAttempts">
            <option value="3">3次</option>
            <option value="5">5次</option>
            <option value="10">10次</option>
          </select>
        </label>
        <label class="control-item">
          缓冲区大小:
          <select v-model="bufferSize">
            <option value="4">4秒</option>
            <option value="8">8秒</option>
            <option value="16">16秒</option>
          </select>
        </label>
      </div>
    </div>

    <div class="example-content">
      <!-- 左侧播放器 -->
      <div class="player-section">
        <h3>视频播放器</h3>
        <div class="player-container">
          <VideoPlayer
            :src="currentVideoUrl"
            :autoplay="autoplay"
            :show-controls="showControls"
            :max-retry-attempts="maxRetryAttempts"
            :buffer-size="bufferSize"
            @ready="onPlayerReady"
            @play="onPlay"
            @pause="onPause"
            @error="onError"
            @quality-change="onQualityChange"
            @buffer-change="onBufferChange"
            @timeupdate="onTimeUpdate"
          />
        </div>
      </div>

      <!-- 右侧控制面板 -->
      <div class="control-panel">
        <h3>播放控制</h3>
        
        <!-- 视频源选择 -->
        <div class="control-group">
          <h4>视频源</h4>
          <div class="video-sources">
            <button 
              v-for="source in videoSources" 
              :key="source.id"
              :class="['source-btn', { active: currentVideoUrl === source.url }]"
              @click="selectVideoSource(source)"
            >
              {{ source.name }}
            </button>
          </div>
          <div class="custom-url">
            <input 
              type="text" 
              v-model="customUrl"
              placeholder="输入自定义URL"
              @keyup.enter="loadCustomUrl"
            />
            <button @click="loadCustomUrl">加载</button>
          </div>
        </div>

        <!-- 播放器状态 -->
        <div class="control-group">
          <h4>播放器状态</h4>
          <div class="status-info">
            <div class="status-item">
              <span class="status-label">状态:</span>
              <span class="status-value" :class="playerStatus">{{ playerStatusText }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">当前时间:</span>
              <span class="status-value">{{ formatTime(currentTime) }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">画质:</span>
              <span class="status-value">{{ currentQuality?.name || '自动' }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">缓冲区:</span>
              <span class="status-value">{{ bufferInfo?.health || '未知' }}</span>
            </div>
          </div>
        </div>

        <!-- 错误日志 -->
        <div class="control-group">
          <h4>错误日志</h4>
          <div class="error-log">
            <div v-if="errorLog.length === 0" class="no-errors">
              暂无错误
            </div>
            <div v-else class="error-list">
              <div 
                v-for="(error, index) in errorLog" 
                :key="index"
                class="error-item"
              >
                <span class="error-time">{{ formatTime(error.time) }}</span>
                <span class="error-message">{{ error.message }}</span>
              </div>
            </div>
            <button v-if="errorLog.length > 0" @click="clearErrorLog" class="clear-btn">
              清空日志
            </button>
          </div>
        </div>

        <!-- 性能统计 -->
        <div class="control-group">
          <h4>性能统计</h4>
          <div class="stats-info">
            <div class="stats-item">
              <span class="stats-label">错误恢复次数:</span>
              <span class="stats-value">{{ stats.recoveryCount }}</span>
            </div>
            <div class="stats-item">
              <span class="stats-label">画质切换次数:</span>
              <span class="stats-value">{{ stats.qualityChanges }}</span>
            </div>
            <div class="stats-item">
              <span class="stats-label">缓冲区清理次数:</span>
              <span class="stats-value">{{ stats.bufferCleanups }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed } from 'vue'
import VideoPlayer from './VideoPlayer.vue'

export default {
  name: 'VideoPlayerExample',
  components: {
    VideoPlayer
  },
  setup() {
    // 响应式状态
    const autoplay = ref(false)
    const showControls = ref(true)
    const maxRetryAttempts = ref(5)
    const bufferSize = ref(8)
    const currentVideoUrl = ref('')
    const customUrl = ref('')
    const currentTime = ref(0)
    const playerStatus = ref('idle')
    const currentQuality = ref(null)
    const bufferInfo = ref(null)
    const errorLog = ref([])
    
    // 统计数据
    const stats = reactive({
      recoveryCount: 0,
      qualityChanges: 0,
      bufferCleanups: 0
    })

    // 示例视频源
    const videoSources = ref([
      {
        id: 1,
        name: 'HLS 测试流',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        type: 'hls'
      },
      {
        id: 2,
        name: 'Big Buck Bunny',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        type: 'mp4'
      },
      {
        id: 3,
        name: 'Sintel',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        type: 'mp4'
      }
    ])

    // 计算属性
    const playerStatusText = computed(() => {
      switch (playerStatus.value) {
        case 'ready': return '就绪'
        case 'playing': return '播放中'
        case 'paused': return '暂停'
        case 'error': return '错误'
        case 'loading': return '加载中'
        default: return '空闲'
      }
    })

    // 方法
    const selectVideoSource = (source) => {
      currentVideoUrl.value = source.url
      addLog(`切换到: ${source.name}`)
    }

    const loadCustomUrl = () => {
      if (customUrl.value.trim()) {
        currentVideoUrl.value = customUrl.value.trim()
        addLog(`加载自定义URL: ${customUrl.value}`)
      }
    }

    const formatTime = (seconds) => {
      if (typeof seconds !== 'number' || isNaN(seconds)) {
        return '00:00'
      }
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const addLog = (message) => {
      console.log(`[VideoPlayerExample] ${message}`)
      errorLog.value.unshift({
        time: Date.now(),
        message
      })
      
      // 保留最近20条记录
      if (errorLog.value.length > 20) {
        errorLog.value = errorLog.value.slice(0, 20)
      }
    }

    const clearErrorLog = () => {
      errorLog.value = []
    }

    // 播放器事件处理
    const onPlayerReady = () => {
      playerStatus.value = 'ready'
      addLog('播放器准备就绪')
    }

    const onPlay = () => {
      playerStatus.value = 'playing'
      addLog('开始播放')
    }

    const onPause = () => {
      playerStatus.value = 'paused'
      addLog('暂停播放')
    }

    const onError = (error) => {
      playerStatus.value = 'error'
      addLog(`播放错误: ${error.message}`)
      stats.recoveryCount++
    }

    const onQualityChange = (quality) => {
      currentQuality.value = quality
      addLog(`画质切换到: ${quality.name}`)
      stats.qualityChanges++
    }

    const onBufferChange = (bufferData) => {
      bufferInfo.value = bufferData
      if (bufferData.health === 'fragmented') {
        addLog('缓冲区碎片化，执行清理')
        stats.bufferCleanups++
      }
    }

    const onTimeUpdate = (time) => {
      currentTime.value = time
    }

    // 初始化
    selectVideoSource(videoSources.value[0])

    return {
      autoplay,
      showControls,
      maxRetryAttempts,
      bufferSize,
      currentVideoUrl,
      customUrl,
      currentTime,
      playerStatus,
      playerStatusText,
      currentQuality,
      bufferInfo,
      errorLog,
      stats,
      videoSources,
      selectVideoSource,
      loadCustomUrl,
      formatTime,
      clearErrorLog,
      onPlayerReady,
      onPlay,
      onPause,
      onError,
      onQualityChange,
      onBufferChange,
      onTimeUpdate
    }
  }
}
</script>

<style scoped>
.video-player-example {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.example-header {
  margin-bottom: 20px;
}

.example-header h2 {
  color: #333;
  margin-bottom: 16px;
}

.example-controls {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.control-item input,
.control-item select {
  margin: 0;
}

.example-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.player-section {
  min-height: 400px;
}

.player-section h3 {
  margin-bottom: 12px;
  color: #333;
}

.player-container {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.control-panel {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.control-panel h3 {
  margin-bottom: 20px;
  color: #333;
}

.control-group {
  margin-bottom: 24px;
}

.control-group h4 {
  margin-bottom: 12px;
  color: #555;
  font-size: 14px;
  font-weight: 600;
}

.video-sources {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.source-btn {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.source-btn:hover {
  background: #f0f0f0;
}

.source-btn.active {
  background: #007aff;
  color: white;
  border-color: #007aff;
}

.custom-url {
  display: flex;
  gap: 8px;
}

.custom-url input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.custom-url button {
  padding: 8px 16px;
  background: #007aff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.custom-url button:hover {
  background: #0056b3;
}

.status-info,
.stats-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item,
.stats-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.status-label,
.stats-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.status-value,
.stats-value {
  font-size: 12px;
  color: #333;
  font-weight: 600;
}

.status-value.playing {
  color: #34c759;
}

.status-value.paused {
  color: #ff9500;
}

.status-value.error {
  color: #ff3b30;
}

.error-log {
  background: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  max-height: 200px;
  overflow-y: auto;
}

.no-errors {
  padding: 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.error-list {
  padding: 8px;
}

.error-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
}

.error-item:last-child {
  border-bottom: none;
}

.error-time {
  color: #666;
  font-weight: 500;
  min-width: 60px;
}

.error-message {
  color: #333;
  flex: 1;
}

.clear-btn {
  width: 100%;
  padding: 8px;
  background: #ff3b30;
  color: white;
  border: none;
  border-radius: 0 0 4px 4px;
  cursor: pointer;
  font-size: 12px;
}

.clear-btn:hover {
  background: #d12b20;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .example-content {
    grid-template-columns: 1fr;
  }
  
  .player-container {
    height: 300px;
  }
  
  .example-controls {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .control-item {
    width: 100%;
  }
}
</style> 