const { contextBridge, ipcRenderer } = require('electron')

// 使用 contextBridge 安全地暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  savePlaylist: async (playlists) => {
    try {
      const sanitizedPlaylists = JSON.parse(JSON.stringify(playlists))
      return await ipcRenderer.invoke('save-playlist', sanitizedPlaylists)
    } catch (error) {
      console.error('IPC Error:', error)
      return { error: error.message }
    }
  },

  getPlaylists: async () => {
    try {
      return await ipcRenderer.invoke('get-playlists')
    } catch (error) {
      console.error('IPC Error:', error)
      return { error: error.message }
    }
  },

  deletePlaylist: async (playlistId) => {
    try {
      return await ipcRenderer.invoke('delete-playlist', playlistId)
    } catch (error) {
      console.error('IPC Error:', error)
      return { error: error.message }
    }
  },

  openLocalFile: async () => {
    try {
      return await ipcRenderer.invoke('open-file-dialog')
    } catch (error) {
      console.error('IPC Error:', error)
      return { error: error.message }
    }
  },

  readLocalFile: async (filePath) => {
    try {
      return await ipcRenderer.invoke('read-local-file', filePath)
    } catch (error) {
      console.error('IPC Error:', error)
      return { error: error.message }
    }
  },

  fetchPlaylist: (url) => {
    try {
      return ipcRenderer.invoke('fetch-playlist', url);
    } catch (error) {
      console.error('IPC Error:', error);
      return { error: error.message };
    }
  },

  proxyM3u8: (url) => ipcRenderer.invoke('proxy-m3u8', url),

  toggleDevTools: (enabled) => ipcRenderer.invoke('toggle-dev-tools', enabled),

  getDevToolsState: () => ipcRenderer.invoke('get-dev-tools-state')
}) 