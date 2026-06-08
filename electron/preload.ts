import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  fullscreen: () => ipcRenderer.send('window:fullscreen'),
  close: () => ipcRenderer.send('window:close'),

  db: {
    loadConversations: () => ipcRenderer.invoke('db:load-conversations'),
    loadMessages: (conversationId: string) => ipcRenderer.invoke('db:load-messages', conversationId),
    createConversation: (conv: { id: string; title: string; isResearch: boolean }) => ipcRenderer.invoke('db:create-conversation', conv),
    updateConversation: (conv: { id: string; messages: { id: string; role: string; content: string; sources?: unknown; timestamp: number }[] }) => ipcRenderer.invoke('db:update-conversation', conv),
    renameConversation: (id: string, title: string) => ipcRenderer.invoke('db:rename-conversation', id, title),
    deleteConversation: (id: string) => ipcRenderer.invoke('db:delete-conversation', id),
    loadSettings: () => ipcRenderer.invoke('db:load-settings'),
    saveSetting: (key: string, value: string) => ipcRenderer.invoke('db:save-setting', key, value),
    loadSkills: () => ipcRenderer.invoke('db:load-skills'),
    saveSkill: (skill: { id: string; name: string; description: string; instructions: string; enabled: boolean; createdAt: number; updatedAt: number }) => ipcRenderer.invoke('db:save-skill', skill),
    deleteSkill: (id: string) => ipcRenderer.invoke('db:delete-skill', id),
  },

  crawl4ai: {
    status: (endpoint?: string) => ipcRenderer.invoke('crawl4ai:status', endpoint),
    start: (endpoint?: string) => ipcRenderer.invoke('crawl4ai:start', endpoint),
    stop: () => ipcRenderer.invoke('crawl4ai:stop'),
    isStarting: () => ipcRenderer.invoke('crawl4ai:is-starting'),
  },
})
