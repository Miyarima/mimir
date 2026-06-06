import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { initDatabase, loadConversations, createConversation, updateConversation, renameConversation, deleteConversation, loadMessages, loadSettings, saveSetting } from './database'

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  await initDatabase()

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  mainWindow.on('closed', () => {
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
