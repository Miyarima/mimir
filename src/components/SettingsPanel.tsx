import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, KeyRound, Brain, Globe, Database, SlidersHorizontal, ChevronRight, Layers, GitBranch, Container, Play, Square, Loader2, RefreshCw } from 'lucide-react'
import type { Crawl4AIStatus, Settings } from '../types'

interface SettingsPanelProps {
  settings: Settings
  onUpdate: (settings: Settings) => void
  onClose: () => void
}

type SettingKey = keyof Settings

export default function SettingsPanel({ settings, onUpdate, onClose }: SettingsPanelProps) {
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const providerRef = useRef<HTMLDivElement>(null)

  const update = (key: SettingKey, value: string | number | boolean) => {
    onUpdate({ ...settings, [key]: value })
  }

  useEffect(() => {
    if (!modelDropdownOpen) return
    const close = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [modelDropdownOpen])

  useEffect(() => {
    if (!providerOpen) return
    const close = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setProviderOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [providerOpen])

  useEffect(() => {
    if (!settings.apiEndpoint) return
    let cancelled = false
    setLoadingModels(true)
    const base = settings.apiEndpoint.replace(/\/+$/, '')
    const urls = base.includes('/v1')
      ? [`${base}/models`]
      : [`${base}/api/v1/models`, `${base}/v1/models`, `${base}/models`]
    ;(async () => {
      const started = Date.now()
      for (const url of urls) {
        if (cancelled) return
        try {
          const controller = new AbortController()
          const to = setTimeout(() => controller.abort(), 5000)
          const res = await fetch(url, {
            signal: controller.signal,
            headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
          })
          clearTimeout(to)
          if (cancelled) return
          if (!res.ok) continue
          const data = await res.json()
          const raw = data.data || data.models || data
          const ids = (Array.isArray(raw) ? raw : [])
            .map((m: any) => (typeof m === 'string' ? m : m.id || m.name))
            .filter(Boolean)
          if (ids.length > 0) { setModels(ids); break }
        } catch (e) {
          console.error('fetch models error:', url, e)
        }
      }
      const elapsed = Date.now() - started
      if (elapsed < 350) await new Promise(r => setTimeout(r, 350 - elapsed))
      if (!cancelled) setLoadingModels(false)
    })()
    return () => { cancelled = true }
  }, [settings.apiEndpoint, settings.apiKey])

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <header className="flex h-14 items-center gap-3 border-b border-border px-4">
        <button onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-medium text-foreground/90">Settings</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          {/* Model */}
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Brain className="h-3.5 w-3.5" />
              Model
            </h2>
            <div className="rounded-2xl border border-border bg-card/60">
               <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground/90">API Endpoint</span>
                    {loadingModels && <Loader2 size={12} className="animate-spin text-primary/70" />}
                  </div>
                  <input type="text"
                         onChange={e => update('apiEndpoint', e.target.value)}
                         placeholder={settings.apiEndpoint || 'http://localhost:11434/v1'}
                         className="mt-0.5 w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                </div>
              </div>
              <div className="mx-4 h-px bg-border" />
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Brain className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground/90">
                    Model
                    {loadingModels && <span className="ml-2 text-[10px] text-muted-foreground animate-pulse">fetching…</span>}
                    {!loadingModels && models.length > 0 && <span className="ml-2 text-[10px] text-emerald-500">{models.length} loaded</span>}
                  </span>
                  <div className="relative mt-1">
                    <button onClick={() => setModelDropdownOpen(v => !v)}
                            className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer">
                      <span className={settings.model ? '' : 'text-muted-foreground/50'}>{settings.model || 'No model selected'}</span>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${modelDropdownOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {modelDropdownOpen && (
                      <div ref={modelDropdownRef}
                           className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                        {loadingModels ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Loading models…</div>
                        ) : (
                          <>
                            {models.length === 0 && (
                              <div className="px-3 py-2 text-xs text-muted-foreground">No models found</div>
                            )}
                            {models.map(m => (
                              <button key={m} onClick={() => { update('model', m); setModelDropdownOpen(false) }}
                                      className={`flex w-full items-center px-3 py-1.5 text-left text-xs transition ${
                                        settings.model === m ? 'bg-accent text-accent-foreground' : 'text-foreground/80 hover:bg-secondary'
                                      }`}>
                                {m}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mx-4 h-px bg-border" />
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground/90">API Key</span>
                  <input type="password" value={settings.apiKey}
                         onChange={e => update('apiKey', e.target.value)}
                         placeholder="sk-... (optional for local)"
                         className="mt-0.5 w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                </div>
              </div>
            </div>
          </section>

          {/* Search */}
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              Search
            </h2>
            <div className="rounded-2xl border border-border bg-card/60">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Globe className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground/90">Provider</span>
                  <div className="relative mt-1">
                    <button onClick={() => setProviderOpen(v => !v)}
                            className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer">
                      <span>{ { duckduckgo: 'DuckDuckGo (Free)', tavily: 'Tavily API', searxng: 'SearXNG (Self-hosted)' }[settings.searchProvider] }</span>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${providerOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {providerOpen && (
                      <div ref={providerRef}
                           className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                        {([['duckduckgo', 'DuckDuckGo (Free)'], ['tavily', 'Tavily API'], ['searxng', 'SearXNG (Self-hosted)']] as const).map(([value, label]) => (
                          <button key={value} onClick={() => { update('searchProvider', value); setProviderOpen(false) }}
                                  className={`flex w-full items-center px-3 py-1.5 text-left text-xs transition ${
                                    settings.searchProvider === value ? 'bg-accent text-accent-foreground' : 'text-foreground/80 hover:bg-secondary'
                                  }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {settings.searchProvider !== 'duckduckgo' && (
                <>
                  <div className="mx-4 h-px bg-border" />
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <Globe className="h-4 w-4" />
                    </span>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium text-foreground/90">Search Endpoint</span>
                      <input type="text" value={settings.searchEndpoint}
                             onChange={e => update('searchEndpoint', e.target.value)}
                             placeholder={settings.searchProvider === 'tavily' ? 'https://api.tavily.com/search' : 'http://localhost:8888'}
                             className="mt-0.5 w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Research */}
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              Research
            </h2>
            <div className="rounded-2xl border border-border bg-card/60">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground/90">Breadth</span>
                  <span className="text-xs text-muted-foreground">Search queries per level (2–10)</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1">
                  <button onClick={() => update('researchBreadth', Math.max(2, settings.researchBreadth - 1))}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground text-sm">−</button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums text-foreground">{settings.researchBreadth}</span>
                  <button onClick={() => update('researchBreadth', Math.min(10, settings.researchBreadth + 1))}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground text-sm">+</button>
                </div>
              </div>
              <div className="mx-4 h-px bg-border" />
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Layers className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground/90">Depth</span>
                  <span className="text-xs text-muted-foreground">Recursive deepening levels (1–5)</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1">
                  <button onClick={() => update('researchDepth', Math.max(1, settings.researchDepth - 1))}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground text-sm">−</button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums text-foreground">{settings.researchDepth}</span>
                  <button onClick={() => update('researchDepth', Math.min(5, settings.researchDepth + 1))}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground text-sm">+</button>
                </div>
              </div>
            </div>
          </section>

          {/* Crawl4AI */}
          <Crawl4AISection settings={settings} onUpdate={update} />
        </div>
      </main>
    </div>
  )
}

function Crawl4AISection({ settings, onUpdate }: { settings: Settings; onUpdate: (key: SettingKey, value: string | number | boolean) => void }) {
  const [status, setStatus] = useState<Crawl4AIStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [endpointOk, setEndpointOk] = useState<boolean | null>(null)

  const checkEndpoint = useCallback(async (ep: string) => {
    if (!ep) { setEndpointOk(null); return }
    setEndpointOk(null)
    try {
      const url = ep.replace(/\/+$/, '')
      await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000) })
      setEndpointOk(true)
    } catch {
      setEndpointOk(false)
    }
  }, [])

  const check = async () => {
    if (window.electronAPI?.crawl4ai) {
      const [s, starting] = await Promise.all([
        window.electronAPI.crawl4ai.status(settings.crawl4aiEndpoint),
        window.electronAPI.crawl4ai.isStarting(),
      ])
      setStatus(starting ? { ...s, starting: true } : s)
    } else {
      try {
        const ep = settings.crawl4aiEndpoint.replace(/\/+$/, '')
        await fetch(ep, { method: 'POST', signal: AbortSignal.timeout(5000) })
        setStatus({ running: true, dockerAvailable: false, containerExists: false, starting: false, endpoint: ep })
      } catch {
        setStatus({ running: false, dockerAvailable: false, containerExists: false, starting: false, endpoint: settings.crawl4aiEndpoint })
      }
    }
  }

  useEffect(() => {
    check()
    checkEndpoint(settings.crawl4aiEndpoint)
    const t = setInterval(check, 10000)
    return () => clearInterval(t)
  }, [settings.crawl4aiEndpoint])

  useEffect(() => {
    if (status?.starting) {
      const t = setInterval(check, 2000)
      return () => clearInterval(t)
    }
  }, [status?.starting])

  const handleStart = async () => {
    if (!window.electronAPI?.crawl4ai) return
    setStarting(true)
    await window.electronAPI.crawl4ai.start(settings.crawl4aiEndpoint)
    await check()
    setStarting(false)
  }

  const handleStop = async () => {
    if (!window.electronAPI?.crawl4ai) return
    await window.electronAPI.crawl4ai.stop()
    await check()
  }

  const statusDot = !status ? (window.electronAPI?.crawl4ai ? 'bg-muted-foreground' : 'bg-muted-foreground/40') : status.starting ? 'bg-primary animate-pulse' : status.running ? 'bg-primary shadow-glow' : 'bg-destructive'
  const statusLabel = !status ? (window.electronAPI?.crawl4ai ? 'Checking…' : 'Desktop app only') : status.starting ? 'Starting…' : status.running ? 'Running' : status.dockerAvailable ? 'Stopped' : window.electronAPI?.crawl4ai ? 'Docker not found' : 'Not reachable'

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Container className="h-3.5 w-3.5" />
        Crawl4AI
      </h2>
      <div className="rounded-2xl border border-border bg-card/60">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Globe className="h-4 w-4" />
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium text-foreground/90">Crawl4AI Endpoint</span>
            <div className="flex items-center gap-1.5">
              <input type="text" value={settings.crawl4aiEndpoint}
                     onChange={e => onUpdate('crawl4aiEndpoint', e.target.value)}
                     placeholder="http://localhost:8000"
                     className="flex-1 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
              <span className={`flex shrink-0 items-center gap-1.5 text-xs ${endpointOk !== null ? (endpointOk ? 'text-primary/70' : 'text-destructive/70') : 'text-muted-foreground/50'}`}>
                {endpointOk !== null ? (
                  <span className={`h-2 w-2 rounded-full ${endpointOk ? 'bg-primary' : 'bg-destructive'}`} />
                ) : (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                <span>{endpointOk !== null ? (endpointOk ? 'Reachable' : 'Unreachable') : 'Checking'}</span>
              </span>
              <button onClick={() => checkEndpoint(settings.crawl4aiEndpoint)}
                      className="flex shrink-0 items-center rounded-md border border-border p-1.5 text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground/80"
                      title="Check endpoint">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="mx-4 h-px bg-border" />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium text-foreground/90">Status</span>
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          </div>
          {window.electronAPI?.crawl4ai && (
            <div className="flex gap-1.5">
              {!status?.running && status?.dockerAvailable && (
                <button onClick={handleStart} disabled={starting}
                        className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground transition hover:bg-secondary disabled:opacity-50">
                  {starting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  Start
                </button>
              )}
              {status?.running && (
                <button onClick={handleStop}
                        className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground transition hover:bg-secondary">
                  <Square className="h-3 w-3" />
                  Stop
                </button>
              )}
            </div>
          )}
        </div>
        <div className="mx-4 h-px bg-border" />
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Play className="h-4 w-4" />
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium text-foreground/90">Auto-start on launch</span>
            <span className="text-xs text-muted-foreground">Start Crawl4AI container automatically when Mimir opens</span>
          </div>
          <button onClick={() => onUpdate('autoStartCrawl4AI', !settings.autoStartCrawl4AI)}
                  className={`relative h-6 w-10 rounded-full transition-colors ${
                    settings.autoStartCrawl4AI ? 'bg-primary' : 'bg-border'
                  }`}>
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow-soft transition-transform ${
              settings.autoStartCrawl4AI ? 'translate-x-4' : ''
            }`} />
          </button>
        </div>
      </div>
    </section>
  )
}
