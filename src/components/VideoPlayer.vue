<template>
  <div class="video-player-container">
    <video 
      ref="videoElement"
      class="video-player"
      :controls="showControls"
      :autoplay="autoplay"
      preload="auto"
      width="100%"
      height="100%"
      playsinline
      webkit-playsinline
      crossorigin="anonymous"
      @play="handlePlay"
      @pause="handlePause"
      @timeupdate="handleTimeUpdate"
      @error="handleError"
      @loadstart="handleLoadStart"
      @loadeddata="handleLoadedData"
      @canplay="handleCanPlay"
      @stalled="handleStalled"
      @waiting="handleWaiting"
      @progress="handleProgress"
    >
      <p class="no-js-message">
        要观看此视频，请启用JavaScript，并考虑升级到支持HTML5视频的浏览器
      </p>
    </video>
    
    <!-- 加载状态指示器 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingMessage }}</p>
      <div class="loading-progress">
        <div class="progress-bar" :style="{ width: loadingProgress + '%' }"></div>
      </div>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="hasError" class="error-overlay">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h3>播放出错</h3>
        <p>{{ errorMessage }}</p>
        <div class="error-actions">
          <button @click="retry" class="retry-button" :disabled="isRetrying">
            {{ isRetrying ? '重试中...' : '重试' }}
          </button>
          <button @click="switchQuality" class="quality-button" v-if="availableQualities.length > 1">
            切换画质
          </button>
        </div>
      </div>
    </div>
    
    <!-- 缓冲状态指示器 -->
    <div v-if="isBuffering && !isLoading" class="buffering-overlay">
      <div class="buffering-spinner"></div>
      <p class="buffering-text">缓冲中...</p>
    </div>
    
    <!-- 网络状态指示器 -->
    <div v-if="networkQuality !== 'unknown'" class="network-indicator" :class="networkQuality">
      <div class="network-icon"></div>
      <span>{{ networkQualityText }}</span>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'

