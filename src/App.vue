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
            </div>
            <div class="playlist-actions">
              <button class="edit-btn" @click.stop="showEditPlaylistDialog(playlist)" title="编辑播放源">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="delete-btn" @click.stop="confirmDelete(playlist)" title="删除播放源">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="m3 6 3 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="m8 6 0 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="m13 6 8 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="m10 11 0 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="m14 11 0 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
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
            <div class="channel-list-header">
              <h3>频道列表</h3>
              <span class="channel-count">{{ filteredChannels.length }} 个频道</span>
              <!-- 滚动进度指示器 -->
              <div v-if="filteredChannels.length > visibleCount" class="scroll-indicator">
                <div class="scroll-progress" :style="{ height: scrollProgress + '%' }"></div>
              </div>
            </div>
            <div class="channel-items" ref="channelContainer" @scroll="handleChannelScroll">
              <!-- 虚拟滚动容器 -->
              <div class="virtual-scroll-container" :style="{ height: virtualScrollHeight + 'px' }">
                <div class="virtual-scroll-content" :style="{ transform: `translateY(${virtualScrollOffset}px)` }">
                  <div v-for="channel in visibleChannels"
                       :key="channel.id"
                       class="channel-item"
                       :class="{ active: currentChannel?.id === channel.id }"
                       @click="playChannel(channel)">
                    <span class="channel-number">{{ channel.id.padStart(3, '0') }}</span>
                    <span class="channel-name">{{ channel.name }}</span>
                  </div>
                </div>
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
    <EditPlaylistDialog
      v-if="showEditPlaylistDialogFlag"
      :playlist="editingPlaylistData"
      @close="closeEditPlaylistDialog"
      @save="savePlaylistChanges"
    />
    <div v-if="showDeleteConfirm" class="dialog-overlay">
      <div class="dialog-content delete-dialog">
        <div class="dialog-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#ff3b30" fill-opacity="0.1"/>
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="#ff3b30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3>确认删除</h3>
        <p>确定要删除播放列表 <strong>"{{ playlistToDelete?.name }}"</strong> 吗？</p>
        <p class="warning-text">此操作无法撤销</p>
        <div class="dialog-buttons delete-buttons">
          <button class="cancel-btn secondary-btn" @click="showDeleteConfirm = false">取消</button>
          <button class="delete-btn danger-btn" @click="deletePlaylist">删除</button>
        </div>
      </div>
    </div>

    <!-- 编辑名称对话框 -->
    <div v-if="showEditNameDialog" class="dialog-overlay">
      <div class="dialog-content">
        <h3>编辑播放列表名称</h3>
        <input 
          type="text" 
          v-model="editingName"
          class="edit-name-input"
          placeholder="请输入新名称"
          @keyup.enter="savePlaylistName"
        >
        <div class="dialog-buttons edit-name-buttons">
          <button class="cancel-btn secondary-btn" @click="showEditNameDialog = false">取消</button>
          <button class="save-btn primary-btn" @click="savePlaylistName">保存</button>
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
      <div class="settings-item" @click="cleanupDuplicates">
        <span>清理重复播放源</span>
        <span class="action-icon">🧹</span>
      </div>
    </div>

    <!-- 添加日志查看面板 -->
    <div v-if="showLogs" class="logs-panel">
      <div class="logs-header">
        <h3>运行日志</h3>
        <div class="logs-controls">
          <label class="toggle-label">
            <input 
              type="checkbox" 
              v-model="showDetailedLogs"
              class="toggle-checkbox"
            >
            <span class="toggle-switch"></span>
            <span class="toggle-text">详细加载日志</span>
          </label>
          <div class="logs-header-buttons">
            <button class="refresh-btn" @click="refreshLogs" title="刷新日志">
              <span class="refresh-icon">🔄</span>
            </button>
            <button class="clear-btn" @click="clearLogs">清除日志</button>
            <button class="close-btn" @click="toggleLogs">关闭</button>
          </div>
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
import EditPlaylistDialog from './components/EditPlaylistDialog.vue'

