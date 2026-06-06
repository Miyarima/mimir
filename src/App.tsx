import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import ResearchView from './components/ResearchView'
import SettingsPanel from './components/SettingsPanel'
import { loadSettings, saveSettings } from './store/settings'
import type { Conversation, ResearchResult, Settings, Message } from './types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function createConversation(isResearch = false): Conversation {
  return {
    id: generateId(),
    title: 'New conversation',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isResearch,
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('mimir-settings')
    if (saved) {
      try { return JSON.parse(saved) } catch {}
    }
    return {
      apiEndpoint: 'http://localhost:11434/v1',
      apiKey: '',
      model: '',
      searchProvider: 'duckduckgo',
      searchEndpoint: '',
      maxResearchSteps: 5,
    }
  })
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [ready, setReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [researchQuestion, setResearchQuestion] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    let cancelled = false
    async function check() {
      setConnectionStatus('checking')
      try {
        const res = await fetch(settings.apiEndpoint.replace(/\/+$/, '') + '/models', {
          signal: AbortSignal.timeout(5000),
          headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
        })
        if (!cancelled) setConnectionStatus(res.ok ? 'connected' : 'disconnected')
      } catch {
        if (!cancelled) setConnectionStatus('disconnected')
      }
    }
    check()
    return () => { cancelled = true }
  }, [settings.apiEndpoint, settings.apiKey])

  useEffect(() => {
    async function init() {
      if (!window.electronAPI?.db) {
        const stored = localStorage.getItem('mimir-conversations')
        if (stored) {
          try {
            const parsed: Conversation[] = JSON.parse(stored)
            setConversations(parsed)
            setActiveId(parsed[0]?.id || createConversation().id)
            setReady(true)
            return
          } catch {}
        }
        const conv = createConversation()
        setConversations([conv])
        setActiveId(conv.id)
        setReady(true)
        return
      }

      const rows = await window.electronAPI.db.loadConversations()

      if (rows.length === 0) {
        const conv = createConversation()
        await window.electronAPI.db.createConversation({ id: conv.id, title: conv.title, isResearch: false })
        setConversations([conv])
        setActiveId(conv.id)
      } else {
        const loaded: Conversation[] = await Promise.all(rows.map(async (r) => {
          const messages = await window.electronAPI.db!.loadMessages(r.id)
          return { ...r, messages }
        }))
        setConversations(loaded)
        setActiveId(loaded[0].id)
      }
      setReady(true)
    }
    init()
  }, [])

  useEffect(() => {
    if (!ready) return
    const data = JSON.stringify(conversations)
    try {
      localStorage.setItem('mimir-conversations', data)
    } catch {}
  }, [conversations, ready])

  const activeConv = conversations.find(c => c.id === activeId)

  const persistConversation = useCallback(async (conv: Conversation) => {
    if (!window.electronAPI?.db) return
    await window.electronAPI.db.updateConversation({ id: conv.id, messages: conv.messages })
  }, [])

  const handleNewConversation = useCallback(() => {
    const conv = createConversation()
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
    setShowSettings(false)
    setResearchQuestion(null)
    if (window.electronAPI?.db) {
      window.electronAPI.db.createConversation({ id: conv.id, title: conv.title, isResearch: false })
    }
  }, [])

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveId(id)
    setShowSettings(false)
    setResearchQuestion(null)
  }, [])

  const handleDeleteConversation = useCallback(async (id: string) => {
    if (window.electronAPI?.db) {
      await window.electronAPI.db.deleteConversation(id)
    }
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id)
      if (activeId === id) {
        const nextId = filtered[0]?.id || createConversation().id
        setActiveId(nextId)
        if (!filtered[0]) {
          const fresh = createConversation()
          if (window.electronAPI?.db) {
            window.electronAPI.db.createConversation({ id: fresh.id, title: fresh.title, isResearch: false })
          }
          filtered.push(fresh)
        }
      }
      return filtered
    })
  }, [activeId])

  const handleUpdateConversation = useCallback((conv: Conversation) => {
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, messages: conv.messages, updatedAt: Date.now() } : c))
    persistConversation({ ...conv, messages: conv.messages })
  }, [persistConversation])

  const handleRenameConversation = useCallback(async (id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
    if (window.electronAPI?.db) {
      await window.electronAPI.db.renameConversation(id, title)
    }
  }, [])

  const handleStartResearch = useCallback((question: string) => {
    const conv = createConversation(true)
    conv.title = `Research: ${question.slice(0, 40)}`
    conv.messages.push({
      id: generateId(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    })
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
    setResearchQuestion(question)
    if (window.electronAPI?.db) {
      window.electronAPI.db.createConversation({ id: conv.id, title: conv.title, isResearch: true })
    }
  }, [])

  const handleResearchComplete = useCallback((result: ResearchResult) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeId) return c
      return {
        ...c,
        researchResult: result,
        messages: [
          ...c.messages,
          {
            id: generateId(),
            role: 'assistant',
            content: result.report,
            timestamp: Date.now(),
            sources: result.sources,
          },
        ],
      }
    }))
    setResearchQuestion(null)
  }, [activeId])

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background text-foreground">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        onRename={handleRenameConversation}
        onSettings={() => setShowSettings(true)}
        showSettings={showSettings}
        sidebarOpen={sidebarOpen}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4"
                style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h1 className="text-sm font-medium text-foreground/90">
              {activeConv?.title || 'New conversation'}
            </h1>
          </div>

          <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
                Connected
              </div>
            )}
            {connectionStatus === 'checking' && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                Checking…
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                Disconnected
              </div>
            )}
            <div className="ml-2 flex items-center gap-0.5">
              <button onClick={() => window.electronAPI?.minimize()}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-[0.92] transition-all">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
              </button>
              <button onClick={() => window.electronAPI?.fullscreen()}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-[0.92] transition-all">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              </button>
              <button onClick={() => window.electronAPI?.close()}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive active:scale-[0.92] transition-all">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {showSettings ? (
          <SettingsPanel
            settings={settings}
            onUpdate={setSettings}
            onClose={() => setShowSettings(false)}
          />
        ) : researchQuestion ? (
          <ResearchView
            question={researchQuestion}
            settings={settings}
            onComplete={handleResearchComplete}
            onCancel={() => setResearchQuestion(null)}
          />
        ) : activeConv ? (
          <ChatView
            conversation={activeConv}
            settings={settings}
            onUpdateConversation={handleUpdateConversation}
            onRename={handleRenameConversation}
            onStartResearch={handleStartResearch}
          />
        ) : null}
      </main>
    </div>
  )
}
