<template>
  <div class="app-container">
    <!-- 主页面 (当没有选中播放列表时显示) -->
    <template v-if="!selectedPlaylist">
      <!-- 顶部搜索栏 -->
      <div class="top-bar">
        <div class="top-left">
          <div class="search-box">
            <input 
              type="text" 
              placeholder="搜索播放列表..." 
              v-model="searchText"
            >
            <span class="search-icon">🔍</span>
          </div>
        </div>
        <div class="top-right">
          <span class="icon settings-icon" @click="toggleSettings">⚙️</span>
        </div>
      </div>

      <!-- 播放列表网格 -->
      <div class="playlists-container">
        <div class="playlist-cards">
          <div v-for="playlist in filteredPlaylists" 
                :key="playlist.id" 
                class="playlist-card">
            <div class="playlist-content" @click="selectPlaylist(playlist)">
              <div class="playlist-info">
                <div class="playlist-name">{{ playlist.name }}</div>
                <div class="playlist-count">{{ playlist.channels.length }} 个频道</div>
                <div class="playlist-type">M3U Playlist</div>
              </div>
              <div class="playlist-cloud-icon">☁️</div>
            </div>
            <div class="playlist-actions">
              <button class="delete-btn" @click.stop="confirmDelete(playlist)">🗑️</button>
            </div>
          </div>

          <!-- 添加新播放列表卡片 -->
          <div class="playlist-card add-card" @click="showAddPlaylistDialog">
            <div class="add-icon">
              <span>+</span>
              <div class="add-text">添加播放源</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 播放页面 (当选中播放列表时显示) -->
    <template v-else>
      <div class="player-page">
        <!-- 顶部栏 -->
        <div class="player-header">
          <div class="header-left">
            <button class="back-button" @click="handleBack">
              <span class="back-icon">←</span>
              返回
            </button>
            <button class="toggle-list-button" @click="toggleChannelList">
              <span class="toggle-icon">{{ showChannelList ? '◀' : '▶' }}</span>
              {{ showChannelList ? '隐藏列表' : '显示列表' }}
            </button>
            <h2 class="playlist-title">{{ selectedPlaylist.name }}</h2>
          </div>
          <div class="header-right">
            <div class="channel-search">
              <input 
                type="text" 
                v-model="channelSearchText" 
                placeholder="搜索频道..."
                @input="filterChannels"
              >
            </div>
            <div class="player-icons">
              <span class="icon" @click="showAddPlaylistDialog">+</span>
              <span class="icon settings-icon" @click="toggleSettings">⚙️</span>
            </div>
          </div>
        </div>

        <!-- 播放器和频道列表区域 -->
        <div class="player-content">
          <!-- 左侧频道列表 -->
          <div class="channel-list" :class="{ 'channel-list-hidden': !showChannelList }">
            <div class="channel-items">
              <div v-for="channel in filteredChannels" 
                   :key="channel.id"
                   class="channel-item"
                   :class="{ active: currentChannel?.id === channel.id }"
                   @click="playChannel(channel)">
                <span class="channel-number">{{ channel.id.padStart(3, '0') }}</span>
                <span class="channel-name">{{ channel.name }}</span>
              </div>
            </div>
          </div>

          <!-- 右侧播放器区域 -->
          <div class="player-area">
            <div class="player-wrapper">
              <video 
                id="iptv-player"
                class="video-player"
                controls
                preload="auto"
                width="100%"
                height="100%"
                playsinline
                webkit-playsinline
                crossorigin="anonymous"
                autoplay
              >
                <p class="vjs-no-js">
                  To view this video please enable JavaScript, and consider upgrading to a
                  web browser that supports HTML5 video
                </p>
              </video>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 对话框 -->
    <AddPlaylistDialog v-if="showDialog" @close="showDialog = false" @add="addPlaylist" />
    <div v-if="showDeleteConfirm" class="dialog-overlay">
      <div class="dialog-content">
        <h3>确认删除</h3>
        <p>确定要删除播放列表 "{{ playlistToDelete?.name }}" 吗？</p>
        <div class="dialog-buttons">
          <button class="cancel-btn" @click="showDeleteConfirm = false">取消</button>
          <button class="delete-btn" @click="deletePlaylist">删除</button>
        </div>
      </div>
    </div>

    <!-- Toast 提示 -->
    <div v-if="toast.show" 
         :class="['toast', `toast-${toast.type}`]">
      {{ toast.message }}
    </div>

    <!-- 设置菜单 -->
    <div v-if="showSettings" class="settings-menu">
      <div class="settings-item" @click="toggleDevTools">
        <span>开发者工具</span>
        <span class="toggle-switch" :class="{ active: devToolsEnabled }"></span>
      </div>
      <div class="settings-item" @click="toggleLogs">
        <span>显示日志</span>
        <span class="toggle-switch" :class="{ active: showLogs }"></span>
      </div>
    </div>

    <!-- 添加日志查看面板 -->
    <div v-if="showLogs" class="logs-panel">
      <div class="logs-header">
        <h3>运行日志</h3>
        <div class="logs-header-buttons">
          <button class="refresh-btn" @click="refreshLogs" title="刷新日志">
            <span class="refresh-icon">🔄</span>
          </button>
          <button class="clear-btn" @click="clearLogs">清除日志</button>
          <button class="close-btn" @click="toggleLogs">关闭</button>
        </div>
      </div>
      <pre class="logs-content">{{ logs }}</pre>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'