export default {
  name: 'VideoPlayer',
  props: {
    src: {
      type: String,
      default: ''
    },
    autoplay: {
      type: Boolean,
      default: false
    },
    showControls: {
      type: Boolean,
      default: true
    },
    showCustomControls: {
      type: Boolean,
      default: false
    },
    maxRetryAttempts: {
      type: Number,
      default: 5
    },
    bufferSize: {
      type: Number,
      default: 8
    }
  },
  emits: ['ready', 'play', 'pause', 'error', 'timeupdate', 'quality-change', 'buffer-change'],
  setup(props, { emit }) {
    // 响应式状态
    const videoElement = ref(null)
    const isLoading = ref(false)
    const hasError = ref(false)
    const errorMessage = ref('')
    const loadingMessage = ref('正在加载...')
    const loadingProgress = ref(0)
    const isBuffering = ref(false)
    const isRetrying = ref(false)
    const networkQuality = ref('unknown')
    const availableQualities = ref([])
    const currentQuality = ref(null)
    
    // 播放器实例
    let hlsPlayer = null
    let mpegtsPlayer = null
    let bufferManager = null
    let errorRecoveryManager = null
    let progressiveLoader = null
    let networkMonitor = null
    let errorStatistics = null
    
    // 计算属性
    const networkQualityText = computed(() => {
      switch (networkQuality.value) {
        case 'excellent': return '网络极佳'
        case 'good': return '网络良好'
        case 'fair': return '网络一般'
        case 'poor': return '网络较差'
        default: return '网络未知'
      }
    })
    
    // 清理播放器 - 提前定义
    const cleanup = () => {
      try {
        if (hlsPlayer) {
          hlsPlayer.destroy()
          hlsPlayer = null
        }
        
        if (mpegtsPlayer) {
          mpegtsPlayer.destroy()
          mpegtsPlayer = null
        }
        
        if (bufferManager) {
          bufferManager.destroy()
          bufferManager = null
        }
        
        if (errorRecoveryManager) {
          errorRecoveryManager.reset()
          errorRecoveryManager = null
        }
        
        progressiveLoader = null
        networkMonitor = null
        errorStatistics = null
        
        if (videoElement.value) {
          videoElement.value.pause()
          videoElement.value.src = ''
          videoElement.value.load()
        }
        
        availableQualities.value = []
        currentQuality.value = null
        networkQuality.value = 'unknown'
      } catch (error) {
        console.error('清理播放器时出错:', error)
      }
    }
    
    // 监听src变化
    watch(() => props.src, (newSrc) => {
      if (newSrc) {
        loadVideo(newSrc)
      } else {
        cleanup()
      }
    }, { immediate: true })
    
    // 🔄 自动错误恢复管理器
    const createErrorRecoveryManager = () => {
      let retryCount = 0
      let lastErrorTime = 0
      const errorHistory = []
      
      const config = {
        maxRetries: props.maxRetryAttempts,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
        cooldownPeriod: 60000,
        maxErrorsPerMinute: 10
      }
      
      const calculateDelay = (attempt) => {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
          config.maxDelay
        )
        // 添加随机抖动以避免雷群效应
        const jitter = Math.random() * 0.1 * delay
        return Math.floor(delay + jitter)
      }
      
      const shouldRetry = (error) => {
        const now = Date.now()
        const recentErrors = errorHistory.filter(time => now - time < 60000)
        
        if (recentErrors.length >= config.maxErrorsPerMinute) {
          console.log('❌ 错误频率过高，停止重试')
          return false
        }
        
        if (retryCount >= config.maxRetries) {
          console.log('❌ 达到最大重试次数')
          return false
        }
        
        if (now - lastErrorTime < config.cooldownPeriod && retryCount > 0) {
          console.log('❌ 在冷却期内，跳过重试')
          return false
        }
        
        return true
      }
      
      const attemptRecovery = async (errorType, errorDetails) => {
        errorHistory.push(Date.now())
        lastErrorTime = Date.now()
        
        if (!shouldRetry(errorDetails)) {
          showError(`播放失败: ${errorDetails.message || errorType}`)
          return false
        }
        
        retryCount++
        isRetrying.value = true
        
        const delay = calculateDelay(retryCount)
        console.log(`🔄 尝试恢复播放 (${retryCount}/${config.maxRetries})，延迟: ${delay}ms`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        
        try {
          switch (errorType) {
            case 'network':
              await handleNetworkError(errorDetails)
              break
            case 'media':
              await handleMediaError(errorDetails)
              break
            case 'buffer':
              await handleBufferError(errorDetails)
              break
            default:
              await handleGenericError(errorDetails)
              break
          }
          
          console.log('✅ 播放恢复成功')
          retryCount = 0
          isRetrying.value = false
          return true
        } catch (error) {
          console.error(`❌ 恢复失败 (${retryCount}/${config.maxRetries}):`, error)
          
          if (retryCount >= config.maxRetries) {
            showError(`播放恢复失败: ${error.message}`)
            isRetrying.value = false
          } else {
            // 继续重试
            return attemptRecovery(errorType, error)
          }
          return false
        }
      }
      
      const handleNetworkError = async (error) => {
        console.log('🌐 处理网络错误:', error)
        
        // 降低画质
        if (hlsPlayer && currentQuality.value > 0) {
          const newQuality = Math.max(0, currentQuality.value - 1)
          hlsPlayer.currentLevel = newQuality
          currentQuality.value = newQuality
          console.log('📉 降低画质到:', newQuality)
        }
        
        // 减少缓冲区大小
        if (bufferManager) {
          bufferManager.reduceBufferSize()
        }
        
        // 重新加载
        if (hlsPlayer) {
          hlsPlayer.startLoad()
        }
      }
      
      const handleMediaError = async (error) => {
        console.log('🎬 处理媒体错误:', error)
        
        if (hlsPlayer) {
          hlsPlayer.recoverMediaError()
        }
      }
      
      const handleBufferError = async (error) => {
        console.log('📦 处理缓冲区错误:', error)
        
        if (bufferManager) {
          await bufferManager.handleBufferError(error)
        }
        
        if (hlsPlayer) {
          hlsPlayer.recoverMediaError()
        }
      }
      
      const handleGenericError = async (error) => {
        console.log('⚠️ 处理通用错误:', error)
        
        // 重新初始化播放器
        if (props.src) {
          await loadVideo(props.src)
        }
      }
      
      const reset = () => {
        retryCount = 0
        isRetrying.value = false
        errorHistory.length = 0
      }
      
      return {
        attemptRecovery,
        reset,
        config
      }
    }
    
    // 🧹 优化的缓冲区管理器
    const createBufferManager = (videoEl) => {
      let cleanupTimer = null
      let bufferMonitor = null
      let bufferSize = props.bufferSize
      
      const config = {
        minBufferLength: 5,                    // 增加最小缓冲区长度
        maxBufferLength: Math.max(30, bufferSize), // 确保至少30秒缓冲
        maxMaxBufferLength: Math.max(60, bufferSize * 2), // 确保至少60秒最大缓冲
        backBufferLength: 30,                  // 增加后向缓冲区
        bufferFlushingThreshold: 10,           // 提高清理阈值
        optimalBufferLength: Math.max(20, bufferSize), // 最优缓冲区长度
        emergencyBufferLength: 3,              // 增加紧急缓冲区长度
        bufferHealthCheckInterval: 10000,      // 减少健康检查频率
        maxBufferHoleSize: 1.0,                // 允许更大的缓冲区空洞
        bufferAppendErrorThreshold: 10         // 提高错误阈值，减少频繁清理
      }
      
      let bufferAppendErrorCount = 0
      let bufferHealth = 'good'
      
      const getBufferInfo = () => {
        try {
          if (!videoEl || !videoEl.buffered || videoEl.buffered.length === 0) {
            return {
              ahead: 0,
              total: 0,
              ranges: [],
              health: 'empty'
            }
          }
          
          const currentTime = videoEl.currentTime || 0
          const buffered = videoEl.buffered
          const ranges = []
          let ahead = 0
          let total = 0
          
          for (let i = 0; i < buffered.length; i++) {
            try {
              const start = buffered.start(i)
              const end = buffered.end(i)
              ranges.push({ start, end })
              
              if (start <= currentTime && currentTime <= end) {
                ahead = end - currentTime
              }
              
              total += end - start
            } catch (e) {
              console.log(`⚠️ 读取缓冲区范围 ${i} 失败:`, e.message)
            }
          }
          
          return {
            ahead,
            total,
            ranges,
            health: bufferHealth
          }
        } catch (error) {
          console.error('❌ 获取缓冲区信息失败:', error)
          return {
            ahead: 0,
            total: 0,
            ranges: [],
            health: 'error'
          }
        }
      }
      
      const analyzeBufferHealth = () => {
        const info = getBufferInfo()
        
        if (info.ranges.length === 0) {
          bufferHealth = 'empty'
          return
        }
        
        // 检查缓冲区碎片
        const holes = []
        for (let i = 0; i < info.ranges.length - 1; i++) {
          const gap = info.ranges[i + 1].start - info.ranges[i].end
          if (gap > config.maxBufferHoleSize) {
            holes.push(gap)
          }
        }
        
        if (holes.length > 3) {
          bufferHealth = 'fragmented'
        } else if (info.ahead < config.emergencyBufferLength) {
          bufferHealth = 'starving'
        } else if (info.ahead > config.optimalBufferLength) {
          bufferHealth = 'good'
        } else {
          bufferHealth = 'fair'
        }
        
        emit('buffer-change', {
          ...info,
          health: bufferHealth
        })
      }
      
      const requestBufferCleanup = () => {
        if (cleanupTimer) return
        
        cleanupTimer = setTimeout(async () => {
          try {
            await performBufferCleanup()
          } catch (error) {
            console.error('❌ 缓冲区清理失败:', error)
          }
          cleanupTimer = null
        }, 1000)
      }
      
      const performBufferCleanup = async () => {
        if (!hlsPlayer || !hlsPlayer.media) {
          console.log('⚠️ 播放器不可用，跳过缓冲区清理')
          return
        }
        
        const currentTime = videoEl.currentTime || 0

        // 计算总缓冲区长度，只有在真正需要时才清理
        let totalBufferedLength = 0
        const mediaSource = hlsPlayer.media
        if (!mediaSource.sourceBuffers || mediaSource.sourceBuffers.length === 0) {
          return
        }

        // 计算总缓冲区大小
        for (let i = 0; i < mediaSource.sourceBuffers.length; i++) {
          const buffer = mediaSource.sourceBuffers[i]
          if (buffer && buffer.buffered) {
            for (let j = 0; j < buffer.buffered.length; j++) {
              totalBufferedLength += buffer.buffered.end(j) - buffer.buffered.start(j)
            }
          }
        }

        // 只有当缓冲区过大时才清理（更保守的策略）
        const shouldCleanup = totalBufferedLength > config.maxBufferLength * 1.8

        console.log('🧹 缓冲区清理检查:', {
          currentTime: Math.round(currentTime * 100) / 100,
          totalBufferedLength: Math.round(totalBufferedLength * 100) / 100,
          maxBufferLength: config.maxBufferLength,
          shouldCleanup,
          bufferHealth
        })

        if (!shouldCleanup) {
          console.log('📊 缓冲区大小合理，跳过清理')
          return
        }

        const cleanupRange = Math.max(0, currentTime - config.backBufferLength * 1.5) // 更保守的清理范围
        
        const cleanupPromises = []
        
        for (let i = 0; i < mediaSource.sourceBuffers.length; i++) {
          const buffer = mediaSource.sourceBuffers[i]
          
          if (!buffer || buffer.updating || !buffer.buffered || buffer.buffered.length === 0) {
            continue
          }
          
          const promise = new Promise((resolve) => {
            const cleanup = () => {
              try {
                const bufferStart = buffer.buffered.start(0)
                const bufferEnd = buffer.buffered.end(buffer.buffered.length - 1)
                
                if (bufferStart < cleanupRange) {
                  const removeEnd = Math.min(cleanupRange, bufferEnd - 1)
                  if (removeEnd > bufferStart) {
                    buffer.remove(bufferStart, removeEnd)
                    console.log(`🧹 清理缓冲区 ${i} 片段: ${bufferStart.toFixed(2)}s -> ${removeEnd.toFixed(2)}s`)
                  }
                }
              } catch (e) {
                console.log(`⚠️ 缓冲区 ${i} 清理失败:`, e.message)
              }
              resolve()
            }
            
            if (buffer.updating) {
              buffer.addEventListener('updateend', cleanup, { once: true })
            } else {
              cleanup()
            }
          })
          
          cleanupPromises.push(promise)
        }
        
        await Promise.all(cleanupPromises)
      }
      
      const handleBufferError = async (error) => {
        bufferAppendErrorCount++
        console.log(`🔄 处理缓冲区错误 (${bufferAppendErrorCount}/${config.bufferAppendErrorThreshold}):`, error)

        // 更保守的错误处理策略
        if (bufferAppendErrorCount >= config.bufferAppendErrorThreshold) {
          console.log('🔄 缓冲区错误次数过多，执行深度清理')
          await performDeepBufferCleanup()
          bufferAppendErrorCount = 0
        } else if (bufferAppendErrorCount >= config.bufferAppendErrorThreshold / 2) {
          // 中等错误频率时，执行标准清理
          console.log('🔄 执行标准缓冲区清理')
          await performBufferCleanup()
        } else {
          // 低错误频率时，只记录不处理，避免过度干预
          console.log('🔄 缓冲区错误频率较低，暂不处理')
          return
        }

        // 只在真正需要时才调整缓冲区大小
        if (bufferAppendErrorCount >= config.bufferAppendErrorThreshold / 3) {
          reduceBufferSize()
        }
      }
      
      const performDeepBufferCleanup = async () => {
        console.log('🧹 执行深度缓冲区清理')
        
        if (!hlsPlayer || !hlsPlayer.media) {
          return
        }
        
        const mediaSource = hlsPlayer.media
        if (!mediaSource.sourceBuffers) {
          return
        }
        
        // 清除所有缓冲区
        for (let i = 0; i < mediaSource.sourceBuffers.length; i++) {
          const buffer = mediaSource.sourceBuffers[i]
          
          if (!buffer || buffer.updating || !buffer.buffered || buffer.buffered.length === 0) {
            continue
          }
          
          try {
            const start = buffer.buffered.start(0)
            const end = buffer.buffered.end(buffer.buffered.length - 1)
            
            if (end > start) {
              buffer.remove(start, end)
              console.log(`🧹 深度清理缓冲区 ${i}`)
            }
          } catch (e) {
            console.log(`⚠️ 深度清理缓冲区 ${i} 失败:`, e.message)
          }
        }
        
        // 重置缓冲区配置
        bufferSize = Math.max(config.minBufferLength, bufferSize / 2)
        if (hlsPlayer) {
          hlsPlayer.config.maxBufferLength = bufferSize
          hlsPlayer.config.maxMaxBufferLength = bufferSize * 2
        }
      }
      
      const reduceBufferSize = () => {
        const newSize = Math.max(config.minBufferLength, bufferSize - 1)
        if (newSize !== bufferSize) {
          bufferSize = newSize
          if (hlsPlayer) {
            hlsPlayer.config.maxBufferLength = bufferSize
            hlsPlayer.config.maxMaxBufferLength = bufferSize * 2
          }
          console.log('📉 降低缓冲区大小到:', bufferSize)
        }
      }
      
      const increaseBufferSize = () => {
        const newSize = Math.min(config.maxMaxBufferLength, bufferSize + 1)
        if (newSize !== bufferSize) {
          bufferSize = newSize
          if (hlsPlayer) {
            hlsPlayer.config.maxBufferLength = bufferSize
            hlsPlayer.config.maxMaxBufferLength = bufferSize * 2
          }
          console.log('📈 增加缓冲区大小到:', bufferSize)
        }
      }
      
      const startMonitoring = () => {
        if (bufferMonitor) return
        
        bufferMonitor = setInterval(() => {
          analyzeBufferHealth()
          
          // 自适应缓冲区管理
          if (bufferHealth === 'good' && bufferSize < config.maxBufferLength) {
            increaseBufferSize()
          } else if (bufferHealth === 'fragmented' || bufferHealth === 'starving') {
            requestBufferCleanup()
          }
        }, config.bufferHealthCheckInterval)
      }
      
      const destroy = () => {
        if (cleanupTimer) {
          clearTimeout(cleanupTimer)
          cleanupTimer = null
        }
        if (bufferMonitor) {
          clearInterval(bufferMonitor)
          bufferMonitor = null
        }
        bufferAppendErrorCount = 0
      }
      
      return {
        config,
        getBufferInfo,
        requestBufferCleanup,
        handleBufferError,
        reduceBufferSize,
        increaseBufferSize,
        startMonitoring,
        destroy
      }
    }
    
    // 📈 渐进式加载管理器
    const createProgressiveLoader = () => {
      let loadingStage = 0
      let networkSpeed = 0
      let startTime = 0
      
      const stages = [
        { name: 'initial', message: '初始化播放器...', progress: 10 },
        { name: 'manifest', message: '获取播放列表...', progress: 30 },
        { name: 'segments', message: '加载视频片段...', progress: 60 },
        { name: 'ready', message: '准备播放...', progress: 90 },
        { name: 'complete', message: '加载完成', progress: 100 }
      ]
      
      const updateProgress = (stage) => {
        const stageInfo = stages[stage] || stages[0]
        loadingStage = stage
        loadingMessage.value = stageInfo.message
        loadingProgress.value = stageInfo.progress
        
        console.log(`📈 加载进度: ${stageInfo.name} (${stageInfo.progress}%)`)
      }
      
      const measureNetworkSpeed = (bytesLoaded, timeElapsed) => {
        if (timeElapsed > 0) {
          networkSpeed = (bytesLoaded * 8) / (timeElapsed / 1000) / 1024 / 1024 // Mbps
          updateNetworkQuality()
        }
      }
      
      const updateNetworkQuality = () => {
        if (networkSpeed > 10) {
          networkQuality.value = 'excellent'
        } else if (networkSpeed > 5) {
          networkQuality.value = 'good'
        } else if (networkSpeed > 2) {
          networkQuality.value = 'fair'
        } else {
          networkQuality.value = 'poor'
        }
      }
      
      const startLoading = () => {
        startTime = Date.now()
        updateProgress(0)
        isLoading.value = true
      }
      
      const completeLoading = () => {
        updateProgress(4)
        setTimeout(() => {
          isLoading.value = false
          loadingProgress.value = 0
        }, 500)
      }
      
      return {
        updateProgress,
        measureNetworkSpeed,
        startLoading,
        completeLoading
      }
    }
    
    // 🌐 网络监控器
    const createNetworkMonitor = () => {
      let downloadStartTime = 0
      let downloadBytes = 0
      
      const onFragmentLoaded = (event, data) => {
        if (data.stats) {
          const { loading, loaded } = data.stats
          const duration = loading.end - loading.start
          const bytes = loaded
          
          if (progressiveLoader) {
            progressiveLoader.measureNetworkSpeed(bytes, duration)
          }
        }
      }
      
      const onManifestLoaded = () => {
        if (progressiveLoader) {
          progressiveLoader.updateProgress(1)
        }
      }
      
      const onLevelLoaded = () => {
        if (progressiveLoader) {
          progressiveLoader.updateProgress(2)
        }
      }
      
      return {
        onFragmentLoaded,
        onManifestLoaded,
        onLevelLoaded
      }
    }
    
    // 📊 错误统计器
    const createErrorStatistics = () => {
      const stats = {
        totalErrors: 0,
        fatalErrors: 0,
        networkErrors: 0,
        mediaErrors: 0,
        bufferErrors: 0,
        ignoredErrors: 0,
        lastErrorTime: 0,
        errorsByType: {}
      }
      
      let errorCountWindow = [] // 滑动窗口统计
      const windowSize = 60000 // 1分钟窗口
      
      const recordError = (data) => {
        const now = Date.now()
        
        // 清理过期的错误记录
        errorCountWindow = errorCountWindow.filter(time => now - time < windowSize)
        errorCountWindow.push(now)
        
        // 更新统计
        stats.totalErrors++
        stats.lastErrorTime = now
        
        if (data.fatal) {
          stats.fatalErrors++
        }
        
        // 按类型统计
        if (!stats.errorsByType[data.details]) {
          stats.errorsByType[data.details] = 0
        }
        stats.errorsByType[data.details]++
        
        // 按错误类型分类
        switch (data.type) {
          case 'networkError':
            stats.networkErrors++
            break
          case 'mediaError':
            stats.mediaErrors++
            break
          default:
            if (data.details && data.details.includes('buffer')) {
              stats.bufferErrors++
            }
            break
        }
      }
      
      const recordIgnoredError = (data) => {
        stats.ignoredErrors++
      }
      
      const getErrorRate = () => {
        return errorCountWindow.length // 每分钟错误数
      }
      
      const getStats = () => {
        return {
          ...stats,
          errorRate: getErrorRate(),
          recentErrors: errorCountWindow.length
        }
      }
      
      const shouldShowError = (data) => {
        const errorRate = getErrorRate()
        
        // 如果错误率过高，只显示致命错误
        if (errorRate > 10) {
          return data.fatal
        }
        
        // 如果错误率中等，显示重要错误
        if (errorRate > 5) {
          return data.fatal || data.details === 'bufferAppendError'
        }
        
        // 错误率低时，显示大部分错误
        return true
      }
      
      return {
        recordError,
        recordIgnoredError,
        shouldShowError,
        getStats
      }
    }
    
    // HLS播放器初始化
    const initHlsPlayer = async (url) => {
      try {
        console.log('🎬 初始化HLS播放器:', url)
        
        if (!Hls.isSupported()) {
          throw new Error('浏览器不支持HLS')
        }
        
        // 创建管理器
        bufferManager = createBufferManager(videoElement.value)
        errorRecoveryManager = createErrorRecoveryManager()
        progressiveLoader = createProgressiveLoader()
        networkMonitor = createNetworkMonitor()
        errorStatistics = createErrorStatistics()
        
        progressiveLoader.startLoading()
        
        const hlsConfig = {
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,

          // 超时配置 - 更宽松的超时设置，避免网络波动导致的错误
          fragLoadingTimeOut: 60000,        // 增加到60秒
          manifestLoadingTimeOut: 30000,    // 增加到30秒
          levelLoadingTimeOut: 30000,       // 增加到30秒

          // 重试配置 - 适度增加重试次数，减少错误恢复机制的负担
          manifestLoadingMaxRetry: 4,       // 增加重试次数
          levelLoadingMaxRetry: 4,          // 增加重试次数
          fragLoadingMaxRetry: 6,           // 增加重试次数

          // 缓冲区配置 - 更大的缓冲区以应对网络波动
          maxBufferLength: Math.max(30, bufferManager.config.maxBufferLength),     // 至少30秒
          maxMaxBufferLength: Math.max(60, bufferManager.config.maxMaxBufferLength), // 至少60秒
          backBufferLength: 30,             // 增加后向缓冲区
          maxBufferSize: 120 * 1000 * 1000, // 增加到120MB

          // 缓冲区健康检查
          maxBufferHole: 0.3,               // 允许更大的缓冲区空洞
          maxSeekHole: 2,                   // 允许更大的seek空洞

          // 自动清理 - 更保守的清理策略
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackBufferLength: 30,

          // 质量控制 - 更稳定的质量选择
          startLevel: -1,
          capLevelToPlayerSize: false,      // 不限制质量到播放器尺寸
          maxStarvationDelay: 10,           // 增加饥饿延迟容忍度
          maxLoadingDelay: 10,              // 增加加载延迟容忍度

          // 自适应比特率 - 更保守和稳定的设置
          abrEwmaFastLive: 3.0,             // 降低快速响应
          abrEwmaSlowLive: 9.0,             // 降低慢速响应
          abrEwmaFastVoD: 3.0,              // 降低快速响应
          abrEwmaSlowVoD: 9.0,              // 降低慢速响应
          abrEwmaDefaultEstimate: 2000000,  // 提高默认估计带宽
          abrBandWidthFactor: 0.95,         // 更保守的带宽因子
          abrBandWidthUpFactor: 0.7,        // 更保守的上升因子
          abrMaxWithRealBitrate: false,     // 不使用真实比特率限制

          // 错误处理 - 启用更好的兼容性
          enableSoftwareAES: true,          // 启用软件AES解密
          enableWebVTT: false,
          enableIMSC1: false,
          enableCEA708Captions: false,

          // 错误恢复
          fatalErrorRecovery: true,         // 启用致命错误恢复

          // 片段加载优化 - 更长的超时时间
          fragLoadingMaxRetryTimeout: 120000,
          manifestLoadingMaxRetryTimeout: 120000,
          levelLoadingMaxRetryTimeout: 120000,

          // 网络优化
          xhrSetup: function(xhr, url) {
            // 设置更宽松的网络参数
            xhr.timeout = 60000;
            xhr.setRequestHeader('Cache-Control', 'no-cache');
          }
        }
        
        hlsPlayer = new Hls(hlsConfig)
        
        // 事件监听
        hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log('✅ 媒体附加成功')
        })
        
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log('✅ 清单解析完成')
          
          // 更新可用画质
          availableQualities.value = data.levels.map((level, index) => ({
            index,
            width: level.width,
            height: level.height,
            bitrate: level.bitrate,
            name: `${level.height}p`
          }))
          
          currentQuality.value = hlsPlayer.currentLevel
          
          networkMonitor.onManifestLoaded()
          isLoading.value = false
          hasError.value = false
          emit('ready')
          
          // 开始缓冲区监控
          bufferManager.startMonitoring()
          
          if (props.autoplay) {
            const playPromise = videoElement.value.play()
            if (playPromise) {
              playPromise
                .then(() => {
                  console.log('✅ 自动播放成功')
                  errorRecoveryManager.reset()
                })
                .catch(error => {
                  console.log('🔇 自动播放失败，尝试静音播放:', error.message)
                  videoElement.value.muted = true
                  return videoElement.value.play()
                })
                .then(() => {
                  errorRecoveryManager.reset()
                })
                .catch(error => {
                  console.error('❌ 静音播放也失败:', error)
                  errorRecoveryManager.attemptRecovery('media', error)
                })
            }
          }
        })
        
        hlsPlayer.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          networkMonitor.onLevelLoaded()
        })
        
        hlsPlayer.on(Hls.Events.FRAG_LOADED, (event, data) => {
          networkMonitor.onFragmentLoaded(event, data)
        })
        
        hlsPlayer.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          currentQuality.value = data.level
          emit('quality-change', availableQualities.value[data.level])
        })
        
        hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
          const errorDetails = {
            type: data.type,
            details: data.details,
            fatal: data.fatal,
            reason: data.reason,
            level: data.level,
            url: data.url,
            response: data.response,
            context: data.context,
            networkDetails: data.networkDetails
          }
          
          // 记录错误到统计器
          errorStatistics.recordError(data)
          
          // 过滤掉一些不重要的错误，避免控制台被刷屏
          const ignorableErrors = [
            'fragLoadError', // 片段加载错误（通常会自动重试）
            'keyLoadError', // 密钥加载错误
            'fragParsingError', // 片段解析错误
            'fragLoadTimeOut', // 片段加载超时（非致命）
            'levelLoadTimeOut', // 级别加载超时（非致命）
            'manifestLoadTimeOut' // 清单加载超时（非致命）
          ]
          
          const shouldIgnore = !data.fatal && ignorableErrors.includes(data.details)
          
          if (shouldIgnore) {
            errorStatistics.recordIgnoredError(data)
          } else if (errorStatistics.shouldShowError(data)) {
            console.log('⚠️ HLS错误详情:', {
              type: data.type,
              details: data.details,
              fatal: data.fatal,
              reason: data.reason || '未知原因',
              url: data.url || '未知URL',
              errorRate: errorStatistics.getStats().errorRate
            })
          }
          
          // 定期报告错误统计（每30秒）
          const stats = errorStatistics.getStats()
          if (stats.totalErrors > 0 && stats.totalErrors % 30 === 0) {
            console.log('📊 错误统计报告:', {
              总错误数: stats.totalErrors,
              致命错误: stats.fatalErrors,
              网络错误: stats.networkErrors,
              媒体错误: stats.mediaErrors,
              缓冲错误: stats.bufferErrors,
              忽略错误: stats.ignoredErrors,
              错误率: `${stats.errorRate}/分钟`,
              最近错误: Object.keys(stats.errorsByType).slice(0, 3)
            })
          }
          
          // 🎯 bufferAppendError专门处理
          if (data.details === 'bufferAppendError') {
            console.log('🎯 专门处理bufferAppendError:', {
              fatal: data.fatal,
              reason: data.reason,
              details: data.details
            })

            if (bufferManager) {
              bufferManager.handleBufferError(errorDetails)
            }

            if (data.fatal) {
              errorRecoveryManager.attemptRecovery('buffer', errorDetails)
            }
            return
          }

          // 🎯 bufferStalledError专门处理 - 新增
          if (data.details === 'bufferStalledError') {
            console.log('🎯 专门处理bufferStalledError:', {
              fatal: data.fatal,
              reason: data.reason,
              details: data.details,
              currentTime: videoElement.value?.currentTime,
              buffered: videoElement.value?.buffered
            })

            // 对于bufferStalledError，采用更温和的处理方式
            if (!data.fatal) {
              // 非致命的stalled错误，尝试简单的恢复
              if (hlsPlayer) {
                console.log('🔄 尝试重新开始加载以解决stalled问题')
                hlsPlayer.startLoad()
              }
              return // 不显示错误信息，静默处理
            }

            // 致命的stalled错误才进行错误恢复
            if (data.fatal && bufferManager) {
              bufferManager.handleBufferError(errorDetails)
            }

            if (data.fatal) {
              errorRecoveryManager.attemptRecovery('buffer', errorDetails)
            }
            return
          }
          
          // 非致命错误处理
          if (!data.fatal) {
            console.log('⚠️ 非致命HLS错误，继续播放:', data.details)
            return
          }
          
          // 致命错误处理
          let errorType = 'generic'
          let errorMessage = `HLS错误: ${data.details}`
          
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              errorType = 'network'
              errorMessage = `网络错误: ${data.details} ${data.response?.code ? `(${data.response.code})` : ''}`
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              errorType = 'media'
              errorMessage = `媒体错误: ${data.details} ${data.reason || ''}`
              break
            case Hls.ErrorTypes.MUX_ERROR:
              errorType = 'media'
              errorMessage = `复用错误: ${data.details}`
              break
            case Hls.ErrorTypes.KEY_SYSTEM_ERROR:
              errorType = 'media'
              errorMessage = `密钥系统错误: ${data.details}`
              break
            default:
              errorType = 'generic'
              errorMessage = `未知错误: ${data.details || data.type}`
              break
          }
          
          console.error(`❌ 致命HLS错误 [${errorType}]:`, errorMessage)
          
          if (errorRecoveryManager) {
            errorRecoveryManager.attemptRecovery(errorType, {
              ...errorDetails,
              message: errorMessage
            })
          } else {
            showError(errorMessage)
          }
        })
        
        // 加载源
        hlsPlayer.loadSource(url)
        hlsPlayer.attachMedia(videoElement.value)
        
        console.log('🎬 HLS播放器初始化完成')
        
      } catch (error) {
        console.error('❌ HLS播放器初始化失败:', error)
        showError(error.message)
      }
    }
    
    // MPEGTS播放器初始化
    const initMpegtsPlayer = async (url) => {
      try {
        console.log('🎬 初始化MPEGTS播放器:', url)
        
        if (!mpegts.getFeatureList().mseLivePlayback) {
          throw new Error('浏览器不支持MSE直播回放')
        }
        
        progressiveLoader = createProgressiveLoader()
        errorRecoveryManager = createErrorRecoveryManager()
        progressiveLoader.startLoading()
        
        const mpegtsConfig = {
          type: 'mse',
          url: url,
          isLive: true,
          enableStashBuffer: false,
          stashInitialSize: 128,
          cors: true,
          withCredentials: false,
          liveBufferLatencyChasing: true,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackBufferLength: 30,
          fixAudioTimestampGap: true,
          enableWorker: true
        }
        
        mpegtsPlayer = mpegts.createPlayer(mpegtsConfig)
        
        mpegtsPlayer.attachMediaElement(videoElement.value)
        
        mpegtsPlayer.on(mpegts.Events.LOADING_COMPLETE, () => {
          console.log('✅ MPEGTS加载完成')
          progressiveLoader.completeLoading()
          hasError.value = false
          emit('ready')
          
          errorRecoveryManager.reset()
        })
        
        mpegtsPlayer.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
          console.error('❌ MPEGTS错误:', errorType, errorDetail)
          errorRecoveryManager.attemptRecovery('media', { 
            type: errorType, 
            details: errorDetail,
            message: `MPEGTS错误: ${errorType}` 
          })
        })
        
        mpegtsPlayer.load()
        
      } catch (error) {
        console.error('❌ MPEGTS播放器初始化失败:', error)
        showError(error.message)
      }
    }
    
    // 加载视频
    const loadVideo = async (url) => {
      if (!url) return
      
      cleanup()
      
      isLoading.value = true
      hasError.value = false
      isBuffering.value = false
      loadingMessage.value = '正在加载...'
      loadingProgress.value = 0
      
      try {
        const isHls = url.includes('.m3u8') || url.includes('m3u8')
        
        if (Hls.isSupported() && isHls) {
          await initHlsPlayer(url)
        } else if (mpegts.isSupported() && !isHls) {
          await initMpegtsPlayer(url)
        } else {
          // 原生播放器
          videoElement.value.src = url
          isLoading.value = false
          emit('ready')
        }
      } catch (error) {
        console.error('❌ 视频加载失败:', error)
        showError(error.message)
      }
    }
    
    // 切换画质
    const switchQuality = () => {
      if (availableQualities.value.length <= 1) return
      
      const currentIndex = availableQualities.value.findIndex(q => q.index === currentQuality.value)
      const nextIndex = (currentIndex + 1) % availableQualities.value.length
      const nextQuality = availableQualities.value[nextIndex]
      
      if (hlsPlayer) {
        hlsPlayer.currentLevel = nextQuality.index
        currentQuality.value = nextQuality.index
        console.log('🎯 切换画质到:', nextQuality.name)
        emit('quality-change', nextQuality)
      }
    }
    

    
    // 显示错误
    const showError = (message) => {
      isLoading.value = false
      isBuffering.value = false
      hasError.value = true
      errorMessage.value = message
      emit('error', new Error(message))
    }
    
    // 重试播放
    const retry = () => {
      if (props.src) {
        hasError.value = false
        errorMessage.value = ''
        loadVideo(props.src)
      }
    }
    
    // 事件处理
    const handlePlay = () => {
      isBuffering.value = false
      emit('play')
    }
    
    const handlePause = () => {
      emit('pause')
    }
    
    const handleTimeUpdate = (event) => {
      emit('timeupdate', event.target.currentTime)
    }
    
    const handleError = (event) => {
      console.error('❌ 视频元素错误:', event)
      if (errorRecoveryManager) {
        errorRecoveryManager.attemptRecovery('media', event)
      } else {
        showError('视频播放出错')
      }
    }
    
    const handleLoadStart = () => {
      console.log('📡 开始加载视频')
    }
    
    const handleLoadedData = () => {
      console.log('📊 视频数据加载完成')
      if (progressiveLoader) {
        progressiveLoader.updateProgress(3)
      }
    }
    
    const handleCanPlay = () => {
      console.log('▶️ 视频可以播放')
      if (progressiveLoader) {
        progressiveLoader.completeLoading()
      }
    }
    
    const handleStalled = () => {
      console.log('⏸️ 视频播放停滞')
      isBuffering.value = true
    }
    
    const handleWaiting = () => {
      console.log('⏳ 视频等待缓冲')
      isBuffering.value = true
    }
    
    const handleProgress = () => {
      if (isBuffering.value) {
        isBuffering.value = false
      }
    }
    
    // 生命周期
    onMounted(() => {
      console.log('🎬 VideoPlayer组件挂载完成')
    })
    
    onBeforeUnmount(() => {
      console.log('🔄 VideoPlayer组件即将卸载')
      cleanup()
    })
    
    return {
      videoElement,
      isLoading,
      hasError,
      errorMessage,
      loadingMessage,
      loadingProgress,
      isBuffering,
      isRetrying,
      networkQuality,
      networkQualityText,
      availableQualities,
      currentQuality,
      retry,
      switchQuality,
      handlePlay,
      handlePause,
      handleTimeUpdate,
      handleError,
      handleLoadStart,
      handleLoadedData,
      handleCanPlay,
      handleStalled,
      handleWaiting,
      handleProgress
    }
  }
}
</script>

