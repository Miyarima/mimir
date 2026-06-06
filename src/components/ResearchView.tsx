import { useState, useEffect } from 'react'
import { Search, Loader2, BookOpen, ExternalLink, CheckCircle, ChevronDown, ChevronRight, X, Globe } from 'lucide-react'
import type { ResearchResult, ResearchStep, Settings, Source } from '../types'
import { runDeepResearch } from '../services/research'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F\u00AD\u200B-\u200D\uFEFF\u2060-\u2064\u2066-\u2069]/g, '')
}

interface ResearchViewProps {
  question: string
  settings: Settings
  onComplete: (result: ResearchResult) => void
  onCancel: () => void
}

export default function ResearchView({ question, settings, onComplete, onCancel }: ResearchViewProps) {
  const [report, setReport] = useState('')
  const [steps, setSteps] = useState<ResearchStep[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [liveResults, setLiveResults] = useState<{query: string, sources: Source[]}[]>([])

  useEffect(() => {
    let cancelled = false
    const startResearch = async () => {
      try {
        await runDeepResearch(question, settings,
          (step) => {
            if (!cancelled) {
              setSteps(prev => [...prev, step])
            }
          },
          (chunk) => {
            if (!cancelled) setReport(prev => prev + chunk)
          },
          (query, sources) => {
            if (!cancelled) {
              setLiveResults(prev => [...prev, { query, sources }])
            }
          }
        )
      } catch (err) {
        console.error('Research failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    startResearch()
    return () => { cancelled = true }
  }, [])

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(step)) next.delete(step)
      else next.add(step)
      return next
    })
  }

  const id = Date.now().toString(36)

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
        {loading && (
          <button onClick={onCancel}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground">
            <X size={12} />
            Cancel
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl">
          {loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground mb-6 px-1">
                <Loader2 size={18} className="animate-spin text-primary" />
                <span className="text-sm">Researching in progress...</span>
              </div>

              {/* Completed steps */}
              {steps.map(step => (
                <div key={step.step} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3">
                    <CheckCircle size={16} className="text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">Step {step.step}: {step.query}</span>
                  </div>
                  {/* Show sources for completed steps inline */}
                  {step.sources.length > 0 && (
                    <div className="px-4 pb-3 pl-10 flex flex-wrap gap-1.5">
                      {step.sources.map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/40 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                          <Globe size={10} />
                          <span className="max-w-[140px] truncate">{new URL(s.url).hostname.replace('www.', '')}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Current live search results */}
              {liveResults.length > 0 && (
                <div className="rounded-xl border border-primary/30 bg-card overflow-hidden shadow-glow">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      Searching: {liveResults[liveResults.length - 1].query}
                    </span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {liveResults[liveResults.length - 1].sources.map((s, i) => (
                      <div key={i} className="px-4 py-2.5"
                           style={{ animation: `source-enter 0.35s ease-out forwards`, animationDelay: `${i * 80}ms` }}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                           className="group flex items-start gap-2.5">
                          <Globe size={14} className="mt-0.5 shrink-0 text-primary/70" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-primary/60">
                              {(() => { try { return new URL(s.url).hostname.replace('www.', '') } catch { return s.url } })()}
                            </span>
                            <p className="text-sm text-foreground/90 leading-snug mt-0.5 line-clamp-1">{s.title}</p>
                            {s.snippet && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">{s.snippet}</p>
                            )}
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skeleton when no steps yet */}
              {steps.length === 0 && liveResults.length === 0 && (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                      <div className="h-4 bg-muted rounded-lg w-1/3 mb-3" />
                      <div className="h-3 bg-muted rounded-lg w-3/4" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && report && (
            <div className="space-y-6">
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
                          <p className="text-sm text-muted-foreground leading-relaxed">{step.findings}</p>
                          {step.sources.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
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