import { Parser } from 'm3u8-parser'
import AddPlaylistDialog from './components/AddPlaylistDialog.vue'

export default {
  components: {
    AddPlaylistDialog
  },
  
  setup() {
    const searchText = ref('')
    const playlists = ref([])
    const filteredPlaylists = ref([])
    const selectedPlaylist = ref(null)
    const currentChannel = ref(null)
    const showDialog = ref(false)
    const showDeleteConfirm = ref(false)
    const playlistToDelete = ref(null)
    const toast = ref({
      show: false,
      message: '',
      type: 'info'
    });
    const showChannelList = ref(true);
    const showSettings = ref(false)
    const devToolsEnabled = ref(false)
    const channelSearchText = ref('')
    const filteredChannels = ref([])
    
    // 添加播放器相关的状态
    const videoPlayer = ref(null)
    
    // 监听搜索文本变化
    watch(searchText, (newValue) => {
      if (!newValue) {
        filteredPlaylists.value = playlists.value
        return
      }
      
      const searchLower = newValue.toLowerCase()
      filteredPlaylists.value = playlists.value.filter(playlist => 
        playlist.name.toLowerCase().includes(searchLower) ||
        playlist.channels.some(channel => 
          channel.name.toLowerCase().includes(searchLower)
        )
      )
    })
    
    onMounted(async () => {
      try {
        playlists.value = await window.electronAPI.getPlaylists()
        filteredPlaylists.value = playlists.value
        devToolsEnabled.value = false
        await window.electronAPI.toggleDevTools(false)
      } catch (error) {
        console.error('Error during initialization:', error)
        showToast('初始化错误: ' + error.message, 'error')
      }
    })

    onBeforeUnmount(() => {
      cleanupPlayers()
    })
    
    const selectPlaylist = (playlist) => {
      selectedPlaylist.value = playlist
    }
    
    const playChannel = async (channel) => {
      try {
        console.log('开始播放频道:', channel.name, '地址:', channel.url)
        currentChannel.value = channel
        videoPlayer.value = document.getElementById('iptv-player')
        
        if (videoPlayer.value) {
          showToast('正在加载频道...', 'info')
          console.log('初始化播放器...')
          
          // 预连接到服务器
          preconnectToServer(channel.url)
          console.log('预连接到服务器:', channel.url)
          
          // 清理现有播放器
          await cleanupPlayers()
          console.log('清理现有播放器完成')
          
          // 重置视频元素
          videoPlayer.value.pause()
          videoPlayer.value.currentTime = 0
          videoPlayer.value.src = ''
          
          // 设置低延迟模式
          videoPlayer.value.preload = 'auto'
          videoPlayer.value.autoplay = true
          
          try {
            // 尝试使用 HLS.js 播放
            if (Hls.isSupported() && channel.url.includes('.m3u8')) {
              console.log('使用 HLS.js 播放器')
              await initHlsPlayer(videoPlayer.value, channel.url)
            } else {
              console.log('使用 mpegts.js 播放器')
              await initMpegtsPlayer(videoPlayer.value, channel.url)
            }
            console.log('播放器初始化成功')
          } catch (error) {
            console.error('播放器初始化失败:', error)
            showToast(`播放失败: ${error.message}`, 'error')
          }
        }
      } catch (error) {
        console.error('播放频道出错:', error)
        showToast(`播放出错: ${error.message}`, 'error')
      }
    }

    const showAddPlaylistDialog = () => {
      showDialog.value = true
    }
    
    const addPlaylist = async (url, localContent = null, singlePlaylist = null) => {
      try {
        showToast('正在添加播放列表...', 'info')
        
        // 如果是单个 m3u8 地址
        if (singlePlaylist) {
          const newPlaylist = {
            ...singlePlaylist,
            id: Date.now().toString(), // 确保 ID 唯一
            type: 'single'
          }
          
          // 检查是否已存在相同URL的播放列表，但只提示不阻止
          const existingPlaylist = playlists.value.find(p => p.url === newPlaylist.url)
          if (existingPlaylist) {
            showToast(`注意：该播放源已存在于列表"${existingPlaylist.name}"中`, 'info')
          }
          
          // 生成唯一名称
          let name = newPlaylist.name
          let nameIndex = 1
          while (playlists.value.some(p => p.name === name)) {
            name = `${newPlaylist.name} (${nameIndex})`
            nameIndex++
          }
          newPlaylist.name = name
          
          // 更新本地状态
          playlists.value.unshift(newPlaylist)
          filteredPlaylists.value.unshift(newPlaylist)
          
          // 保存到存储
          await window.electronAPI.savePlaylist(JSON.parse(JSON.stringify(playlists.value)))
          
          showToast('播放源添加成功', 'success')
          showDialog.value = false
          return
        }

        let content
        console.log('开始添加播放列表:', url)
        
        // 检查是否已存在相同URL的播放列表，但只提示不阻止
        const existingPlaylist = playlists.value.find(p => p.url === url)
        if (existingPlaylist) {
          showToast(`注意：该地址已存在于列表"${existingPlaylist.name}"中`, 'info')
        }
        
        if (localContent) {
          content = localContent
        } else {
          const result = await window.electronAPI.fetchPlaylist(url)
          if (result.error) {
            throw new Error(result.error)
          }
          content = result.content
        }

        // 验证内容
        if (!content || !content.trim()) {
          throw new Error('播放列表内容为空')
        }

        // 解析 M3U/M3U8 内容
        const channels = parseM3UContent(content, url)
        if (channels.length === 0) {
          throw new Error('未找到有效的频道信息')
        }

        // 生成唯一名称
        let name = url.split('/').pop() || '新播放列表'
        let nameIndex = 1
        let originalName = name
        while (playlists.value.some(p => p.name === name)) {
          name = `${originalName} (${nameIndex})`
          nameIndex++
        }

        // 创建新的播放列表对象
        const newPlaylist = {
          id: Date.now().toString(),
          name: name,
          url: url,
          channels: channels,
          type: 'remote',
          addedAt: new Date().toISOString()
        }

        // 更新本地状态
        playlists.value.unshift(newPlaylist)
        filteredPlaylists.value.unshift(newPlaylist)
        
        // 保存到存储
        await window.electronAPI.savePlaylist(JSON.parse(JSON.stringify(playlists.value)))
        
        showToast('播放列表添加成功', 'success')
        showDialog.value = false
      } catch (error) {
        console.error('添加播放列表失败:', error)
        showToast(error.message || '添加播放列表失败，请稍后重试', 'error')
      }
    };
    
    const confirmDelete = (playlist) => {
      playlistToDelete.value = playlist
      showDeleteConfirm.value = true
    }
    
    const deletePlaylist = async () => {
      try {
        if (!playlistToDelete.value) return
        
        showToast('正在删除播放列表...', 'info')
        
        // 调用 API 删除播放列表
        const result = await window.electronAPI.deletePlaylist(playlistToDelete.value.id)
        
        if (result.error) {
          throw new Error(result.error)
        }
        
        // 从本地状态中移除
        const index = playlists.value.findIndex(p => p.id === playlistToDelete.value.id)
        if (index !== -1) {
          playlists.value.splice(index, 1)
          // 同步更新过滤后的列表
          filteredPlaylists.value = filteredPlaylists.value.filter(p => p.id !== playlistToDelete.value.id)
          
          // 如果删除的是当前选中的播放列表，清除选中状态
          if (selectedPlaylist.value?.id === playlistToDelete.value.id) {
            selectedPlaylist.value = null
          }
          
          showToast('播放列表删除成功', 'success')
        }
        
        showDeleteConfirm.value = false
        playlistToDelete.value = null
      } catch (error) {
        console.error('删除播放列表失败:', error)
        showToast('删除播放列表失败: ' + error.message, 'error')
      }
    }
    
    const showToast = (message, type = 'info') => {
      toast.value = {
        show: true,
        message,
        type
      };
      setTimeout(() => {
        toast.value.show = false;
      }, 3000);
    };
    
    const handleBack = () => {
      try {
        if (videoPlayer.value) {
          videoPlayer.value.pause()
          videoPlayer.value.src = ''
          videoPlayer.value.load()
        }
        
        cleanupPlayers()
        
        // 重置当前频道
        currentChannel.value = null
        
        // 返回主页面
        selectedPlaylist.value = null
      } catch (error) {
        console.error('返回时清理播放器失败:', error)
        showToast('返回失败: ' + error.message, 'error')
      }
    }
    
    const toggleChannelList = () => {
      showChannelList.value = !showChannelList.value;
    };
    
    const toggleSettings = () => {
      showSettings.value = !showSettings.value;
    }
    
    const toggleDevTools = async () => {
      try {
        devToolsEnabled.value = !devToolsEnabled.value;
        const result = await window.electronAPI.toggleDevTools(devToolsEnabled.value);
        if (result.error) {
          console.error('Failed to toggle dev tools:', result.error);
          showToast('Failed to toggle dev tools: ' + result.error, 'error');
          // Revert the toggle if there was an error
          devToolsEnabled.value = !devToolsEnabled.value;
        }
      } catch (error) {
        console.error('Error toggling dev tools:', error);
        showToast('Error toggling dev tools: ' + error.message, 'error');
        // Revert the toggle if there was an error
        devToolsEnabled.value = !devToolsEnabled.value;
      }
    }
    
    // 监听播放列表变化，更新过滤后的频道列表
    watch([selectedPlaylist, channelSearchText], () => {
      filterChannels()
    })
    
    // 过滤频道
    const filterChannels = () => {
      if (!selectedPlaylist.value) {
        filteredChannels.value = []
        return
      }
      
      const searchText = channelSearchText.value.toLowerCase()
      if (!searchText) {
        filteredChannels.value = selectedPlaylist.value.channels
        return
      }
      
      filteredChannels.value = selectedPlaylist.value.channels.filter(channel => 
        channel.name.toLowerCase().includes(searchText) ||
        channel.id.toString().includes(searchText)
      )
    }
    
    // 添加清理播放器的函数
    const cleanupPlayers = async () => {
      try {
        if (window.hls) {
          try {
            window.hls.destroy()
          } catch (e) {
            console.error('HLS destroy error:', e)
          }
          window.hls = null
        }
        if (window.mpegtsPlayer) {
          try {
            window.mpegtsPlayer.destroy()
          } catch (e) {
            console.error('mpegts destroy error:', e)
          }
          window.mpegtsPlayer = null
        }
      } catch (error) {
        console.error('清理播放器失败:', error)
      }
    }

    // 添加 HLS 播放器初始化函数
    const initHlsPlayer = async (videoElement, url) => {
      return new Promise((resolve, reject) => {
        try {
          console.log('========== HLS播放器初始化开始 ==========')
          console.log(`播放地址: ${url}`)
          
          window.hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            fragLoadingTimeOut: 20000,
            manifestLoadingTimeOut: 20000,
            levelLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 4,
            levelLoadingMaxRetry: 4,
            fragLoadingMaxRetry: 4,
            manifestLoadingRetryDelay: 1000,
            levelLoadingRetryDelay: 1000,
            fragLoadingRetryDelay: 1000,
            maxBufferLength: 10,
            maxMaxBufferLength: 30,
            backBufferLength: 30,
            startLevel: -1,
            abrEwmaDefaultEstimate: 500000,
            progressive: true,
            testBandwidth: true
          })

          window.hls.loadSource(url)
          console.log('开始加载视频源...')
          
          window.hls.attachMedia(videoElement)
          console.log('HLS媒体已附加到视频元素')

          window.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            console.log('媒体附加成功，音量设置为:', videoElement.volume)
          })

          window.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            const manifestInfo = {
              levels: data.levels.length,
              firstLevel: data.firstLevel,
              audioTracks: data.audioTracks?.length || 0,
              subtitleTracks: data.subtitleTracks?.length || 0
            }
            console.log('HLS清单解析完成:', JSON.stringify(manifestInfo, null, 2))
            
            if(data.levels.length > 1) {
              const levelsInfo = data.levels.map(level => ({
                height: level.height,
                bitrate: Math.round(level.bitrate / 1024) + 'kbps'
              }))
              console.log('可用清晰度:', JSON.stringify(levelsInfo, null, 2))
            }

            videoElement.play()
              .then(() => {
                console.log('播放开始成功')
                resolve()
              })
              .catch(error => {
                console.log('自动播放失败，尝试静音播放:', error.message)
                videoElement.muted = true
                videoElement.play()
                  .then(() => resolve())
                  .catch(reject)
              })
          })

          // 添加更多事件监听
          window.hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            const switchInfo = {
              level: data.level,
              height: window.hls.levels[data.level]?.height,
              bitrate: Math.round(window.hls.levels[data.level]?.bitrate / 1024) + 'kbps'
            }
            console.log('清晰度切换:', JSON.stringify(switchInfo, null, 2))
          })

          window.hls.on(Hls.Events.ERROR, (event, data) => {
            const errorInfo = {
              type: data.type,
              details: data.details,
              fatal: data.fatal,
              url: data.url,
              response: data.response ? {
                code: data.response.code,
                text: data.response.text
              } : null
            }
            
            let errorDescription = '未知错误';
            switch (data.details) {
              case 'manifestLoadError':
                errorDescription = '播放列表加载失败';
                break;
              case 'manifestLoadTimeOut':
                errorDescription = '播放列表加载超时';
                break;
              case 'manifestParsingError':
                errorDescription = '播放列表解析失败';
                break;
              case 'levelLoadError':
                errorDescription = '视频清晰度信息加载失败';
                break;
              case 'levelLoadTimeOut':
                errorDescription = '视频清晰度信息加载超时';
                break;
              case 'fragLoadError':
                errorDescription = '视频片段加载失败';
                break;
              case 'fragLoadTimeOut':
                errorDescription = '视频片段加载超时，正在重试...';
                break;
              case 'bufferAddCodecError':
                errorDescription = '视频编码不支持';
                break;
              case 'bufferAppendError':
                errorDescription = '视频缓冲区写入失败';
                break;
              case 'bufferFullError':
                errorDescription = '视频缓冲区已满';
                break;
              case 'bufferStalledError':
                errorDescription = '视频缓冲区暂停';
                break;
            }

            errorInfo.description = errorDescription;
            
            if (data.fatal) {
              console.error('HLS致命错误:', JSON.stringify(errorInfo, null, 2));
              reject(new Error(`播放失败: ${errorDescription}`));
            } else {
              console.warn('HLS警告:', JSON.stringify(errorInfo, null, 2));
              
              if (data.details === 'fragLoadTimeOut') {
                showToast('视频片段加载超时，正在重试...', 'info');
              }
            }
          })

          window.hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
            const fragInfo = {
              sn: data.frag.sn,
              duration: Math.round(data.frag.duration * 100) / 100 + 's',
              url: data.frag.url
            }
            console.log('加载视频片段:', JSON.stringify(fragInfo, null, 2))
          })

          window.hls.on(Hls.Events.BUFFER_APPENDED, (event, data) => {
            const bufferInfo = {
              type: data.type,
              timeRanges: {
                video: videoElement.buffered.length > 0 ? {
                  start: videoElement.buffered.start(0),
                  end: videoElement.buffered.end(0)
                } : null
              }
            }
            console.log('缓冲区更新:', JSON.stringify(bufferInfo, null, 2));
          })

        } catch (error) {
          console.error('HLS播放器初始化错误:', error)
          reject(error)
        }
      })
    }

    // 添加 mpegts 播放器初始化函数
    const initMpegtsPlayer = async (videoElement, url) => {
      return new Promise((resolve, reject) => {
        try {
          console.log('========== MPEGTS播放器初始化开始 ==========')
          console.log(`播放地址: ${url}`)

          if (!mpegts.getFeatureList().mseLivePlayback) {
            throw new Error('浏览器不支持MSE直播回放')
          }

          window.mpegtsPlayer = mpegts.createPlayer({
            type: 'mse',
            url: url,
            isLive: true,
            enableStashBuffer: false,
            stashInitialSize: 128,
            cors: true,
            withCredentials: false,
            liveBufferLatencyChasing: true,
            autoCleanupSourceBuffer: true
          })

          console.log('MPEGTS播放器创建成功')
          
          window.mpegtsPlayer.attachMediaElement(videoElement)
          console.log('媒体元素已附加')
          
          window.mpegtsPlayer.load()
          console.log('开始加载视频流')

          window.mpegtsPlayer.on(mpegts.Events.LOADING_COMPLETE, () => {
            console.log('视频流加载完成')
          })

          window.mpegtsPlayer.on(mpegts.Events.STATISTICS_INFO, (stats) => {
            const statsInfo = {
              speed: Math.round(stats.speed * 100) / 100 + 'KB/s',
              fps: Math.round(stats.fps),
              dropped: stats.dropped
            }
            console.log('播放统计:', JSON.stringify(statsInfo, null, 2))
          })

          window.mpegtsPlayer.on(mpegts.Events.ERROR, (error) => {
            const errorInfo = {
              code: error.code,
              msg: error.msg,
              detail: error.detail
            }
            console.error('MPEGTS错误:', JSON.stringify(errorInfo, null, 2))
            reject(new Error(`播放错误: ${error.msg}`))
          })

          // ... 其他代码保持不变
        } catch (error) {
          console.error('MPEGTS播放器初始化错误:', error)
          reject(error)
        }
      })
    }

    // 添加预连接函数
    const preconnectToServer = (url) => {
      try {
        const link = document.createElement('link')
        link.rel = 'preconnect'
        const urlObj = new URL(url)
        link.href = `${urlObj.protocol}//${urlObj.hostname}`
        document.head.appendChild(link)
      } catch (error) {
        console.error('Preconnect failed:', error)
      }
    }

    const parseM3UContent = (content, baseUrl) => {
      try {
        const lines = content.split('\n')
        const channels = []
        let currentChannel = null

        for (let line of lines) {
          line = line.trim()
          if (!line) continue
          
          if (line.startsWith('#EXTINF:')) {
            // 解析频道信息
            const titleMatch = line.match(/,(.+)$/)
            const tvgNameMatch = line.match(/tvg-name="([^"]+)"/)
            const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/)
            const groupMatch = line.match(/group-title="([^"]+)"/)
            
            currentChannel = {
              id: String(channels.length + 1),
              name: tvgNameMatch ? tvgNameMatch[1] : (titleMatch ? titleMatch[1].trim() : `Channel ${channels.length + 1}`),
              logo: tvgLogoMatch ? tvgLogoMatch[1] : '',
              group: groupMatch ? groupMatch[1] : '未分类',
              url: ''
            }
          } else if (line && !line.startsWith('#') && currentChannel) {
            try {
              // 处理相对和绝对 URL
              currentChannel.url = line.startsWith('http') ? line : new URL(line, baseUrl).href
              channels.push({ ...currentChannel })
              currentChannel = null
            } catch (error) {
              console.error('解析频道 URL 失败:', error)
              // 继续处理下一个频道
              currentChannel = null
            }
          }
        }

        // 对频道进行排序和分组
        channels.sort((a, b) => {
          // 首先按分组排序
          if (a.group !== b.group) {
            return a.group.localeCompare(b.group)
          }
          // 然后按名称排序
          return a.name.localeCompare(b.name)
        })

        return channels
      } catch (error) {
        console.error('解析播放列表失败:', error)
        throw new Error('解析播放列表失败: ' + error.message)
      }
    }

    // 添加日志查看面板
    const showLogs = ref(false)
    const logs = ref('')

    // 修改 toggleLogs 函数
    const toggleLogs = async () => {
      showLogs.value = !showLogs.value
      if (showLogs.value) {
        // 当开启日志显示时，立即获取历史日志
        try {
          const historicalLogs = await window.electronAPI.getLogs()
          if (historicalLogs) {
            logs.value = historicalLogs
            nextTick(() => {
              const logsContent = document.querySelector('.logs-content')
              if (logsContent) {
                logsContent.scrollTop = logsContent.scrollHeight
              }
            })
          }
        } catch (error) {
          console.error('获取历史日志失败:', error)
        }
      }
    }

    // 添加日志监听器
    onMounted(() => {
      if (window.require) {
        const { ipcRenderer } = window.require('electron')
        ipcRenderer.on('console-log', (event, message) => {
          if (message && typeof message === 'string') {
            // 添加新日志
            logs.value += message + '\n'
            
            // 限制日志行数
            const logLines = logs.value.split('\n')
            if (logLines.length > 1000) { // 限制最大行数
              logs.value = logLines.slice(-1000).join('\n')
            }
            
            // 自动滚动到底部
            nextTick(() => {
              const logsContent = document.querySelector('.logs-content')
              if (logsContent && showLogs.value) {
                logsContent.scrollTop = logsContent.scrollHeight
              }
            })
          }
        })
      }
    })

    // 清除日志
    const clearLogs = async () => {
      try {
        await window.electronAPI.clearLogs()
        logs.value = ''
      } catch (error) {
        console.error('清除日志失败:', error)
        showToast('清除日志失败: ' + error.message, 'error')
      }
    }

    // 添加一些测试日志
    onMounted(() => {
      console.log('Vue 应用已加载')
      console.info('日志系统已初始化')
    })

    // 在 setup 函数中添加 refreshLogs 方法
    const refreshLogs = async () => {
      try {
        const historicalLogs = await window.electronAPI.getLogs()
        if (historicalLogs) {
          logs.value = historicalLogs
          nextTick(() => {
            const logsContent = document.querySelector('.logs-content')
            if (logsContent) {
              logsContent.scrollTop = logsContent.scrollHeight
            }
          })
        }
      } catch (error) {
        console.error('刷新日志失败:', error)
        showToast('刷新日志失败: ' + error.message, 'error')
      }
    }

    return {
      searchText,
      filteredPlaylists,
      selectedPlaylist,
      currentChannel,
      showDialog,
      selectPlaylist,
      playChannel,
      addPlaylist,
      showAddPlaylistDialog,
      showDeleteConfirm,
      playlistToDelete,
      confirmDelete,
      deletePlaylist,
      toast,
      showToast,
      handleBack,
      showChannelList,
      toggleChannelList,
      showSettings,
      devToolsEnabled,
      toggleSettings,
      toggleDevTools,
      channelSearchText,
      filteredChannels,
      filterChannels,
      videoPlayer,
      cleanupPlayers,
      initHlsPlayer,
      initMpegtsPlayer,
      preconnectToServer,
      parseM3UContent,
      showLogs,
      logs,
      clearLogs,
      toggleLogs,
      refreshLogs
    }
  }
}
</script>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1a1a1a;
  color: #fff;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #2a2a2a;
}

