import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Search, Terminal, MessageSquare, Loader2 } from 'lucide-react'
import MessageBubble from './MessageBubble'
import type { Message, Conversation, Settings } from '../types'
import { chat } from '../services/api'

interface ChatViewProps {
  conversation: Conversation | null
  settings: Settings
  onUpdateConversation: (conv: Conversation) => void
  onRename: (id: string, title: string) => void
  onStartResearch: (question: string, breadth?: number, depth?: number) => void
  onDraftSubmit?: (question: string) => Conversation
}

const suggestions = [
  { icon: Search, label: 'Compare two frameworks', hint: '/research' },
  { icon: Sparkles, label: 'Summarize a long article', hint: 'summarize' },
  { icon: Terminal, label: 'Explain a code snippet', hint: 'explain' },
  { icon: MessageSquare, label: 'Brainstorm ideas', hint: 'chat' },
]

const commands = [
  { name: '/research', desc: 'Deep multi-step research with web search' },
  { name: '/deep B,D', desc: 'Research with breadth B and depth D' },
]

export default function ChatView({ conversation, settings, onUpdateConversation, onRename, onStartResearch, onDraftSubmit }: ChatViewProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [cmdIndex, setCmdIndex] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const showCmd = input.startsWith('/') && input.indexOf(' ') === -1

  useEffect(() => {
    if (!showCmd) setCmdIndex(0)
  }, [showCmd])

  const selectCommand = (name: string) => {
    setInput(name + ' ')
    setCmdIndex(0)
    taRef.current?.focus()
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')

    const isResearch = question.toLowerCase().includes('/research') || question.toLowerCase().includes('/deep')
    if (isResearch) {
      let q = question.replace(/\/research/gi, '').trim()
      let breadth: number | undefined
      let depth: number | undefined

      const deepMatch = q.match(/^\/deep\s+(\d+)\s*[, ]\s*(\d+)/i)
      if (deepMatch) {
        breadth = parseInt(deepMatch[1])
        depth = parseInt(deepMatch[2])
        q = q.replace(/\/deep\s+\d+\s*[, ]\s*\d+\s*/i, '').trim()
      } else {
        q = q.replace(/\/deep/gi, '').trim()
      }

      onStartResearch(q, breadth, depth)
      return
    }

    const activeConv = conversation ?? onDraftSubmit!(question)

    const userMsg: Message = {
      id: Date.now().toString(36),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    }

    const updated = { ...activeConv }
    updated.messages = [...updated.messages, userMsg]
    const needsTitle = updated.title === 'New conversation'
    if (needsTitle) {
      onRename(activeConv.id, question.slice(0, 40))
    }
    onUpdateConversation(updated)

    setLoading(true)
    const assistantMsg: Message = {
      id: Date.now().toString(36) + 'a',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    updated.messages = [...updated.messages, assistantMsg]
    onUpdateConversation({ ...updated })

    const history = updated.messages.slice(0, -1).map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }))

    try {
      let fullContent = ''
      await chat(settings, history, (chunk) => {
        fullContent += chunk
        const msgs = [...updated.messages]
        msgs[msgs.length - 1] = { ...assistantMsg, content: fullContent }
        onUpdateConversation({ ...updated, messages: msgs })
      })

      if (needsTitle && fullContent) {
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
              content: `Give me a 2-5 word title summarizing the topic of this exchange. THIS IS VERY IMPORTANT: Do NOT answer the question. Do NOT continue the conversation. ONLY output the short title.

User's question: ${question}
Assistant's answer: ${fullContent}

Short title (2-5 words, no quotes, no punctuation, no explanation):`,
            }],
            stream: false,
          }),
        }).then(async r => {
          const data = await r.json()
          const title = data.choices?.[0]?.message?.content?.trim()
          if (title) onRename(activeConv.id, title.replace(/[""''"]/g, '').slice(0, 60))
        }).catch(() => {})
      }
    } catch (err: any) {
      const msgs = [...updated.messages]
      msgs[msgs.length - 1] = {
        ...assistantMsg,
        content: `Error: ${err.message || 'Failed to get response'}`,
      }
      onUpdateConversation({ ...updated, messages: msgs })
    } finally {
      setLoading(false)
    }
  }

  const hasMessages = (conversation?.messages.length ?? 0) > 0

  return (
    <>
      {!hasMessages ? (
        /* Empty state */
        <div className="relative flex flex-1 items-center justify-center overflow-y-auto px-6">
          <div aria-hidden
               className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
               style={{ background: 'var(--gradient-primary)' }} />
          <div className="relative z-10 flex max-w-xl flex-col items-center text-center">
            <img src="/logo.svg" alt="Mimir" className="mb-6 h-16 w-16" />
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Mimir</h2>
            <p className="mt-3 text-[15px] text-muted-foreground">
              Ask anything. Use{' '}
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[12px] text-primary">
                <Terminal className="h-3 w-3" />
                /research
              </span>{' '}
              for deep multi-step research.
              <br />
              <span className="text-xs text-muted-foreground/70">Override breadth/depth: <code className="rounded bg-secondary/40 px-1 font-mono text-[11px]">/deep 6,3 quantum computing</code></span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Works with any OpenAI-compatible local model
            </p>

            <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map(s => (
                <button key={s.label}
                        onClick={() => setInput(s.label)}
                        className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3.5 py-3 text-left text-sm text-foreground/90 transition hover:border-primary/40 hover:bg-card">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary transition group-hover:bg-primary/15">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{s.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Messages area */
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-6xl space-y-5">
              {conversation!.messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      {/* Composer */}
      <div className="bg-background px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <div className="group relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft transition focus-within:border-primary/50 focus-within:shadow-glow">
            {showCmd && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-card shadow-lift overflow-hidden">
                {commands.map((cmd, i) => (
                  <button key={cmd.name}
                          onMouseDown={e => { e.preventDefault(); selectCommand(cmd.name) }}
                          onMouseEnter={() => setCmdIndex(i)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm transition ${
                            i === cmdIndex ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary/60'
                          }`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-mono font-medium ${
                      i === cmdIndex ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{cmd.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{cmd.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={taRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={1}
              placeholder="Ask anything…  (/research or /deep B,D)"
              disabled={loading}
              className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
              onKeyDown={e => {
                if (showCmd) {
                  if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
                    e.preventDefault()
                    setCmdIndex(i => (i + 1) % commands.length)
                    return
                  }
                  if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
                    e.preventDefault()
                    setCmdIndex(i => (i - 1 + commands.length) % commands.length)
                    return
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    selectCommand(commands[cmdIndex].name)
                    return
                  }
                  const num = parseInt(e.key)
                  if (num >= 1 && num <= commands.length) {
                    e.preventDefault()
                    selectCommand(commands[num - 1].name)
                    return
                  }
                  if (e.key === 'Escape') {
                    setCmdIndex(0)
                    return
                  }
                }
                if (e.key === 'Backspace' && input.startsWith('/')) {
                  const el = e.target as HTMLTextAreaElement
                  const spaceIdx = input.indexOf(' ')
                  const cmdLen = spaceIdx > 0 ? spaceIdx : input.length
                  if (el.selectionStart === cmdLen) {
                    e.preventDefault()
                    setInput(spaceIdx > 0 ? input.slice(spaceIdx + 1) : '')
                    return
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <button onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft transition enabled:hover:shadow-glow disabled:opacity-40"
                    aria-label="Send">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
            Press <kbd className="rounded border border-border bg-secondary px-1">Enter</kbd> to send ·{' '}
            <kbd className="rounded border border-border bg-secondary px-1">Shift+Enter</kbd> for newline
          </p>
        </div>
      </div>
    </>
  )
}
