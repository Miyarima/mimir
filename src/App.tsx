import { useState, useCallback, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import ResearchView from './components/ResearchView'
import SettingsPanel from './components/SettingsPanel'
import KnowledgeBase from './components/KnowledgeBase'
import { loadSettings, saveSettings, defaultSettings } from './store/settings'
import { runDeepResearch } from './services/research'
import type { Conversation, ResearchResult, ResearchStep, ResearchProgress, Settings, Skill, Message, Source } from './types'

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
    archived: false,
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
  const [skills, setSkills] = useState<Skill[]>([])
  const [ready, setReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false)
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

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem('mimir-skills', JSON.stringify(skills))
    } catch {}
  }, [skills, ready])

  useEffect(() => {
    document.documentElement.className = settings.theme === 'emerald' ? '' : `theme-${settings.theme}`
  }, [settings.theme])

  const checkConnection = useCallback(async () => {
    if (!settings.apiEndpoint) { setConnectionStatus('disconnected'); return }
    setConnectionStatus('checking')
    const base = settings.apiEndpoint.replace(/\/+$/, '')
    const urls = base.includes('/v1')
      ? [`${base}/models`, base.replace(/\/v1.*/, '')]
      : [`${base}/models`, `${base}/v1/models`, base]
    let ok = false
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
        })
        if (res.ok || res.status !== 0) { ok = true; break }
      } catch {}
    }
    setConnectionStatus(ok ? 'connected' : 'disconnected')
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
            setDraftId(generateId())
            setReady(true)
            return
          } catch {}
        }
      } else {
        const rows = await window.electronAPI.db.loadConversations()

        if (rows.length > 0) {
          const loaded: Conversation[] = await Promise.all(rows.map(async (r) => {
            const messages = await window.electronAPI.db!.loadMessages(r.id)
            return { ...r, messages }
          }))

            // Restore researchResult & archived from localStorage (not stored in DB)
            try {
              const stored = localStorage.getItem('mimir-conversations')
              if (stored) {
                const parsed: Conversation[] = JSON.parse(stored)
                for (const conv of loaded) {
                  const match = parsed.find(c => c.id === conv.id)
                  if (match?.researchResult) conv.researchResult = match.researchResult
                  if (match?.archived) conv.archived = true
                }
              }
            } catch {}

          setConversations(loaded)
        }
      }
      // Load skills
      if (!window.electronAPI?.db) {
        const skillStore = localStorage.getItem('mimir-skills')
        if (skillStore) {
          try { setSkills(JSON.parse(skillStore)) } catch {}
        }
      } else {
        const loadedSkills = await window.electronAPI.db.loadSkills()
        setSkills(loadedSkills)
      }

      setDraftId(generateId())
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
  const displayResearch: ResearchRun | undefined = activeResearch || (
    activeConv?.isResearch && activeConv?.researchResult
      ? {
          question: activeConv.researchResult.question,
          breadth: settings.researchBreadth,
          depth: settings.researchDepth,
          steps: activeConv.researchResult.steps,
          progress: null,
          liveResults: [],
          serpQueries: [],
          report: activeConv.researchResult.report,
          loading: false,
          error: null,
        }
      : undefined
  )

  const persistConversation = useCallback(async (conv: Conversation) => {
    if (!window.electronAPI?.db) return
    await window.electronAPI.db.updateConversation({ id: conv.id, messages: conv.messages })
  }, [])

  const handleNewConversation = useCallback(() => {
    const id = generateId()
    setDraftId(id)
    setActiveId(id)
    setShowSettings(false)
    setShowKnowledgeBase(false)
  }, [])

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveId(id)
    setDraftId(null)
    setShowSettings(false)
    setShowKnowledgeBase(false)
  }, [])

  const handleKnowledgeBase = useCallback(() => {
    setShowKnowledgeBase(true)
    setShowSettings(false)
    setDraftId(null)
    setActiveId(null)
  }, [])

  const handleCloseKnowledgeBase = useCallback(() => {
    setShowKnowledgeBase(false)
    setDraftId(generateId())
  }, [])

  const handleArchiveConversation = useCallback((id: string) => {
    setConversations(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, archived: !c.archived } : c)
      if (activeId === id) {
        setActiveId(null)
        setDraftId(generateId())
      }
      if (window.electronAPI?.db) {
        const conv = updated.find(c => c.id === id)
        if (conv) {
          window.electronAPI.db.updateConversation({ id, messages: conv.messages })
        }
      }
      return updated
    })
  }, [activeId])

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

  const handleSaveSkill = useCallback((skill: Skill) => {
    setSkills(prev => {
      const existing = prev.findIndex(s => s.id === skill.id)
      const updated = existing >= 0
        ? prev.map((s, i) => i === existing ? skill : s)
        : [...prev, skill]
      if (window.electronAPI?.db) {
        window.electronAPI.db.saveSkill(skill)
      }
      return updated
    })
  }, [])

  const handleDeleteSkill = useCallback((id: string) => {
    setSkills(prev => prev.filter(s => s.id !== id))
    if (window.electronAPI?.db) {
      window.electronAPI.db.deleteSkill(id)
    }
  }, [])

  const handleDraftSubmit = useCallback((question: string): Conversation => {
    const conv = createConversation(false)
    conv.title = question.slice(0, 40)
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
      skills,
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
        onArchive={handleArchiveConversation}
        onSettings={() => { setShowSettings(true); setShowKnowledgeBase(false) }}
        onKnowledgeBase={handleKnowledgeBase}
        showSettings={showSettings}
        showKnowledgeBase={showKnowledgeBase}
        sidebarOpen={sidebarOpen}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4"
                style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex min-w-0 items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h1 className="min-w-0 truncate text-sm font-medium text-foreground/90">
              {showKnowledgeBase ? 'Knowledge Base' : activeConv?.title || 'New conversation'}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
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
        ) : showKnowledgeBase ? (
          <KnowledgeBase
            conversations={conversations}
            skills={skills}
            settings={settings}
            onSelect={handleSelectConversation}
            onArchive={handleArchiveConversation}
            onSaveSkill={handleSaveSkill}
            onDeleteSkill={handleDeleteSkill}
            onClose={handleCloseKnowledgeBase}
          />
        ) : displayResearch ? (
          <ResearchView
            question={displayResearch.question}
            settings={settings}
            breadth={displayResearch.breadth}
            depth={displayResearch.depth}
            steps={displayResearch.steps}
            progress={displayResearch.progress}
            liveResults={displayResearch.liveResults}
            serpQueries={displayResearch.serpQueries}
            report={displayResearch.report}
            loading={displayResearch.loading}
            error={displayResearch.error}
            onCancel={handleCancelResearch}
          />
        ) : activeConv ? (
          <ChatView
            conversation={activeConv}
            settings={settings}
            skills={skills}
            connected={connectionStatus === 'connected'}
            onUpdateConversation={handleUpdateConversation}
            onRename={handleRenameConversation}
            onStartResearch={handleStartResearch}
          />
        ) : draftId ? (
          <ChatView
            conversation={null}
            settings={settings}
            skills={skills}
            connected={connectionStatus === 'connected'}
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