.top-left {
  flex: 1;
  margin-right: 20px;
}

.top-right {
  display: flex;
  align-items: center;
}

.search-box {
  position: relative;
  max-width: 300px;
}

.search-box input {
  background-color: #3a3a3a;
  border: none;
  padding: 8px 15px;
  padding-left: 35px;
  border-radius: 20px;
  color: #fff;
  width: 100%;
  font-size: 14px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  font-size: 14px;
}

.icon {
  cursor: pointer;
  font-size: 20px;
  color: #fff;
  transition: color 0.3s;
}

.icon:hover {
  color: #4CAF50;
}

.playlists-container {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.playlist-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.playlist-card {
  background-color: #2a2a2a;
  border-radius: 10px;
  padding: 20px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  transition: background-color 0.3s;
  position: relative;
}

.playlist-card:hover {
  background-color: #3a3a3a;
}

.playlist-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.playlist-name {
  font-size: 18px;
  font-weight: bold;
}

.playlist-count {
  color: #888;
  font-size: 14px;
}

.playlist-type {
  color: #666;
  font-size: 12px;
}

.playlist-cloud-icon {
  font-size: 24px;
  opacity: 0.5;
}

.add-card {
  border: 2px dashed #3a3a3a;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #666;
}

.add-icon span {
  font-size: 32px;
}

.content-area {
  display: flex;
  height: calc(100vh - 60px); /* 减去顶部栏高度 */
  background-color: #1a1a1a;
}

.channel-list {
  width: 300px;
  background-color: #2a2a2a;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #3a3a3a;
}

.channel-list-header {
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #3a3a3a;
}

.channel-list-header h3 {
  margin: 0;
  font-size: 16px;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 24px;
  cursor: pointer;
  padding: 0 5px;
}

.close-btn:hover {
  color: #fff;
}

.channel-items {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.channel-item {
  padding: 12px 15px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #aaa;
}

.channel-item:hover {
  background-color: #3a3a3a;
  color: #fff;
}

.channel-item.active {
  background-color: #4a4a4a;
  color: #fff;
}

.channel-number {
  font-family: monospace;
  color: #666;
  margin-right: 10px;
  font-size: 14px;
  min-width: 40px;
}

.channel-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-area {
  flex: 1;
  background-color: #000;
  position: relative;
  display: flex;
  flex-direction: column;
}

.player-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

#iptv-player {
  width: 100%;
  height: 100%;
  max-height: calc(100vh - 60px);
}

.current-info {
  position: absolute;
  top: 20px;
  left: 20px;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 10px 15px;
  border-radius: 4px;
  z-index: 1;
}

.channel-title {
  color: #fff;
  font-size: 16px;
  font-weight: bold;
}

/* 自定义滚动条样式 */
.channel-items::-webkit-scrollbar {
  width: 6px;
}

.channel-items::-webkit-scrollbar-track {
  background: #2a2a2a;
}

.channel-items::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 3px;
}

