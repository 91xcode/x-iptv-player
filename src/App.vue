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
        alert(`初始化错误: ${error.message}`)
      }
    })

    onBeforeUnmount(() => {
      if (player.value) {
        player.value.dispose()
      }
    })
    
    const selectPlaylist = (playlist) => {
      selectedPlaylist.value = playlist
    }
    
    const playChannel = async (channel) => {
      try {
        console.log('开始播放频道:', channel.url);
        currentChannel.value = channel;
        const videoElement = document.getElementById('iptv-player');
        
        if (videoElement) {
          showToast('正在加载频道...', 'info');

          try {
            // 清理现有播放器
            if (window.hls) {
              try {
                window.hls.destroy();
              } catch (e) {
                console.error('HLS destroy error:', e);
              }
              window.hls = null;
            }
            if (window.mpegtsPlayer) {
              try {
                window.mpegtsPlayer.destroy();
              } catch (e) {
                console.error('mpegts destroy error:', e);
              }
              window.mpegtsPlayer = null;
            }

            // 重置视频元素
            videoElement.pause();
            videoElement.currentTime = 0;
            videoElement.src = '';

            // 尝试使用 HLS.js 播放
            if (Hls.isSupported() && channel.url.includes('.m3u8')) {
              window.hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
                enableSoftwareAES: true,
                manifestLoadingTimeOut: 20000,
                manifestLoadingMaxRetry: 3,
                levelLoadingTimeOut: 20000,
                levelLoadingMaxRetry: 3,
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 3,
                xhrSetup: function(xhr, url) {
                  xhr.withCredentials = false;
                }
              });

              window.hls.loadSource(channel.url);
              window.hls.attachMedia(videoElement);
              
              window.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                console.log('HLS Media attached');
                // 设置默认音量
                videoElement.volume = 1;
              });
              
              window.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS Manifest parsed');
                // 直接尝试播放
                const playPromise = videoElement.play();
                if (playPromise !== undefined) {
                  playPromise
                    .then(() => {
                      console.log('自动播放成功');
                    })
                    .catch(error => {
                      console.log("自动播放失败，尝试静音播放:", error);
                      videoElement.muted = true;
                      videoElement.play().catch(e => {
                        console.error("静音播放也失败:", e);
                        showToast('播放失败，请手动点击播放按钮', 'error');
                      });
                    });
                }
              });

              window.hls.on(Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                  switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      console.error("网络错误，尝试使用 mpegts.js");
                      tryMpegts();
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.error("媒体错误，尝试使用 mpegts.js");
                      tryMpegts();
                      break;
                    default:
                      console.error("无法恢复的错误，尝试使用 mpegts.js");
                      tryMpegts();
                      break;
                  }
                }
              });
            } else {
              // 使用 mpegts.js 播放
              tryMpegts();
            }

            // mpegts.js 播放函数
            function tryMpegts() {
              if (window.hls) {
                window.hls.destroy();
                window.hls = null;
              }
              
              if (mpegts.getFeatureList().mseLivePlayback) {
                window.mpegtsPlayer = mpegts.createPlayer({
                  type: 'mse',
                  url: channel.url,
                  isLive: true,
                  enableStashBuffer: false,
                  stashInitialSize: 128,
                  cors: false,
                  withCredentials: false,
                  liveBufferLatencyChasing: true,
                  autoCleanupSourceBuffer: true,
                  xhrSetup: function(xhr, url) {
                    xhr.withCredentials = false;
                  }
                });
                
                window.mpegtsPlayer.attachMediaElement(videoElement);
                window.mpegtsPlayer.load();
               
               // 设置默认音量
               videoElement.volume = 1;
                const playPromise = window.mpegtsPlayer.play();
                if (playPromise !== undefined) {
                  playPromise
                    .then(() => {
                      console.log('mpegts 自动播放成功');
                    })
                    .catch(error => {
                      console.log("mpegts 自动播放失败，尝试静音播放:", error);
                      videoElement.muted = true;
                      window.mpegtsPlayer.play();
                    });
                }
                
                window.mpegtsPlayer.on(mpegts.Events.ERROR, (error) => {
                  console.error('mpegts.js error:', error);
                  showToast('播放失败，请尝试其他频道', 'error');
                });
              } else {
                showToast('您的浏览器不支持播放此视频格式', 'error');
              }
            }

          } catch (error) {
            console.error('播放频道失败:', error);
            showToast(`播放失败: ${error.message}`, 'error');
          }
        }
      } catch (error) {
        console.error('播放频道出错:', error);
        showToast(`播放出错: ${error.message}`, 'error');
      }
    };

    const showAddPlaylistDialog = () => {
      showDialog.value = true
    }
    
    const addPlaylist = async (url, localContent = null, singlePlaylist = null) => {
      try {
        // 如果是单个 m3u8 地址
        if (singlePlaylist) {
          playlists.value = [...playlists.value, singlePlaylist];
          await window.electronAPI.savePlaylist(JSON.parse(JSON.stringify(playlists.value)));
          showToast('播放源添加成功', 'success');
          showDialog.value = false;
          return;
        }

        let content;
        console.log('开始添加播放列表:', url);
        
        if (localContent) {
          content = localContent;
        } else {
          // 使用 electron 的 ipcRenderer 来发送请求
          try {
            const result = await window.electronAPI.fetchPlaylist(url);
            if (result.error) {
              throw new Error(result.error);
            }
            content = result.content;
          } catch (error) {
            console.error('获取播放列表失败:', error);
            showToast(`获取播放列表失败: ${error.message}`, 'error');
            return;
          }
        }

        // 验证内容
        if (!content || !content.trim()) {
          throw new Error('播放列表内容为空');
        }

        // 解析 M3U/M3U8 内容
        const lines = content.split('\n');
        const channels = [];
        let currentChannel = null;

        for (let line of lines) {
          line = line.trim();
          if (!line) continue;
          
          if (line.startsWith('#EXTINF:')) {
            // 解析频道信息
            const titleMatch = line.match(/,(.+)$/);
            const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/);
            const groupMatch = line.match(/group-title="([^"]+)"/);
            
            currentChannel = {
              id: String(channels.length + 1),
              name: tvgNameMatch ? tvgNameMatch[1] : (titleMatch ? titleMatch[1].trim() : `Channel ${channels.length + 1}`),
              logo: tvgLogoMatch ? tvgLogoMatch[1] : '',
              group: groupMatch ? groupMatch[1] : '未分类',
              url: ''
            };
          } else if (line && !line.startsWith('#') && currentChannel) {
            currentChannel.url = line.startsWith('http') ? line : new URL(line, url).href;
            channels.push({ ...currentChannel });
            currentChannel = null;
          }
        }

        if (channels.length === 0) {
          throw new Error('未找到有效的频道信息');
        }

        // 创建新的播放列表对象
        const playlist = {
          id: Date.now().toString(),
          name: url.split('/').pop() || '新播放列表',
          url: url,
          channels: channels,
          type: 'remote'
        };

        // 保存播放列表
        playlists.value = [...playlists.value, playlist];
        await window.electronAPI.savePlaylist(JSON.parse(JSON.stringify(playlists.value)));
        
        showToast('播放列表添加成功', 'success');
        showDialog.value = false;
        
      } catch (error) {
        console.error('添加播放列表失败:', error);
        showToast(error.message || '添加播放列表失败，请稍后重试', 'error');
      }
    };
    
    const addTestPlaylist = async () => {
      try {
        const testUrls = [
          'http://39.134.24.162/dbiptv.sn.chinamobile.com/PLTV/88888890/224/3221225804/index.m3u8',
          'http://39.134.24.162/dbiptv.sn.chinamobile.com/PLTV/88888890/224/3221226195/index.m3u8',
          'http://39.134.24.166/dbiptv.sn.chinamobile.com/PLTV/88888890/224/3221226397/index.m3u8',
          'http://39.134.24.162/dbiptv.sn.chinamobile.com/PLTV/88888890/224/3221226191/index.m3u8',
          'http://39.134.24.162/dbiptv.sn.chinamobile.com/PLTV/88888890/224/3221226395/index.m3u8'
        ];

        const channels = [
          { name: 'CCTV-1 综合', url: testUrls[0] },
          { name: 'CCTV-2 财经', url: testUrls[1] },
          { name: 'CCTV-3 综艺', url: testUrls[2] },
          { name: 'CCTV-4 中文国际', url: testUrls[3] },
          { name: 'CCTV-5 体育', url: testUrls[4] }
        ].map((channel, index) => ({
          id: index,
          name: channel.name,
          url: channel.url
        }));

        const newPlaylist = {
          id: Date.now(),
          name: '测试频道',
          url: 'local',
          channels
        };

        playlists.value.push(newPlaylist);
        await window.electronAPI.savePlaylist(playlists.value);
        selectedPlaylist.value = newPlaylist;
      } catch (error) {
        console.error('Failed to add test playlist:', error);
        alert(`Failed to add test playlist: ${error.message}`);
      }
    };
    
    const confirmDelete = (playlist) => {
      playlistToDelete.value = playlist
      showDeleteConfirm.value = true
    }
    
    const deletePlaylist = async () => {
      try {
        if (!playlistToDelete.value) return
        
        const result = await window.electronAPI.deletePlaylist(playlistToDelete.value.id)
        
        if (result.error) {
          throw new Error(result.error)
        }
        
        // 从本地状态中移除
        playlists.value = playlists.value.filter(p => p.id !== playlistToDelete.value.id)
        
        // 如果删除的是当前选中的播放列表，清除选中状态
        if (selectedPlaylist.value?.id === playlistToDelete.value.id) {
          selectedPlaylist.value = null
        }
        
        showDeleteConfirm.value = false
        playlistToDelete.value = null
      } catch (error) {
        console.error('Failed to delete playlist:', error)
        alert(`Failed to delete playlist: ${error.message}`)
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
        const videoElement = document.getElementById('iptv-player');
        if (videoElement) {
          videoElement.pause();
          videoElement.src = '';
          videoElement.load();
        }
        
        // 清理 HLS 实例
        if (window.hls) {
          window.hls.destroy();
          window.hls = null;
        }
        
        // 清理 mpegts 实例
        if (window.mpegtsPlayer) {
          window.mpegtsPlayer.destroy();
          window.mpegtsPlayer = null;
        }
        
        // 重置当前频道
        currentChannel.value = null;
        
        // 返回主页面
        selectedPlaylist.value = null;
      } catch (error) {
        console.error('返回时清理播放器失败:', error);
      }
    };
    
    const toggleChannelList = () => {
      showChannelList.value = !showChannelList.value;
    };
    
    const toggleSettings = () => {
      showSettings.value = !showSettings.value;
    }
    
    const toggleDevTools = async () => {
      devToolsEnabled.value = !devToolsEnabled.value;
      await window.electronAPI.toggleDevTools(devToolsEnabled.value);
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
      addTestPlaylist,
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
      filterChannels
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
</style> 