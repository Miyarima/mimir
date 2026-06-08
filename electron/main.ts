import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron'
import path from 'path'
import { exec } from 'child_process'
import { initDatabase, loadConversations, createConversation, updateConversation, renameConversation, deleteConversation, loadMessages, loadSettings, saveSetting, loadSkills, saveSkill, deleteSkill } from './database'
import { checkStatus, startCrawl4AI, stopCrawl4AI, isStarting } from './crawl4ai'

let mainWindow: BrowserWindow | null = null

function checkDisplay(): Promise<boolean> {
  if (process.platform !== 'linux') return Promise.resolve(true)
  return new Promise(resolve => {
    exec('xdpyinfo -display :0 >/dev/null 2>&1', { timeout: 3000 }, err => {
      resolve(err === null)
    })
  })
}

async function createWindow() {
  await initDatabase()

  const displayOk = await checkDisplay()
  if (!displayOk) {
    dialog.showErrorBox(
      'Display Server Unavailable',
      'The X11/Wayland display server is not responding.\n\n' +
      'If you are using WSL, restart the WSL instance:\n' +
      '  1. Close this dialog\n' +
      '  2. In Windows PowerShell (as admin), run: wsl --shutdown\n' +
      '  3. Reopen your WSL terminal and launch Mimir again.\n\n' +
      'If this is not WSL, check that your display server is running.'
    )
    app.quit()
    return
  }

  // Auto-start Crawl4AI (if enabled in settings)
  try {
    const rawSettings = loadSettings()
    let autoStart = false
    if (rawSettings.settings) {
      try {
        const parsed = JSON.parse(rawSettings.settings)
        autoStart = parsed.autoStartCrawl4AI === true
      } catch {}
    }
    if (autoStart) {
      const status = await checkStatus()
      if (status.running) {
        console.log('Crawl4AI is already running')
      } else if (status.dockerAvailable) {
        console.log('Auto-starting Crawl4AI container…')
        startCrawl4AI().then(ok => {
          console.log(ok ? 'Crawl4AI started successfully' : 'Crawl4AI auto-start failed')
        })
      } else {
        console.log('Crawl4AI Docker container not available (install Docker or start manually)')
      }
    }
  } catch (e) {
    console.error('Crawl4AI check failed:', e)
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { x, y, width, height } = primaryDisplay.workArea

  mainWindow = new BrowserWindow({
    x: Math.round(x + (width - 1600) / 2),
    y: Math.round(y + (height - 900) / 2),
    width: 1600,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    hasShadow: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    backgroundColor: '#0a0a0a',
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  const windowTimeout = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    dialog.showErrorBox(
      'Window Failed to Appear',
      'The application window was created but did not become visible.\n\n' +
      'If you are using WSL, this usually means WSLg (the GUI subsystem)\n' +
      'has crashed. To fix it:\n' +
      '  1. Close this dialog and quit Mimir\n' +
      '  2. In Windows PowerShell (as admin), run: wsl --shutdown\n' +
      '  3. Reopen your WSL terminal and launch Mimir again.\n\n' +
      'If the problem persists, try restarting your Windows machine.'
    )
  }, 10000)

  mainWindow.on('show', () => {
    clearTimeout(windowTimeout)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    clearTimeout(windowTimeout)
  })

  mainWindow.on('closed', () => {
    clearTimeout(windowTimeout)
    mainWindow = null
  })

  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12' || (input.key === 'I' && input.control && input.shift)) {
      mainWindow?.webContents.toggleDevTools()
    }
    if (input.key === 'F11') {
      if (mainWindow?.isFullScreen()) {
        mainWindow.setFullScreen(false)
      } else {
        mainWindow?.setFullScreen(true)
      }
    }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:fullscreen', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', () => mainWindow?.close())

// Database IPC handlers
ipcMain.handle('db:load-conversations', () => {
  const rows = loadConversations()
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    isResearch: !!r.is_research,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    messages: [],
  }))
})

ipcMain.handle('db:load-messages', (_, conversationId: string) => {
  const rows = loadMessages(conversationId)
  return rows.map(r => ({
    id: r.id,
    role: r.role,
    content: r.content,
    timestamp: r.timestamp,
    sources: r.sources ? JSON.parse(r.sources) : undefined,
  }))
})

ipcMain.handle('db:create-conversation', (_, conv: { id: string; title: string; isResearch: boolean }) => {
  createConversation(conv.id, conv.title, conv.isResearch)
})

ipcMain.handle('db:update-conversation', (_, conv: { id: string; messages: { id: string; role: string; content: string; sources?: { title: string; url: string; snippet: string }[]; timestamp: number }[] }) => {
  updateConversation(conv.id, conv.messages.map(m => ({
    ...m,
    sources: m.sources ? JSON.stringify(m.sources) : null,
  })))
})

ipcMain.handle('db:rename-conversation', (_, id: string, title: string) => {
  renameConversation(id, title)
})

ipcMain.handle('db:delete-conversation', (_, id: string) => {
  deleteConversation(id)
})

ipcMain.handle('db:load-settings', () => {
  return loadSettings()
})

ipcMain.handle('db:save-setting', (_, key: string, value: string) => {
  saveSetting(key, value)
})

// Skills IPC handlers
ipcMain.handle('db:load-skills', () => {
  const rows = loadSkills()
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    instructions: r.instructions,
    enabled: !!r.enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
})

ipcMain.handle('db:save-skill', (_, skill: { id: string; name: string; description: string; instructions: string; enabled: boolean; createdAt: number; updatedAt: number }) => {
  saveSkill(skill)
})

ipcMain.handle('db:delete-skill', (_, id: string) => {
  deleteSkill(id)
})

// Crawl4AI IPC handlers
ipcMain.handle('crawl4ai:status', async (_, endpoint?: string) => {
  return checkStatus(endpoint)
})

ipcMain.handle('crawl4ai:start', async (_, endpoint?: string) => {
  return startCrawl4AI(endpoint)
})

ipcMain.handle('crawl4ai:stop', async () => {
  return stopCrawl4AI()
})

ipcMain.handle('crawl4ai:is-starting', () => {
  return isStarting()
})
