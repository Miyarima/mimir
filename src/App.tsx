import { useState, useCallback, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import ResearchView from './components/ResearchView'
import SettingsPanel from './components/SettingsPanel'
import { loadSettings, saveSettings, defaultSettings } from './store/settings'
import { runDeepResearch } from './services/research'
import type { Conversation, ResearchResult, ResearchStep, ResearchProgress, Settings, Message, Source } from './types'

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

interface ResearchRun {
  question: string
  breadth: number
  depth: number
  steps: ResearchStep[]
  progress: ResearchProgress | null
  liveResults: { query: string; sources: Source[] }[]
  serpQueries: string[]
  report: string
  loading: boolean
  error: string | null
}

export default function App() {
  const [settings, setSettings] = useState<Settings>({ ...defaultSettings })
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [ready, setReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [researchRuns, setResearchRuns] = useState<Record<string, ResearchRun>>({})
  const settingsLoaded = useRef(false)
  const cancelledRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!settingsLoaded.current) return
    saveSettings(settings)
  }, [settings])

  const checkConnection = useCallback(async () => {
    setConnectionStatus('checking')
    try {
      const res = await fetch(settings.apiEndpoint.replace(/\/+$/, '') + '/models', {
        signal: AbortSignal.timeout(5000),
        headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
      })
      setConnectionStatus(res.ok ? 'connected' : 'disconnected')
    } catch {
      setConnectionStatus('disconnected')
    }
  }, [settings.apiEndpoint, settings.apiKey])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  useEffect(() => {
    async function init() {
      const savedSettings = await loadSettings()
      setSettings(savedSettings)
      settingsLoaded.current = true

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
  const activeResearch = activeId ? researchRuns[activeId] : undefined

  const persistConversation = useCallback(async (conv: Conversation) => {
    if (!window.electronAPI?.db) return
    await window.electronAPI.db.updateConversation({ id: conv.id, messages: conv.messages })
  }, [])

  const handleNewConversation = useCallback(() => {
    const id = generateId()
    setDraftId(id)
    setActiveId(id)
    setShowSettings(false)
  }, [])

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveId(id)
    setDraftId(null)
    setShowSettings(false)
  }, [])

  const handleDeleteConversation = useCallback(async (id: string) => {
    cancelledRef.current.add(id)
    if (window.electronAPI?.db) {
      await window.electronAPI.db.deleteConversation(id)
    }
    setResearchRuns(prev => { const m = { ...prev }; delete m[id]; return m })
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

  const handleDraftSubmit = useCallback((question: string): Conversation => {
    const conv = createConversation(false)
    conv.title = question.slice(0, 40)
    conv.messages.push({
      id: generateId(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    })
    setDraftId(null)
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
    if (window.electronAPI?.db) {
      window.electronAPI.db.createConversation({ id: conv.id, title: conv.title, isResearch: false })
    }
    return conv
  }, [])

  const handleStartResearch = useCallback((question: string, breadth?: number, depth?: number) => {
    const conv = createConversation(true)
    conv.title = `Research: ${question.slice(0, 40)}`
    conv.messages.push({
      id: generateId(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    })
    setDraftId(null)
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
    if (window.electronAPI?.db) {
      window.electronAPI.db.createConversation({ id: conv.id, title: conv.title, isResearch: true })
    }

    const run: ResearchRun = {
      question,
      breadth: breadth ?? settings.researchBreadth,
      depth: depth ?? settings.researchDepth,
      steps: [],
      progress: null,
      liveResults: [],
      serpQueries: [],
      report: '',
      loading: true,
      error: null,
    }
    setResearchRuns(prev => ({ ...prev, [conv.id]: run }))

    // Start research in background
    const convId = conv.id
    cancelledRef.current.delete(convId)

    runDeepResearch(
      question,
      settings,
      (step) => {
        if (cancelledRef.current.has(convId)) return
        setResearchRuns(prev => {
          const r = prev[convId]
          if (!r) return prev
          return { ...prev, [convId]: { ...r, steps: [...r.steps, step] } }
        })
      },
      (chunk) => {},
      (query, sources) => {
        if (cancelledRef.current.has(convId)) return
        setResearchRuns(prev => {
          const r = prev[convId]
          if (!r) return prev
          return { ...prev, [convId]: { ...r, liveResults: [...r.liveResults, { query, sources }] } }
        })
      },
      (p) => {
        if (cancelledRef.current.has(convId)) return
        setResearchRuns(prev => {
          const r = prev[convId]
          if (!r) return prev
          return { ...prev, [convId]: { ...r, progress: p } }
        })
      },
      (queries) => {
        if (cancelledRef.current.has(convId)) return
        setResearchRuns(prev => {
          const r = prev[convId]
          if (!r) return prev
          return { ...prev, [convId]: { ...r, serpQueries: queries } }
        })
      },
    ).then(result => {
      if (cancelledRef.current.has(convId)) return

      // Keep the run with completed state so ResearchView stays visible
      setResearchRuns(prev => {
        const r = prev[convId]
        if (!r) return prev
        return { ...prev, [convId]: { ...r, loading: false, report: result.report } }
      })

      // Update conversation with result
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c
        return {
          ...c,
          researchResult: result,
          messages: [
            ...c.messages,
            {
              id: generateId(),
              role: 'assistant' as const,
              content: result.report,
              timestamp: Date.now(),
              sources: result.sources,
            },
          ],
        }
      }))

      // AI title generation
      const base = settings.apiEndpoint.replace(/\/+$/, '')
      const url = (base.includes('/v1') ? base : base + '/v1') + '/chat/completions'
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [{
            role: 'user',
            content: `Give me a 2-5 word title summarizing the topic of this research report. Do NOT answer the question. ONLY output the short title.

Research question: ${question}
Key findings: ${result.report.slice(0, 1000)}

Short title (2-5 words, no quotes, no punctuation, no explanation):`,
          }],
          stream: false,
        }),
      }).then(async r => {
        const data = await r.json()
        const title = data.choices?.[0]?.message?.content?.trim()
        if (title) {
          const clean = title.replace(/[""''"]/g, '').slice(0, 60)
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: clean } : c))
          if (window.electronAPI?.db) {
            window.electronAPI.db.renameConversation(convId, clean)
          }
        }
      }).catch(() => {})
    }).catch((err) => {
      if (cancelledRef.current.has(convId)) return
      setResearchRuns(prev => {
        const r = prev[convId]
        if (!r) return prev
        return { ...prev, [convId]: { ...r, loading: false, error: err instanceof Error ? err.message : String(err) } }
      })
    })
  }, [settings])

  const handleCancelResearch = useCallback(() => {
    if (activeId) {
      cancelledRef.current.add(activeId)
      setResearchRuns(prev => { const m = { ...prev }; delete m[activeId]; return m })
      setConversations(prev => prev.filter(c => c.id !== activeId))
      if (window.electronAPI?.db) {
        window.electronAPI.db.deleteConversation(activeId)
      }
    }
    setActiveId(null)
    setDraftId(generateId())
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
              <button onClick={checkConnection}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition hover:border-destructive/50 hover:text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                Disconnected — retry
              </button>
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
        ) : activeResearch ? (
          <ResearchView
            question={activeResearch.question}
            settings={settings}
            breadth={activeResearch.breadth}
            depth={activeResearch.depth}
            steps={activeResearch.steps}
            progress={activeResearch.progress}
            liveResults={activeResearch.liveResults}
            serpQueries={activeResearch.serpQueries}
            report={activeResearch.report}
            loading={activeResearch.loading}
            error={activeResearch.error}
            onCancel={handleCancelResearch}
          />
        ) : activeConv ? (
          <ChatView
            conversation={activeConv}
            settings={settings}
            onUpdateConversation={handleUpdateConversation}
            onRename={handleRenameConversation}
            onStartResearch={handleStartResearch}
          />
        ) : draftId ? (
          <ChatView
            conversation={null}
            settings={settings}
            onUpdateConversation={handleUpdateConversation}
            onRename={handleRenameConversation}
            onStartResearch={handleStartResearch}
            onDraftSubmit={handleDraftSubmit}
          />
        ) : null}
      </main>
    </div>
  )
}
