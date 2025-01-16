const { app, BrowserWindow, ipcMain, session, dialog } = require('electron')
const path = require('path')
const Store = require('electron-store')
const fetch = require('node-fetch')
const http = require('http');
const https = require('https');
const fs = require('fs')

const store = new Store()
const logPath = path.join(app.getPath('userData'), 'app.log')

// 确保开发者工具默认是关闭的
if (!store.has('devToolsEnabled')) {
  store.set('devToolsEnabled', false);
}

let mainWindow;
let logHistory = []
const MAX_LOG_HISTORY = 1000

// 添加文件日志函数
function logToFile(message) {
  const timestamp = new Date().toISOString()
  const logMessage = `${timestamp} - ${message}\n`
  fs.appendFileSync(logPath, logMessage)
}

// 在创建窗口之前设置控制台输出捕获
const setupConsoleCapture = (win) => {
  try {
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    const originalConsoleWarn = console.warn
    const originalConsoleInfo = console.info

    const handleLog = (type, args) => {
      if (!args || !args.length) return

      try {
        // 先输出到终端
        const terminalOutput = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg)
            } catch (e) {
              return String(arg)
            }
          }
          return String(arg)
        }).join(' ')

        // 添加文件日志
        logToFile(`${type}: ${terminalOutput}`)

        // 根据类型输出到终端
        switch (type) {
          case 'ERROR':
            originalConsoleError.apply(console, [terminalOutput])
            break
          case 'WARN':
            originalConsoleWarn.apply(console, [terminalOutput])
            break
          case 'INFO':
            originalConsoleInfo.apply(console, [terminalOutput])
            break
          default:
            originalConsoleLog.apply(console, [terminalOutput])
        }

        // 为页面日志添加时间戳和类型
        const timestamp = new Date().toLocaleTimeString()
        const message = `[${timestamp}] ${type}: ${terminalOutput}`

        // 保存到历史记录
        logHistory.push(message)
        if (logHistory.length > MAX_LOG_HISTORY) {
          logHistory = logHistory.slice(-MAX_LOG_HISTORY)
        }

        // 立即发送到渲染进程
        if (win && !win.isDestroyed()) {
          win.webContents.send('console-log', message)
        }
      } catch (error) {
        originalConsoleError.apply(console, ['Log handling error:', error])
        logToFile(`Error handling log: ${error}`)
      }
    }

    // 重写控制台方法
    console.log = (...args) => handleLog('LOG', args)
    console.error = (...args) => handleLog('ERROR', args)
    console.warn = (...args) => handleLog('WARN', args)
    console.info = (...args) => handleLog('INFO', args)

    // 添加进程异常处理
    process.on('uncaughtException', (error) => {
      handleLog('ERROR', [`Uncaught Exception: ${error.message}\n${error.stack}`])
    })

    process.on('unhandledRejection', (reason) => {
      handleLog('ERROR', [`Unhandled Rejection: ${reason}`])
    })

    // 添加 IPC 通信错误处理
    ipcMain.on('error', (event, error) => {
      handleLog('ERROR', [`IPC Error: ${error}`])
    })

  } catch (error) {
    console.error('Failed to setup console capture:', error)
    logToFile(`Failed to setup console capture: ${error}`)
  }
}

function createWindow() {
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

  // 先配置 session
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details;
    delete requestHeaders['Origin'];
    delete requestHeaders['Referer'];
    requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    requestHeaders['Accept'] = '*/*';
    requestHeaders['Cache-Control'] = 'no-cache';
    requestHeaders['Pragma'] = 'no-cache';
    callback({ requestHeaders });
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders } = details;
    delete responseHeaders['access-control-allow-origin'];
    delete responseHeaders['access-control-allow-methods'];
    delete responseHeaders['access-control-allow-headers'];
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    callback({ responseHeaders, statusLine: details.statusLine });
  })

  // 然后设置控制台输出捕获
  setupConsoleCapture(mainWindow)

  // 最后加载页面
  if (process.env.NODE_ENV === 'development') {
    const loadURL = async () => {
      try {
        await mainWindow.loadURL('http://localhost:3000')
        const devToolsEnabled = store.get('devToolsEnabled', false);
        if (!devToolsEnabled && mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        }
      } catch (error) {
        console.error('Failed to load URL:', error)
        console.log('Retrying in 1 second...')
        setTimeout(loadURL, 1000)
      }
    }
    loadURL()
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html')
    console.log('Loading index file from:', indexPath)
    logToFile(`Attempting to load index file from: ${indexPath}`)
    logToFile(`__dirname is: ${__dirname}`)
    logToFile(`File exists: ${fs.existsSync(indexPath)}`)
    
    // 添加文件内容检查
    if (fs.existsSync(indexPath)) {
      logToFile(`Index file contents: ${fs.readFileSync(indexPath, 'utf8').slice(0, 500)}...`)
    }

    mainWindow.loadFile(indexPath).catch(error => {
      console.error('Failed to load index.html:', error)
      logToFile(`Failed to load index.html: ${error}`)
    })

    mainWindow.webContents.openDevTools()

    // 添加更多错误处理
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      const error = `Page failed to load: ${errorCode} - ${errorDescription}`
      console.error(error)
      logToFile(error)
    })
  }

  // 其他事件监听器
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Console:', message)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })

  // 初始化代理服务器
  initProxyServer()
}

// 将代理服务器初始化移到单独的函数中
function initProxyServer() {
  const proxyServer = http.createServer(async (req, res) => {
    try {
      const url = req.url.slice(1)
      console.info('收到代理请求:', url)
      
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
      
      request.on('response', (response) => {
        console.info('代理请求响应状态:', response.statusCode)
      })
      
      request.on('error', (error) => {
        console.error('代理请求错误:', error.message)
      })
      
      request.on('timeout', () => {
        console.error('Request timeout')
        request.destroy()
        if (!res.headersSent) {
          res.writeHead(504)
          res.end('Request Timeout')
        }
      })
    } catch (error) {
      console.error('代理服务器错误:', error.message)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end('Server Error')
      }
    }
  })

  proxyServer.listen(0, '127.0.0.1', () => {
    proxyPort = proxyServer.address().port
    console.info('代理服务器启动成功，端口:', proxyPort)
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

// 添加新的 IPC 处理器用于获取历史日志
ipcMain.handle('get-logs', () => {
  return logHistory.join('\n')
})

// 添加清除日志的 IPC 处理器
ipcMain.handle('clear-logs', () => {
  logHistory = []
  return true
})

// Add this near other IPC handlers
ipcMain.handle('toggle-dev-tools', async (event, enabled) => {
  try {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      if (enabled) {
        window.webContents.openDevTools();
      } else {
        window.webContents.closeDevTools();
      }
      return { success: true };
    }
    return { error: 'No active window found' };
  } catch (error) {
    console.error('Error toggling dev tools:', error);
    return { error: error.message };
  }
}); 