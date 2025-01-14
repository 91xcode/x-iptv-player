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

h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
}

input {
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  background: #3a3a3a;
  border: none;
  border-radius: 5px;
  color: #fff;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

button {
  padding: 10px 20px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-weight: bold;
}

.cancel-btn {
  background: #3a3a3a;
  color: #fff;
}

.add-btn {
  background: #4CAF50;
  color: #fff;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-group {
  margin: 15px 0;
}

.input-group label {
  display: block;
  margin-bottom: 5px;
  color: #888;
}

.divider {
  text-align: center;
  margin: 20px 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 45%;
  height: 1px;
  background-color: #444;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.divider span {
  background-color: #2a2a2a;
  padding: 0 10px;
  color: #888;
}

.local-file {
  margin: 20px 0;
}

.browse-btn {
  width: 100%;
  padding: 12px;
  background-color: #3a3a3a;
  border: none;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.3s;
}

.browse-btn:hover {
  background-color: #444;
}

.selected-file {
  margin-top: 10px;
  padding: 8px;
  background-color: #3a3a3a;
  border-radius: 4px;
  font-size: 12px;
  color: #aaa;
  word-break: break-all;
}
</style> 