.channel-items::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.playlist-content {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.playlist-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  opacity: 0;
  transition: opacity 0.3s;
}

.playlist-card:hover .playlist-actions {
  opacity: 1;
}

.delete-btn {
  background: none;
  border: none;
  color: #ff4444;
  cursor: pointer;
  padding: 5px;
  font-size: 18px;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.delete-btn:hover {
  opacity: 1;
}

/* 删除确认对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.dialog-content {
  background: #2a2a2a;
  padding: 25px;
  border-radius: 10px;
  width: 400px;
  color: #fff;
}

.dialog-content p {
  margin: 20px 0;
  color: #ddd;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.dialog-buttons button {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.dialog-buttons .cancel-btn {
  background: #666;
  color: white;
}

.dialog-buttons .delete-btn {
  background: #ff4444;
  color: white;
}

/* 视频播放器样式 */
.vjs-title-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 10px 20px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
  color: white;
  z-index: 2;
  font-size: 16px;
  font-weight: bold;
  pointer-events: none;
}

.video-js .vjs-control-bar {
  background-color: rgba(0,0,0,0.7);
}

.video-js .vjs-big-play-button {
  background-color: rgba(0,0,0,0.6);
  border-color: #fff;
}

.video-js .vjs-big-play-button:hover {
  background-color: rgba(0,0,0,0.8);
}

