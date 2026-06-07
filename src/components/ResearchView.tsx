import { useRef, useEffect, useState } from 'react'
import { Search, Loader2, BookOpen, ExternalLink, CheckCircle, ChevronDown, ChevronRight, X, Globe, Layers, GitBranch, Sparkles } from 'lucide-react'
import type { ResearchStep, Settings, Source, ResearchProgress } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F\u00AD\u200B-\u200D\uFEFF\u2060-\u2064\u2066-\u2069]/g, '')
}

type TimelineEntry =
  | { type: 'queries'; queries: string[]; depth: number; breadth: number }
  | { type: 'sources'; query: string; sources: Source[] }
  | { type: 'step_complete'; step: number; query: string; learnings: string[]; sources: Source[] }
  | { type: 'complete'; count: number }

interface ResearchViewProps {
  question: string
  settings: Settings
  breadth: number
  depth: number
  steps: ResearchStep[]
  progress: ResearchProgress | null
  liveResults: { query: string; sources: Source[] }[]
  serpQueries: string[]
  report: string
  loading: boolean
  error: string | null
  onCancel: () => void
}

export default function ResearchView({
  question, settings, breadth, depth,
  steps, progress, liveResults, serpQueries, report, loading, error,
  onCancel,
}: ResearchViewProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && report) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (loading && loadingRef.current && scrollRef.current) {
      const c = scrollRef.current
      const l = loadingRef.current
      const cr = c.getBoundingClientRect()
      const target = l.getBoundingClientRect().top - cr.top + c.scrollTop - cr.height * 0.6
      c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  })

  const timeline: TimelineEntry[] = []

  if (serpQueries.length > 0) {
    timeline.push({ type: 'queries', queries: serpQueries, depth, breadth })
  }

  for (const lr of liveResults) {
    timeline.push({ type: 'sources', query: lr.query, sources: lr.sources })
  }

  for (const step of steps) {
    timeline.push({
      type: 'step_complete',
      step: step.step,
      query: step.query,
      learnings: step.learnings,
      sources: step.sources,
    })
  }

  if (!loading && !error && report) {
    timeline.push({ type: 'complete', count: steps.length })
  }

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(step)) next.delete(step)
      else next.add(step)
      return next
    })
  }

  function renderTimelineDot(entry: TimelineEntry) {
    const cls = 'z-10 flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-background'
    if (entry.type === 'queries') return <div className={`${cls} bg-primary/15 text-primary`}><Sparkles size={14} /></div>
    if (entry.type === 'sources') return <div className={`${cls} bg-sky-500/15 text-sky-400`}><Search size={14} /></div>
    if (entry.type === 'step_complete') return <div className={`${cls} bg-emerald-500/15 text-emerald-400`}><CheckCircle size={14} /></div>
    if (entry.type === 'complete') return <div className={`${cls} bg-emerald-500/15 text-emerald-400`}><CheckCircle size={14} /></div>
    return <div className={`${cls} bg-muted text-muted-foreground`}><Loader2 size={14} className="animate-spin" /></div>
  }

  function renderTimelineContent(entry: TimelineEntry) {
    switch (entry.type) {
      case 'queries':
        return (
          <div>
            <p className="text-sm font-medium text-foreground">Generated {entry.queries.length} search queries</p>
            <p className="text-xs text-muted-foreground mt-0.5">Depth {entry.depth} · Breadth {entry.breadth}</p>
            <div className="mt-2 space-y-1">
              {entry.queries.map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="font-mono font-medium text-foreground/60 w-4 shrink-0 text-right">{i + 1}.</span>
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>
        )
      case 'sources':
        return (
          <div>
            <p className="text-sm font-medium text-foreground">Found {entry.sources.length} results</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/40 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                  <Globe size={10} />
                  <span className="max-w-[140px] truncate">{(() => { try { return new URL(s.url).hostname.replace('www.', '') } catch { return s.url } })()}</span>
                </a>
              ))}
            </div>
          </div>
        )
      case 'step_complete':
        return (
          <div>
            <p className="text-sm font-medium text-foreground">Step {entry.step}: {entry.query}</p>
            {entry.learnings.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {entry.learnings.map((l, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-emerald-400/60 mt-1 shrink-0">•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            )}
            {entry.sources.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {entry.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                    <ExternalLink size={10} />
                    <span className="max-w-[140px] truncate">{s.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      case 'complete':
        return (
          <div>
            <p className="text-sm font-medium text-emerald-400">Research complete</p>
            <p className="text-xs text-muted-foreground mt-0.5">{entry.count} steps completed</p>
          </div>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-surface ring-1 ring-border shadow-soft">
            <Search size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-foreground">Deep Research</h2>
            <p className="text-xs text-muted-foreground truncate">{question}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <button onClick={onCancel}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground">
              <X size={12} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl">

          {/* Depth/Breadth meter */}
          {loading && progress && (
            <div className="mb-5 flex items-center gap-4 px-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Layers size={14} className="text-primary/70" />
                <span>Depth <strong className="text-foreground">{progress.currentDepth}/{progress.totalDepth}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GitBranch size={14} className="text-primary/70" />
                <span>Breadth <strong className="text-foreground">{progress.currentBreadth}/{progress.totalBreadth}</strong></span>
              </div>
              {progress.totalQueries > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Search size={14} className="text-primary/70" />
                  <span>Queries <strong className="text-foreground">{progress.completedQueries}/{progress.totalQueries}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Timeline — hidden once report is ready */}
          {(!report || loading) && (
          <div className="relative">
            {timeline.length === 0 && loading && (
              <div>
                <div className="flex gap-3 pb-5">
                  <div className="flex w-7 shrink-0 items-start pt-1">
                    <div className="h-7 w-7 rounded-full bg-muted animate-pulse ring-2 ring-background" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 animate-pulse min-h-[146px]" />
                  </div>
                </div>
                <div className="flex gap-3 pb-5">
                  <div className="flex w-7 shrink-0 items-start pt-1">
                    <div className="h-7 w-7 rounded-full bg-muted animate-pulse ring-2 ring-background" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="rounded-xl border border-primary/20 bg-card/60 p-3.5 animate-pulse min-h-[46px]" />
                  </div>
                </div>
              </div>
            )}

            {timeline.length > 0 && (
              <div className="relative">
                <div className="absolute left-[14px] top-3 bottom-0 w-px bg-border" />

                {timeline.map((entry, i) => (
                  <div key={i} className="flex gap-3 pb-5 last:pb-0">
                    <div className="relative flex w-7 shrink-0 items-start pt-1">
                      {renderTimelineDot(entry)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`rounded-xl border ${entry.type === 'step_complete' ? 'border-border bg-card' : entry.type === 'sources' ? 'border-primary/20 bg-card/60' : 'border-border/60 bg-card/40'} p-3.5`}>
                        {renderTimelineContent(entry)}
                      </div>
                    </div>
                  </div>
                ))}

            {/* Current stage loading indicator — always rendered when loading */}
            {timeline.length > 0 && loading && (
              <div ref={loadingRef} className="flex gap-3">
                <div className="flex w-7 shrink-0 flex-col items-center">
                  <div className="relative z-10 pt-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-background bg-muted text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1 w-7 bg-background -mt-[31px] relative z-[1]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="rounded-xl border border-dashed border-border/40 bg-card/30 p-3.5">
                    <div className="flex items-center gap-2">
                      {progress?.stage === 'analyzing' && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                        </span>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {progress ? 
                          progress.stage === 'generating_queries' ? 'Generating search queries…' :
                          progress.stage === 'searching' ? 'Searching…' :
                          progress.stage === 'analyzing' && progress.currentQuery
                            ? <>Analyzing: <span className="font-medium text-foreground/80">{progress.currentQuery}</span></>
                            : progress.stage === 'analyzing' ? 'Analyzing…' :
                          progress.stage === 'reporting' ? 'Writing final report…' :
                          'Working…'
                          : 'Starting…'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

              </div>
            )}

            <div ref={bottomRef} />
          </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
                <X size={24} className="text-red-400" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
            </div>
          )}

          {!loading && !error && report && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center gap-3 px-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-surface ring-1 ring-border shadow-soft">
                  <CheckCircle size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">Research Complete</p>
                  <p className="text-xs text-muted-foreground">{steps.length} steps completed</p>
                </div>
              </div>

              {steps.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
                    <BookOpen size={14} className="text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground">Research Steps ({steps.length})</h3>
                  </div>
                  {steps.map(step => (
                    <div key={step.step} className="border-b border-border last:border-0">
                      <button onClick={() => toggleStep(step.step)}
                              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-secondary/60 transition-colors text-left">
                        {expandedSteps.has(step.step)
                          ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                          : <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                        }
                        <span className="text-xs font-medium text-muted-foreground">Step {step.step}</span>
                        <span className="text-sm text-foreground truncate">{step.query}</span>
                      </button>
                      {expandedSteps.has(step.step) && (
                        <div className="px-4 pb-4 pt-1 pl-12">
                          {step.learnings.length > 0 && (
                            <ul className="space-y-1.5 mb-3">
                              {step.learnings.map((l, i) => (
                                <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                                  <span className="text-primary/60 mt-1 shrink-0">•</span>
                                  <span>{l}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {step.sources.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {step.sources.map((s, i) => (
                                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                                   className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                                  <ExternalLink size={10} />
                                  <span className="max-w-[180px] truncate">{s.title}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="markdown-body text-sm leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 first:mt-0 text-foreground">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-semibold mb-3 mt-5 text-foreground">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-medium mb-2 mt-4 text-foreground">{children}</h3>,
                      p: ({ children }) => <p className="text-sm leading-relaxed mb-3.5 text-muted-foreground">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-3.5 text-sm text-muted-foreground space-y-1.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-3.5 text-sm text-muted-foreground space-y-1.5">{children}</ol>,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                           className="text-primary hover:underline">{children}</a>
                      ),
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      code: ({ children }) => (
                        <code className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[12px]">{children}</code>
                      ),
                    }}
                  >
                    {sanitize(report)}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
