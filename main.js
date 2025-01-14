const { app, BrowserWindow, ipcMain, session, dialog } = require('electron')
const path = require('path')
const Store = require('electron-store')
const fetch = require('node-fetch')
const http = require('http');
const https = require('https');

const store = new Store()

// 确保开发者工具默认是关闭的
if (!store.has('devToolsEnabled')) {
  store.set('devToolsEnabled', false);
}

let mainWindow;

function createWindow() {
  // 配置 session
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details;
    
    // 删除可能导致问题的头部
    delete requestHeaders['Origin'];
    delete requestHeaders['Referer'];
    
    // 设置通用请求头
    requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    requestHeaders['Accept'] = '*/*';
    requestHeaders['Cache-Control'] = 'no-cache';
    requestHeaders['Pragma'] = 'no-cache';
    
    callback({ requestHeaders });
  })

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // 处理响应头
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders } = details;
    
    // 删除可能导致问题的头部
    delete responseHeaders['access-control-allow-origin'];
    delete responseHeaders['access-control-allow-methods'];
    delete responseHeaders['access-control-allow-headers'];
    
    // 允许跨域访问
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    
    callback({ 
      responseHeaders,
      statusLine: details.statusLine
    });
  })

  if (process.env.NODE_ENV === 'development') {
    // 添加重试逻辑
    const loadURL = async () => {
      try {
        await mainWindow.loadURL('http://localhost:3000')
        // 在加载完成后检查开发者工具状态
        const devToolsEnabled = store.get('devToolsEnabled', false);
        if (!devToolsEnabled && mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        }
      } catch (error) {
        console.log('Failed to load URL, retrying in 1 second...')
        setTimeout(loadURL, 1000)
      }
    }
    loadURL()
  } else {
    mainWindow.loadFile('dist/index.html')
  }

  // 监听控制台消息
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Console:', message)
  })

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('save-playlist', async (event, playlists) => {
  try {
    // 确保数据可以被序列化
    const sanitizedPlaylists = JSON.parse(JSON.stringify(playlists))
    store.set('playlists', sanitizedPlaylists)
    return { success: true }
  } catch (error) {
    console.error('Error saving playlist:', error)
    return { error: error.message }
  }
})

ipcMain.handle('get-playlists', async () => {
  try {
    const playlists = store.get('playlists') || []
    return JSON.parse(JSON.stringify(playlists))
  } catch (error) {
    console.error('Error getting playlists:', error)
    return []
  }
})

ipcMain.handle('delete-playlist', async (event, playlistId) => {
  try {
    const playlists = store.get('playlists') || []
    const updatedPlaylists = playlists.filter(p => p.id !== playlistId)
    store.set('playlists', updatedPlaylists)
    return { success: true }
  } catch (error) {
    console.error('Error deleting playlist:', error)
    return { error: error.message }
  }
})

// 添加文件选择对话框处理
ipcMain.handle('open-file-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Playlist Files', extensions: ['m3u', 'm3u8'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { filePath: result.filePaths[0] }
    }
    return { canceled: true }
  } catch (error) {
    console.error('Error opening file dialog:', error)
    return { error: error.message }
  }
})

// 添加文件读取处理
ipcMain.handle('read-local-file', async (event, filePath) => {
  try {
    const fs = require('fs').promises
    const content = await fs.readFile(filePath, 'utf8')
    return { content, filePath }
  } catch (error) {
    console.error('Error reading file:', error)
    return { error: error.message }
  }
})

// 添加错误处理
app.on('web-contents-created', (event, contents) => {
  contents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })
})

// 添加新的 IPC 处理器
ipcMain.handle('fetch-playlist', async (event, url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP错误 (${response.status}): ${response.statusText}`);
    }

    const content = await response.text();
    return { content };
  } catch (error) {
    console.error('Fetch playlist error:', error);
    return { error: error.message };
  }
});

// 创建本地代理服务器
const proxyServer = http.createServer(async (req, res) => {
  try {
    const url = req.url.slice(1); // 移除开头的 /
    console.log('Proxying request for:', url);
    
    // 解码 URL（因为可能包含编码过的字符）
    const decodedUrl = decodeURIComponent(url);
    
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://www.example.com',
        'Referer': 'https://www.example.com',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000
    }, (response) => {
      // 设置正确的响应头
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': response.headers['content-type'] || 
          (decodedUrl.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 
           decodedUrl.endsWith('.ts') ? 'video/mp2t' : 
           'application/octet-stream')
      };
      
      // 复制原始响应的其他重要头部
      if (response.headers['content-length']) {
        headers['content-length'] = response.headers['content-length'];
      }
      
      res.writeHead(response.statusCode, headers);
      response.pipe(res);
      
      response.on('error', (error) => {
        console.error('Response error:', error);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Response Error');
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Proxy error:', error);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Proxy Error');
      }
    });
    
    request.on('timeout', () => {
      console.error('Request timeout');
      request.destroy();
      if (!res.headersSent) {
        res.writeHead(504);
        res.end('Request Timeout');
      }
    });
  } catch (error) {
    console.error('Proxy server error:', error);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Server Error');
    }
  }
});

// 启动代理服务器
let proxyPort = 0;
proxyServer.listen(0, '127.0.0.1', () => {
  proxyPort = proxyServer.address().port;
  console.log('Proxy server running on port:', proxyPort);
});

// 添加新的 IPC 处理器用于获取代理 URL
ipcMain.handle('proxy-m3u8', async (event, url) => {
  return `http://127.0.0.1:${proxyPort}/${url}`;
});

// 添加开发者工具控制
ipcMain.handle('toggle-dev-tools', async (event, enabled) => {
  try {
    if (enabled) {
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.webContents.closeDevTools();
    }
    store.set('devToolsEnabled', enabled);
    return true;
  } catch (error) {
    console.error('Error toggling dev tools:', error);
    return false;
  }
});

ipcMain.handle('get-dev-tools-state', async () => {
  // 默认返回 false
  const enabled = store.get('devToolsEnabled', false);
  if (!enabled && mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
  }
  return enabled;
}); 