.video-js .vjs-loading-spinner {
  border-color: #fff;
}

.video-js .vjs-control:focus:before,
.video-js .vjs-control:hover:before {
  text-shadow: 0 0 1em #fff;
}

/* 错误提示样式 */
.player-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.8);
  padding: 20px;
  border-radius: 8px;
  color: #fff;
  text-align: center;
}

/* 添加新的播放页面样式 */
.player-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1a1a1a;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: #1a1a1a;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.channel-search {
  position: relative;
}

.channel-search input {
  background: #2a2a2a;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  color: #fff;
  width: 200px;
  font-size: 14px;
}

.channel-search input::placeholder {
  color: #666;
}

.player-icons {
  display: flex;
  gap: 15px;
}

.player-icons .icon {
  cursor: pointer;
  font-size: 18px;
  color: #fff;
  transition: color 0.3s;
}

.player-icons .icon:hover {
  color: #4CAF50;
}

.back-button {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  padding: 8px 15px;
  border-radius: 4px;
  margin-right: 20px;
}

.back-button:hover {
  background-color: #3a3a3a;
}

.back-icon {
  margin-right: 8px;
  font-size: 20px;
}

.playlist-title {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.player-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.channel-list {
  width: 300px;
  background-color: #2a2a2a;
  border-right: 1px solid #3a3a3a;
  overflow-y: auto;
}

.player-area {
  flex: 1;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 调整频道列表样式 */
.channel-items {
  padding: 10px 0;
}

.channel-item {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.channel-item:hover {
  background-color: #3a3a3a;
}

.channel-item.active {
  background-color: #4a4a4a;
}

.channel-number {
  color: #666;
  margin-right: 15px;
  font-family: monospace;
}

.channel-name {
  color: #fff;
}

.video-js {
  width: 100% !important;
  height: 100% !important;
  background-color: #000;
}

.video-js .vjs-tech {
  object-fit: contain;
}

.video-js .vjs-loading-spinner {
  border: 3px solid rgba(255, 255, 255, 0.7);
}

.video-js .vjs-control-bar {
  background-color: rgba(0, 0, 0, 0.7);
}

.video-js .vjs-big-play-button {
  background-color: rgba(0, 0, 0, 0.6);
  border: 2px solid #fff;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  line-height: 56px;
  font-size: 30px;
  margin-left: -30px;
  margin-top: -30px;
}

.video-js:hover .vjs-big-play-button {
  background-color: rgba(0, 0, 0, 0.8);
}

.vjs-mute-play-button {
  background-color: rgba(43, 51, 63, 0.7);
  border: none;
  color: white;
  padding: 5px 10px;
  border-radius: 3px;
  margin-right: 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.3s;
}

.vjs-mute-play-button:hover {
  background-color: rgba(43, 51, 63, 0.9);
}

.video-js .vjs-control-bar {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  transition: background-color 0.3s;
}

.video-js:hover .vjs-control-bar {
  background-color: rgba(43, 51, 63, 0.9);
}

.video-js .vjs-big-play-button {
  display: none;
  opacity: 0;
  pointer-events: none;
}

.video-js.vjs-paused .vjs-big-play-button {
  display: block;
  opacity: 1;
  pointer-events: auto;
}

.vjs-loading-toast,
.vjs-error-toast {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 8px;
  color: #fff;
  text-align: center;
  z-index: 2;
}

.vjs-loading-toast {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vjs-loading-toast::before {
  content: '';
  width: 20px;
  height: 20px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.vjs-error-toast {
  min-width: 300px;
}

.error-icon {
  font-size: 24px;
  margin-bottom: 10px;
}

.error-message {
  font-size: 16px;
  margin-bottom: 5px;
}

.error-tip {
  font-size: 14px;
  color: #999;
}

.video-js .vjs-error-display {
  display: none;
}

/* 添加 Toast 样式 */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 4px;
  color: #fff;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

.toast-success {
  background-color: #4caf50;
}

.toast-error {
  background-color: #f44336;
}

.toast-info {
  background-color: #2196f3;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.vjs-unmute-button {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.vjs-unmute-button:hover {
  background: rgba(0, 0, 0, 0.9);
}

.video-player {
  width: 100%;
  height: 100%;
  background: #000;
}

/* 添加新的样式 */
.toggle-list-button {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 15px;
  border-radius: 4px;
  margin-right: 20px;
  transition: background-color 0.3s;
}

.toggle-list-button:hover {
  background-color: #3a3a3a;
}

.toggle-icon {
  margin-right: 8px;
  font-size: 16px;
}

.channel-list {
  width: 300px;
  transition: transform 0.3s ease, width 0.3s ease;
}

.channel-list-hidden {
  transform: translateX(-100%);
  width: 0;
}

.player-content {
  position: relative;
  overflow: hidden;
}

/* 设置菜单样式 */
.settings-menu {
  position: absolute;
  top: 60px;
  right: 20px;
  background: #2a2a2a;
  border-radius: 8px;
  padding: 10px 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.settings-item {
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color 0.2s;
}

.settings-item:hover {
  background-color: #3a3a3a;
}

.toggle-switch {
  width: 40px;
  height: 20px;
  background-color: #666;
  border-radius: 10px;
  position: relative;
  transition: background-color 0.3s;
}

.toggle-switch::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background-color: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.3s;
}

.toggle-switch.active {
  background-color: #4CAF50;
}

.toggle-switch.active::before {
  transform: translateX(20px);
}

.settings-icon {
  cursor: pointer;
}

/* 添加日志面板样式 */
.logs-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background: #1e1e1e;
  color: #fff;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #333;
  animation: slideIn 0.3s ease;
}

.logs-header {
  padding: 10px;
  background: #2d2d2d;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
}

.logs-header h3 {
  margin: 0;
  font-size: 14px;
  color: #e0e0e0;
}

.logs-header-buttons {
  display: flex;
  gap: 8px;
}

.logs-header button {
  padding: 5px 10px;
  background: #444;
  border: none;
  color: #fff;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.logs-header button:active {
  transform: scale(0.95);
}

.logs-header .clear-btn {
  background: #555;
}

.logs-header .clear-btn:hover {
  background: #666;
}

.logs-header .close-btn {
  background: #666;
}

.logs-header .close-btn:hover {
  background: #777;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  margin: 0;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #d0d0d0;
}

/* 添加日志颜色样式 */
.logs-content [data-type="ERROR"] {
  color: #ff6b6b;
}

.logs-content [data-type="WARN"] {
  color: #ffd93d;
}

.logs-content [data-type="INFO"] {
  color: #4dabf7;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 8px !important;
  background: #444 !important;
}

.refresh-btn:hover {
  background: #555 !important;
}

.refresh-icon {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.refresh-btn:active .refresh-icon {
  transform: rotate(180deg);
}
</style> 