<style scoped>
.video-player-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 12px 0;
}

.loading-progress {
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #007aff, #00d4ff);
  transition: width 0.3s ease;
  border-radius: 2px;
}

.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  z-index: 10;
}

.error-content {
  text-align: center;
  padding: 20px;
  max-width: 400px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-content h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #ff3b30;
}

.error-content p {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #ffffff;
  opacity: 0.8;
  line-height: 1.4;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.retry-button, .quality-button {
  background: #007aff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.retry-button:hover, .quality-button:hover {
  background: #0056b3;
  transform: translateY(-1px);
}

.retry-button:disabled {
  background: #666;
  cursor: not-allowed;
  transform: none;
}

.quality-button {
  background: #34c759;
}

.quality-button:hover {
  background: #28a745;
}

.buffering-overlay {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 5;
}

.buffering-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.buffering-text {
  font-size: 12px;
  margin: 0;
}

.network-indicator {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  z-index: 5;
}

.network-indicator.excellent {
  background: rgba(52, 199, 89, 0.8);
}

.network-indicator.good {
  background: rgba(255, 204, 0, 0.8);
}

.network-indicator.fair {
  background: rgba(255, 149, 0, 0.8);
}

.network-indicator.poor {
  background: rgba(255, 59, 48, 0.8);
}

.network-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.no-js-message {
  color: white;
  text-align: center;
  padding: 20px;
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .error-content {
    padding: 16px;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .retry-button, .quality-button {
    width: 100%;
    max-width: 200px;
  }
  
  .network-indicator {
    top: 10px;
    left: 10px;
    font-size: 11px;
  }
  
  .buffering-overlay {
    top: 10px;
    right: 10px;
  }
}
</style> 