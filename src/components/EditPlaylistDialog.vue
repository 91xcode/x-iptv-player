<template>
  <div class="dialog-overlay">
    <div class="dialog-content">
      <h3>编辑播放源</h3>
      
      <!-- 名称输入 -->
      <div class="input-group">
        <label>播放源名称：</label>
        <input 
          v-model="editedName" 
          type="text" 
          placeholder="请输入播放源名称"
          @keyup.enter="saveChanges"
        >
      </div>

      <!-- URL 输入 -->
      <div class="input-group">
        <label>播放地址：</label>
        <input 
          v-model="editedUrl" 
          type="text" 
          placeholder="输入M3U/M3U8播放列表URL"
          @keyup.enter="saveChanges"
        >
      </div>

      <!-- 播放源类型显示 -->
      <div class="info-group" v-if="playlist">
        <div class="info-item">
          <span class="info-label">播放源类型：</span>
          <span class="info-value">{{ getPlaylistTypeText(playlist.type) }}</span>
        </div>
        <div class="info-item" v-if="playlist.channels">
          <span class="info-label">频道数量：</span>
          <span class="info-value">{{ playlist.channels.length }} 个频道</span>
        </div>
        <div class="info-item" v-if="playlist.addedAt">
          <span class="info-label">添加时间：</span>
          <span class="info-value">{{ formatDate(playlist.addedAt) }}</span>
        </div>
      </div>

      <div class="dialog-buttons">
        <button class="cancel-btn" @click="$emit('close')">取消</button>
        <button 
          class="save-btn" 
          @click="saveChanges" 
          :disabled="!editedName.trim() || !editedUrl.trim()"
        >保存</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  props: {
    playlist: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'save'],
  
  setup(props, { emit }) {
    const editedName = ref('')
    const editedUrl = ref('')
    
    onMounted(() => {
      if (props.playlist) {
        editedName.value = props.playlist.name || ''
        editedUrl.value = props.playlist.url || ''
      }
    })
    
    const saveChanges = () => {
      if (!editedName.value.trim() || !editedUrl.value.trim()) {
        return
      }
      
      emit('save', {
        id: props.playlist.id,
        name: editedName.value.trim(),
        url: editedUrl.value.trim()
      })
    }
    
    const getPlaylistTypeText = (type) => {
      switch (type) {
        case 'single':
          return '单个频道'
        case 'remote':
          return '远程播放列表'
        case 'local':
          return '本地播放列表'
        default:
          return '未知类型'
      }
    }
    
    const formatDate = (dateString) => {
      try {
        const date = new Date(dateString)
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      } catch (error) {
        return '未知时间'
      }
    }
    
    return {
      editedName,
      editedUrl,
      saveChanges,
      getPlaylistTypeText,
      formatDate
    }
  }
}
</script>

<style scoped>
/* Apple风格编辑对话框样式 */
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
  width: 520px;
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

input {
  width: 100%;
  padding: 14px 16px;
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

.info-group {
  margin: 24px 0;
  padding: 16px;
  background: rgba(0, 122, 255, 0.05);
  border: 1px solid rgba(0, 122, 255, 0.1);
  border-radius: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0;
}

.info-label {
  color: #86868b;
  font-size: 14px;
  font-weight: 500;
}

.info-value {
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 500;
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

.save-btn {
  background: #007aff;
  color: #fff;
}

.save-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
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
