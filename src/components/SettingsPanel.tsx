import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, KeyRound, Brain, Globe, Database, SlidersHorizontal, ChevronRight } from 'lucide-react'
import type { Settings } from '../types'

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

  const update = (key: SettingKey, value: string | number) => {
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
                  <span className="text-sm font-medium text-foreground/90">API Endpoint</span>
                  <input type="text" value={settings.apiEndpoint}
                         onChange={e => update('apiEndpoint', e.target.value)}
                         placeholder="http://localhost:11434/v1"
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
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground/90">Max Research Steps</span>
                  <span className="text-xs text-muted-foreground">Number of search queries per research</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1">
                  <button onClick={() => update('maxResearchSteps', Math.max(1, settings.maxResearchSteps - 1))}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground text-sm">−</button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums text-foreground">{settings.maxResearchSteps}</span>
                  <button onClick={() => update('maxResearchSteps', Math.min(10, settings.maxResearchSteps + 1))}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground text-sm">+</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