export default {
  components: {
    AddPlaylistDialog,
    EditPlaylistDialog
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

    // 虚拟滚动相关
    const channelContainer = ref(null)
    const itemHeight = 60 // 每个频道项的高度
    const visibleCount = 25 // 增加可见的频道数量
    const bufferCount = 10 // 增加缓冲区频道数量
    const scrollTop = ref(0)
    const visibleChannels = ref([])
    const virtualScrollHeight = ref(0)
    const virtualScrollOffset = ref(0)
    const isScrolling = ref(false)
    const scrollTimer = ref(null)
    const scrollProgress = ref(0)

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
        // 检查是否在Electron环境中
        if (!window.electronAPI) {
          console.warn('Not running in Electron environment, using mock data')
          // 在浏览器环境中使用模拟数据
          playlists.value = [
            {
              id: '1',
              name: '示例播放列表',
              url: 'https://example.com/playlist.m3u8',
              channels: [
                { id: '1', name: '示例频道1', url: 'https://example.com/channel1.m3u8' },
                { id: '2', name: '示例频道2', url: 'https://example.com/channel2.m3u8' }
              ],
              type: 'remote',
              addedAt: new Date().toISOString()
            }
          ]
          filteredPlaylists.value = playlists.value
          devToolsEnabled.value = false
          showToast('浏览器模式：请使用 npm run electron:dev 启动完整功能', 'info')
          return
        }

        const loadedPlaylists = await window.electronAPI.getPlaylists()
        console.log('加载的播放列表:', loadedPlaylists)

        // 清理重复的播放列表（基于URL去重）
        const uniquePlaylists = []
        const seenUrls = new Set()

        for (const playlist of loadedPlaylists) {
          if (!seenUrls.has(playlist.url)) {
            seenUrls.add(playlist.url)
            uniquePlaylists.push(playlist)
          } else {
            console.log('发现重复播放源，已跳过:', playlist.name, playlist.url)
          }
        }

        // 如果清理了重复项，保存清理后的数据
        if (uniquePlaylists.length !== loadedPlaylists.length) {
          console.log(`清理了 ${loadedPlaylists.length - uniquePlaylists.length} 个重复播放源`)
          await window.electronAPI.savePlaylist(uniquePlaylists)
          showToast(`清理了 ${loadedPlaylists.length - uniquePlaylists.length} 个重复播放源`, 'info')
        }

        playlists.value = uniquePlaylists
        filteredPlaylists.value = uniquePlaylists
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
          
          // 检查是否已存在相同URL的播放列表，如果存在则阻止添加
          console.log('检查单个播放源重复:', newPlaylist.url)
          console.log('当前播放列表:', playlists.value.map(p => ({ name: p.name, url: p.url })))

          const existingPlaylist = playlists.value.find(p => p.url === newPlaylist.url)
          if (existingPlaylist) {
            console.log('找到重复的单个播放源:', existingPlaylist)
            showToast(`该播放源已存在：${existingPlaylist.name}`, 'error')
            showDialog.value = false
            return
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
        
        // 检查是否已存在相同URL的播放列表，如果存在则阻止添加
        console.log('检查重复播放源:', url)
        console.log('当前播放列表:', playlists.value.map(p => ({ name: p.name, url: p.url })))

        const existingPlaylist = playlists.value.find(p => p.url === url)
        if (existingPlaylist) {
          console.log('找到重复播放源:', existingPlaylist)
          showToast(`该播放源已存在：${existingPlaylist.name}`, 'error')
          showDialog.value = false
          return
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

    // 手动清理重复播放源
    const cleanupDuplicates = async () => {
      try {
        const originalCount = playlists.value.length
        const uniquePlaylists = []
        const seenUrls = new Set()

        for (const playlist of playlists.value) {
          if (!seenUrls.has(playlist.url)) {
            seenUrls.add(playlist.url)
            uniquePlaylists.push(playlist)
          }
        }

        if (uniquePlaylists.length !== originalCount) {
          playlists.value = uniquePlaylists
          filteredPlaylists.value = uniquePlaylists
          await window.electronAPI.savePlaylist(uniquePlaylists)
          showToast(`清理了 ${originalCount - uniquePlaylists.length} 个重复播放源`, 'success')
        } else {
          showToast('没有发现重复的播放源', 'info')
        }
      } catch (error) {
        console.error('清理重复播放源失败:', error)
        showToast('清理失败: ' + error.message, 'error')
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
        updateVirtualScroll()
        return
      }

      const searchText = channelSearchText.value.toLowerCase()
      let channels = []

      if (!searchText) {
        channels = [...selectedPlaylist.value.channels]
      } else {
        channels = selectedPlaylist.value.channels.filter(channel =>
          channel.name.toLowerCase().includes(searchText) ||
          channel.id.toString().includes(searchText)
        )
      }

      // 按序号排序（数字优先，然后字母）
      channels.sort((a, b) => {
        const aId = a.id.toString()
        const bId = b.id.toString()

        // 检查是否为纯数字
        const aIsNumber = /^\d+$/.test(aId)
        const bIsNumber = /^\d+$/.test(bId)

        if (aIsNumber && bIsNumber) {
          // 都是数字，按数值排序
          return parseInt(aId) - parseInt(bId)
        } else if (aIsNumber && !bIsNumber) {
          // a是数字，b不是，数字排在前面
          return -1
        } else if (!aIsNumber && bIsNumber) {
          // a不是数字，b是，数字排在前面
          return 1
        } else {
          // 都不是纯数字，按字符串排序
          return aId.localeCompare(bId)
        }
      })

      filteredChannels.value = channels
      updateVirtualScroll()
    }

    // 虚拟滚动处理 - 优化性能
    const updateVirtualScroll = () => {
      const totalItems = filteredChannels.value.length
      if (totalItems === 0) {
        visibleChannels.value = []
        virtualScrollHeight.value = 0
        virtualScrollOffset.value = 0
        scrollProgress.value = 0
        return
      }

      virtualScrollHeight.value = totalItems * itemHeight

      const startIndex = Math.max(0, Math.floor(scrollTop.value / itemHeight) - bufferCount)
      const endIndex = Math.min(totalItems, startIndex + visibleCount + bufferCount * 2)

      visibleChannels.value = filteredChannels.value.slice(startIndex, endIndex)
      virtualScrollOffset.value = startIndex * itemHeight

      // 计算滚动进度
      const maxScroll = virtualScrollHeight.value - (channelContainer.value?.clientHeight || 0)
      scrollProgress.value = maxScroll > 0 ? Math.min(100, (scrollTop.value / maxScroll) * 100) : 0
    }

    // 节流滚动处理，提升性能
    const handleChannelScroll = (event) => {
      scrollTop.value = event.target.scrollTop
      isScrolling.value = true

      // 清除之前的定时器
      if (scrollTimer.value) {
        clearTimeout(scrollTimer.value)
      }

      // 立即更新一次
      updateVirtualScroll()

      // 设置定时器，滚动停止后再次更新
      scrollTimer.value = setTimeout(() => {
        isScrolling.value = false
        updateVirtualScroll()
      }, 100)
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
            };
            console.log('清晰度切换:', JSON.stringify(switchInfo, null, 2));
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
            };
            
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
            if (showDetailedLogs.value) {
              const fragInfo = {
                sn: data.frag.sn,
                duration: Math.round(data.frag.duration * 100) / 100 + 's',
                url: data.frag.url
              }
              console.log('加载视频片段:', JSON.stringify(fragInfo, null, 2))
            }
          })

          window.hls.on(Hls.Events.BUFFER_APPENDED, (event, data) => {
            if (showDetailedLogs.value) {
              const bufferInfo = {
                type: data.type,
                timeRanges: {
                  video: videoElement.buffered.length > 0 ? {
                    start: videoElement.buffered.start(0),
                    end: videoElement.buffered.end(0)
                  } : null
                }
              }
              console.log('缓冲区更新:', JSON.stringify(bufferInfo, null, 2))
            }
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
      // 关闭日志面板时同时关闭设置菜单
      if (!showLogs.value) {
        showSettings.value = false
      }
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

    const showDetailedLogs = ref(false)

    const showEditNameDialog = ref(false)
    const editingName = ref('')
    const editingPlaylist = ref(null)

    // 添加编辑播放源对话框状态
    const showEditPlaylistDialogFlag = ref(false)
    const editingPlaylistData = ref(null)

    const showEditDialog = (playlist) => {
      editingPlaylist.value = playlist
      editingName.value = playlist.name
      showEditNameDialog.value = true
    }

    // 添加编辑播放源的方法
    const showEditPlaylistDialog = (playlist) => {
      editingPlaylistData.value = playlist
      showEditPlaylistDialogFlag.value = true
    }

    const closeEditPlaylistDialog = () => {
      showEditPlaylistDialogFlag.value = false
      editingPlaylistData.value = null
    }

    const savePlaylistChanges = async (changes) => {
      try {
        if (!changes.name.trim() || !changes.url.trim()) {
          showToast('名称和地址不能为空', 'error')
          return
        }

        // 检查名称是否重复（排除当前编辑的播放列表）
        const isDuplicateName = playlists.value.some(p =>
          p.id !== changes.id && p.name === changes.name.trim()
        )

        if (isDuplicateName) {
          showToast('该名称已存在', 'error')
          return
        }

        // 检查URL是否重复（排除当前编辑的播放列表）
        const isDuplicateUrl = playlists.value.some(p =>
          p.id !== changes.id && p.url === changes.url.trim()
        )

        if (isDuplicateUrl) {
          showToast('该地址已存在', 'error')
          return
        }

        // 查找要编辑的播放列表
        const index = playlists.value.findIndex(p => p.id === changes.id)
        if (index === -1) {
          showToast('播放列表不存在', 'error')
          return
        }

        const oldPlaylist = playlists.value[index]

        // 如果URL发生变化，需要重新获取播放列表内容
        if (oldPlaylist.url !== changes.url.trim()) {
          showToast('正在更新播放列表...', 'info')

          try {
            // 获取新的播放列表内容
            const result = await window.electronAPI.fetchPlaylist(changes.url.trim())
            if (result.error) {
              throw new Error(result.error)
            }

            // 解析新的频道列表
            const newChannels = parseM3UContent(result.content, changes.url.trim())
            if (newChannels.length === 0) {
              throw new Error('未找到有效的频道信息')
            }

            // 更新播放列表
            playlists.value[index] = {
              ...oldPlaylist,
              name: changes.name.trim(),
              url: changes.url.trim(),
              channels: newChannels,
              updatedAt: new Date().toISOString()
            }
          } catch (error) {
            console.error('获取新播放列表失败:', error)
            showToast('获取新播放列表失败: ' + error.message, 'error')
            return
          }
        } else {
          // 只更新名称
          playlists.value[index] = {
            ...oldPlaylist,
            name: changes.name.trim(),
            updatedAt: new Date().toISOString()
          }
        }

        // 同步更新过滤后的列表
        const filteredIndex = filteredPlaylists.value.findIndex(p => p.id === changes.id)
        if (filteredIndex !== -1) {
          filteredPlaylists.value[filteredIndex] = playlists.value[index]
        }

        // 如果当前正在播放这个列表，也要更新
        if (selectedPlaylist.value?.id === changes.id) {
          selectedPlaylist.value = playlists.value[index]
        }

        // 保存到存储
        await window.electronAPI.savePlaylist(JSON.parse(JSON.stringify(playlists.value)))

        showToast('播放源更新成功', 'success')
        closeEditPlaylistDialog()
      } catch (error) {
        console.error('保存播放源失败:', error)
        showToast('保存失败: ' + error.message, 'error')
      }
    }

    const savePlaylistName = async () => {
      try {
        if (!editingName.value.trim()) {
          showToast('名称不能为空', 'error')
          return
        }

        // 检查名称是否重复
        const isDuplicate = playlists.value.some(p => 
          p.id !== editingPlaylist.value.id && p.name === editingName.value.trim()
        )
        
        if (isDuplicate) {
          showToast('该名称已存在', 'error')
          return
        }

        // 更新播放列表名称
        const index = playlists.value.findIndex(p => p.id === editingPlaylist.value.id)
        if (index !== -1) {
          playlists.value[index].name = editingName.value.trim()
          // 同步更新过滤后的列表
          const filteredIndex = filteredPlaylists.value.findIndex(p => p.id === editingPlaylist.value.id)
          if (filteredIndex !== -1) {
            filteredPlaylists.value[filteredIndex].name = editingName.value.trim()
          }
          
          // 保存到存储
          await window.electronAPI.savePlaylist(JSON.parse(JSON.stringify(playlists.value)))
          
          showToast('名称修改成功', 'success')
          showEditNameDialog.value = false
        }
      } catch (error) {
        console.error('保存名称失败:', error)
        showToast('保存失败: ' + error.message, 'error')
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
      cleanupDuplicates,
      channelSearchText,
      filteredChannels,
      filterChannels,
      // 虚拟滚动
      channelContainer,
      visibleChannels,
      visibleCount,
      virtualScrollHeight,
      virtualScrollOffset,
      handleChannelScroll,
      scrollProgress,
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
      refreshLogs,
      showDetailedLogs,
      showEditNameDialog,
      editingName,
      showEditDialog,
      savePlaylistName,
      showEditPlaylistDialog,
      showEditPlaylistDialogFlag,
      editingPlaylistData,
      closeEditPlaylistDialog,
      savePlaylistChanges
    }
  }
}
</script>

<style>
/* Apple风格全局样式 */
* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.top-left {
  flex: 1;
  margin-right: 20px;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  position: relative;
  max-width: 320px;
}

.search-box input {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 10px 16px;
  padding-left: 40px;
  border-radius: 12px;
  color: #1d1d1f;
  width: 100%;
  font-size: 14px;
  font-weight: 400;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-box input:focus {
  outline: none;
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.search-box input::placeholder {
  color: #86868b;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #86868b;
  font-size: 16px;
}

/* 图标样式已移动到 .player-icons .icon */

.playlists-container {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.playlist-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.playlist-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 24px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  transition: all 0.3s ease;
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.playlist-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.95);
}

.playlist-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.playlist-name {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  line-height: 1.3;
}

.playlist-count {
  color: #86868b;
  font-size: 14px;
  font-weight: 400;
}

.playlist-type {
  color: #86868b;
  font-size: 12px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}



.add-card {
  border: 2px dashed rgba(0, 122, 255, 0.3);
  background: rgba(0, 122, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.add-card:hover {
  border-color: rgba(0, 122, 255, 0.5);
  background: rgba(0, 122, 255, 0.1);
  transform: translateY(-2px);
}

.add-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #007aff;
}

.add-icon span {
  font-size: 36px;
  font-weight: 300;
}

.add-text {
  font-size: 16px;
  font-weight: 500;
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
  position: relative;
}

/* 滚动进度指示器 */
.scroll-indicator {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 30px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.scroll-progress {
  width: 100%;
  background: linear-gradient(180deg, #007aff 0%, #0056d3 100%);
  border-radius: 2px;
  transition: height 0.2s ease;
  min-height: 2px;
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

/* 旧的频道样式已移动到Apple风格样式部分 */

/* 旧的播放器样式已移动到下方的Apple风格样式中 */

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

/* 自定义滚动条样式 - 更明显的设计 */
.channel-items::-webkit-scrollbar {
  width: 12px;
}

.channel-items::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  margin: 4px;
}

.channel-items::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #007aff 0%, #0056d3 100%);
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.channel-items::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #0056d3 0%, #003d99 100%);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.channel-items::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #003d99 0%, #002966 100%);
}

.playlist-content {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  position: relative;
  padding-right: 80px; /* 为操作按钮留出空间 */
}

.playlist-actions {
  position: absolute;
  top: 16px;
  right: 16px;
  opacity: 0;
  transition: all 0.3s ease;
  display: flex;
  gap: 6px;
  z-index: 10;
}

.playlist-card:hover .playlist-actions {
  opacity: 1;
}

.edit-btn, .delete-btn {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.08);
  cursor: pointer;
  padding: 8px;
  border-radius: 10px;
  transition: all 0.2s ease;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.edit-btn {
  color: #007aff;
}

.edit-btn:hover {
  color: #0056d3;
  background: rgba(0, 122, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 122, 255, 0.2);
}

.delete-btn {
  color: #ff3b30;
}

.delete-btn:hover {
  color: #d70015;
  background: rgba(255, 59, 48, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 59, 48, 0.2);
}

/* Apple风格对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  animation: fadeIn 0.3s ease;
}

.dialog-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 32px;
  border-radius: 20px;
  width: 420px;
  color: #1d1d1f;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slideUp 0.3s ease;
}

.dialog-content h3 {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
}

.dialog-content p {
  margin: 16px 0;
  color: #86868b;
  font-size: 16px;
  line-height: 1.5;
}

/* 删除确认对话框特定样式 */
.delete-dialog {
  max-width: 400px;
  text-align: center;
}

.dialog-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.delete-dialog h3 {
  margin: 0 0 12px 0;
  font-size: 22px;
  font-weight: 600;
  color: #1d1d1f;
}

.delete-dialog p {
  margin: 8px 0;
  color: #86868b;
  font-size: 16px;
  line-height: 1.4;
}

.warning-text {
  color: #ff3b30 !important;
  font-size: 14px !important;
  font-weight: 500;
  margin-top: 4px !important;
}

.delete-buttons {
  margin-top: 24px;
  gap: 16px;
  justify-content: center !important;
}

.secondary-btn, .danger-btn {
  border: none;
  min-width: 120px;
  height: 48px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  line-height: 1.2;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.secondary-btn {
  background: rgba(142, 142, 147, 0.12) !important;
  color: #007aff !important;
}

.secondary-btn:hover {
  background: rgba(142, 142, 147, 0.2) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.danger-btn {
  background: #ff3b30 !important;
  color: white !important;
}

.danger-btn:hover {
  background: #d70015 !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
}

/* 主要按钮样式 */
.primary-btn {
  background: #007aff !important;
  color: white !important;
  border: none;
  min-width: 120px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-btn:hover {
  background: #0056d6 !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
}

.primary-btn:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
  transform: none !important;
  box-shadow: none !important;
  background: #007aff !important;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.dialog-buttons button {
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
}

/* 编辑名称对话框样式 */
.edit-name-input {
  width: 100%;
  padding: 14px 16px;
  margin: 16px 0 24px 0;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  color: #1d1d1f;
  font-size: 16px;
  font-weight: 400;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.edit-name-input:focus {
  outline: none;
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  background: rgba(255, 255, 255, 0.95);
}

.edit-name-input::placeholder {
  color: #86868b;
}

.edit-name-buttons {
  justify-content: center !important;
  gap: 16px !important;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

/* Apple风格播放页面样式 */
.player-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.channel-search {
  position: relative;
}

.channel-search input {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 10px 16px;
  color: #1d1d1f;
  width: 220px;
  font-size: 14px;
  font-weight: 400;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.channel-search input:focus {
  outline: none;
  border-color: #007aff;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.channel-search input::placeholder {
  color: #86868b;
}

.player-icons {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.player-icons .icon {
  cursor: pointer;
  font-size: 16px;
  color: #1d1d1f;
  transition: all 0.2s ease;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.player-icons .icon:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: #007aff;
}

.back-button {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 10px 16px;
  border-radius: 12px;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: #007aff;
}

.back-icon {
  margin-right: 8px;
  font-size: 18px;
}

.playlist-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.player-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 0;
  padding: 8px;
}

.channel-list {
  width: 280px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  border-radius: 16px 0 0 16px;
  margin: 8px 0 8px 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.player-area {
  flex: 1;
  background: #000;
  border-radius: 0 16px 16px 0;
  overflow: hidden;
  margin: 8px 8px 8px 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

/* Apple风格频道列表样式 */
.channel-items {
  padding: 16px 0 20px 0;
  flex: 1;
  overflow-y: auto;
}

.channel-item {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 2px 12px;
  border-radius: 12px;
  color: #1d1d1f;
}

.channel-item:hover {
  background: rgba(0, 122, 255, 0.15);
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.2);
  color: #007aff;
}

.channel-item.active {
  background: #007aff;
  color: #fff;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.channel-number {
  color: #86868b;
  margin-right: 16px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 12px;
  font-weight: 500;
  min-width: 40px;
}

.channel-item.active .channel-number {
  color: rgba(255, 255, 255, 0.8);
}

.channel-item:hover .channel-number {
  color: rgba(0, 122, 255, 0.8);
}

.channel-name {
  color: inherit;
  font-weight: inherit;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 虚拟滚动样式 */
.virtual-scroll-container {
  position: relative;
  width: 100%;
}

.virtual-scroll-content {
  position: relative;
  width: 100%;
}

.channel-item {
  height: 60px;
  box-sizing: border-box;
  flex-shrink: 0; /* 确保高度固定 */
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

/* Apple风格Toast样式 */
.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  padding: 16px 24px;
  border-radius: 12px;
  color: #fff;
  z-index: 9999;
  animation: toastSlideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-weight: 500;
  font-size: 14px;
  max-width: 320px;
}

.toast-success {
  background: rgba(52, 199, 89, 0.9);
}

.toast-error {
  background: rgba(255, 59, 48, 0.9);
}

.toast-info {
  background: rgba(0, 122, 255, 0.9);
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
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

/* 旧的video-player样式已移动到下方的Apple风格样式中 */

/* Apple风格切换按钮 */
.toggle-list-button {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 10px 16px;
  border-radius: 12px;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.toggle-list-button:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: #007aff;
}

.toggle-icon {
  margin-right: 8px;
  font-size: 16px;
}

.channel-list {
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.channel-list-hidden {
  transform: translateX(-100%);
  width: 0;
  margin: 0;
}

.player-content {
  position: relative;
  overflow: hidden;
}

/* 当频道列表隐藏时，播放器区域占据全部空间 */
.player-content:has(.channel-list-hidden) .player-area {
  margin: 8px;
  border-radius: 16px;
}

/* 兼容性备选方案 */
.channel-list-hidden + .player-area {
  margin: 8px;
  border-radius: 16px;
}

/* Apple风格设置菜单 */
.settings-menu {
  position: absolute;
  top: 70px;
  right: 24px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 8px 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 200px;
  animation: menuSlideIn 0.3s ease;
}

.settings-item {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #1d1d1f;
  font-weight: 500;
}

.settings-item:hover {
  background: rgba(0, 122, 255, 0.1);
}

.toggle-switch {
  width: 44px;
  height: 24px;
  background-color: #e5e5ea;
  border-radius: 12px;
  position: relative;
  transition: all 0.3s ease;
}

.toggle-switch::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toggle-switch.active {
  background-color: #34c759;
}

.toggle-switch.active::before {
  transform: translateX(20px);
}

.action-icon {
  font-size: 16px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.settings-item:hover .action-icon {
  opacity: 1;
}

.settings-icon {
  cursor: pointer;
}

@keyframes menuSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Apple风格视频播放器样式 */
.video-player {
  width: 100%;
  height: 100%;
  border-radius: 0;
  background: #000;
  border: none;
}

.player-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: #000;
}

/* Apple风格频道列表标题 */
.channel-list-header {
  padding: 20px 20px 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.channel-list-header h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
}

.channel-count {
  font-size: 14px;
  color: #86868b;
  font-weight: 500;
}

/* 滚动条样式 */
.channel-list::-webkit-scrollbar {
  width: 6px;
}

.channel-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.channel-list::-webkit-scrollbar-thumb {
  background: rgba(0, 122, 255, 0.3);
  border-radius: 3px;
}

.channel-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 122, 255, 0.5);
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
  padding: 12px 15px;
  background: #2d2d2d;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logs-header h3 {
  margin: 0;
  font-size: 14px;
  color: #e0e0e0;
}

.logs-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  display: none;
}

/* 自定义开关样式 */
.toggle-label .toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 18px;
  background-color: #555;
  border-radius: 9px;
  transition: background-color 0.3s;
}

.toggle-label .toggle-switch::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: white;
  top: 2px;
  left: 2px;
  transition: transform 0.3s;
}

.toggle-checkbox:checked + .toggle-switch {
  background-color: #4CAF50;
}

.toggle-checkbox:checked + .toggle-switch::before {
  transform: translateX(18px);
}

.toggle-text {
  font-size: 12px;
  color: #ccc;
}

/* 调整按钮组样式 */
.logs-header-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.logs-header button {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: none;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.2s;
}

.refresh-btn {
  background: #444 !important;
  padding: 6px 8px !important;
}

.clear-btn {
  background: #555;
}

.close-btn {
  background: #666;
}

.refresh-btn:hover {
  background: #505050 !important;
}

.clear-btn:hover {
  background: #606060;
}

.close-btn:hover {
  background: #707070;
}

/* 调整日志内容区域样式 */
.logs-content {
  padding: 15px;
  font-size: 12px;
  line-height: 1.5;
  background: #1e1e1e;
}

/* 编辑按钮样式 */
.edit-btn {
  background: none;
  border: none;
  color: #4CAF50;
  cursor: pointer;
  padding: 5px;
  font-size: 18px;
  opacity: 0.7;
  transition: opacity 0.3s;
  margin-right: 5px;
}

.edit-btn:hover {
  opacity: 1;
}

/* 编辑名称输入框样式 */
.edit-name-input {
  width: 100%;
  padding: 8px 12px;
  margin: 15px 0;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  background: #2a2a2a;
  color: #fff;
  font-size: 14px;
}

.edit-name-input:focus {
  outline: none;
  border-color: #4CAF50;
}

/* 保存按钮样式 */
.save-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover {
  background: #45a049;
}
</style> 