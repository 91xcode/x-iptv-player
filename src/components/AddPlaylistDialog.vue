<template>
  <div class="dialog-overlay">
    <div class="dialog-content">
      <h3>添加播放源</h3>
      
      <!-- URL 输入 -->
      <div class="input-group">
        <label>播放地址：</label>
        <input 
          v-model="url" 
          type="text" 
          placeholder="输入M3U/M3U8播放列表URL"
        >
      </div>

      <!-- 分隔线 -->
      <div class="divider">
        <span>或者</span>
      </div>

      <!-- 本地文件选择 -->
      <div class="local-file">
        <button class="browse-btn" @click="selectLocalFile">
          选择本地文件
        </button>
        <div v-if="selectedFile" class="selected-file">
          已选择: {{ selectedFile }}
        </div>
      </div>

      <div class="dialog-buttons">
        <button class="cancel-btn" @click="$emit('close')">取消</button>
        <button 
          class="add-btn" 
          @click="addPlaylist" 
          :disabled="!url && !selectedFile"
        >添加</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  emits: ['close', 'add'],
  
  setup(props, { emit }) {
    const url = ref('')
    const selectedFile = ref('')
    
    const selectLocalFile = async () => {
      try {
        if (!window.electronAPI) {
          throw new Error('Electron API not available')
        }
        
        const result = await window.electronAPI.openLocalFile()
        if (result.error) {
          throw new Error(result.error)
        }
        if (!result.canceled && result.filePath) {
          selectedFile.value = result.filePath
        }
      } catch (error) {
        console.error('Failed to select file:', error)
        alert('Failed to select file: ' + error.message)
      }
    }
    
    const addPlaylist = async () => {
      try {
        if (selectedFile.value) {
          if (!window.electronAPI) {
            throw new Error('Electron API not available')
          }
          
          const result = await window.electronAPI.readLocalFile(selectedFile.value)
          if (result.error) {
            throw new Error(result.error)
          }
          emit('add', `file://${selectedFile.value}`, result.content)
        } else {
          if (!url.value) {
            alert('请输入地址');
            return;
          }

          // 检查是否是单个 m3u8 地址
          if (url.value.toLowerCase().endsWith('.m3u8')) {
            // 创建单个频道的播放列表
            const playlist = {
              id: Date.now().toString(),
              name: url.value.split('/').pop() || '新频道',
              url: url.value,
              channels: [{
                id: '1',
                name: url.value.split('/').pop() || '新频道',
                url: url.value
              }],
              type: 'single'
            };
            
            emit('add', url.value, null, playlist);
            return;
          }

          // 原有的播放列表处理逻辑
          emit('add', url.value);
        }
      } catch (error) {
        console.error('Failed to add playlist:', error)
        alert('Failed to add playlist: ' + error.message)
      }
    }
    
    return {
      url,
      selectedFile,
      selectLocalFile,
      addPlaylist
    }
  }
}
</script>

<style scoped>
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
  width: 480px;
  color: #1d1d1f;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slideUp 0.3s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

h3 {
  margin: 0 0 24px 0;
  font-size: 22px;
  font-weight: 600;
  color: #1d1d1f;
}

input {
  width: 100%;
  padding: 14px 16px;
  margin: 8px 0;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  color: #1d1d1f;
  font-size: 16px;
  font-weight: 400;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  background: rgba(255, 255, 255, 0.95);
}

input::placeholder {
  color: #86868b;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
}

button {
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 16px;
  transition: all 0.2s ease;
  font-family: inherit;
}

.cancel-btn {
  background: rgba(142, 142, 147, 0.12);
  color: #007aff;
}

.cancel-btn:hover {
  background: rgba(142, 142, 147, 0.2);
}

.add-btn {
  background: #007aff;
  color: #fff;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.input-group {
  margin: 20px 0;
}

.input-group label {
  display: block;
  margin-bottom: 8px;
  color: #86868b;
  font-size: 14px;
  font-weight: 500;
}

.divider {
  text-align: center;
  margin: 32px 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 45%;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1), transparent);
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.divider span {
  background: rgba(255, 255, 255, 0.95);
  padding: 0 16px;
  color: #86868b;
  font-size: 14px;
  font-weight: 500;
}

.local-file {
  margin: 24px 0;
}

.browse-btn {
  width: 100%;
  padding: 14px 16px;
  background: rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.2);
  border-radius: 12px;
  color: #007aff;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
  font-weight: 500;
  font-family: inherit;
}

.browse-btn:hover {
  background: rgba(0, 122, 255, 0.15);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
}

.selected-file {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(52, 199, 89, 0.1);
  border: 1px solid rgba(52, 199, 89, 0.2);
  border-radius: 12px;
  font-size: 14px;
  color: #30d158;
  word-break: break-all;
  font-weight: 500;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>