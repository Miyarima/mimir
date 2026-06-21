import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Search, Terminal, MessageSquare, Loader2, Paperclip, ChevronDown, Bot, X, Wrench, Check, XCircle } from 'lucide-react'
import MessageBubble from './MessageBubble'
import Playbook from './Playbook'
import ToolActivityPanel from './ToolActivityPanel'
import type { Message, Conversation, Settings, FileAttachment, PlaybookPrompt, ToolCall } from '../types'
import { chat, chatWithTools, buildMessagesWithSkills } from '../services/api'
import type { Skill } from '../types'
import { readFile, formatFileSize } from '../services/file'

interface ChatViewProps {
  conversation: Conversation | null
  settings: Settings
  skills: Skill[]
  connected: boolean
  onUpdateConversation: (conv: Conversation) => void
  onRename: (id: string, title: string) => void
  onStartResearch: (question: string, breadth?: number, depth?: number) => void
  onDraftSubmit?: (question: string) => Conversation
  onUpdateSettings: (settings: Settings) => void
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

export default function ChatView({ conversation, settings, skills, connected, onUpdateConversation, onRename, onStartResearch, onDraftSubmit, onUpdateSettings }: ChatViewProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [cmdIndex, setCmdIndex] = useState(0)
  const [showDisconnected, setShowDisconnected] = useState(false)
  const [disconnectedDetail, setDisconnectedDetail] = useState<string[]>([])
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [pendingToolCall, setPendingToolCall] = useState<{ name: string; args: Record<string, unknown> } | null>(null)
  const [toolChain, setToolChain] = useState<{ calls: ToolCall[]; isActive: boolean }>({ calls: [], isActive: false })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  const showCmd = input.startsWith('/') && input.indexOf(' ') === -1

  useEffect(() => {
    if (!showCmd) setCmdIndex(0)
  }, [showCmd])

  // Sync tool chain from conversation
  useEffect(() => {
    if (conversation?.toolChain) {
      setToolChain(conversation.toolChain)
    } else {
      setToolChain({ calls: [], isActive: false })
    }
  }, [conversation?.id, conversation?.toolChain])

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!modelDropdownRef.current?.contains(e.target as Node)) {
        setShowModelDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchModels = async () => {
    if (models.length > 0) return
    const base = settings.apiEndpoint.replace(/\/+$/, '')
    const url = (base.includes('/v1') ? base : base + '/v1') + '/models'
    try {
      const res = await fetch(url, {
        headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        const list = data.data?.map((m: any) => m.id).filter(Boolean) || []
        setModels(list)
      }
    } catch {}
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newAttachments: FileAttachment[] = []
    for (const file of files) {
      try {
        const att = await readFile(file)
        newAttachments.push(att)
      } catch (err) {
        console.error('Failed to read file:', file.name, err)
      }
    }
    setAttachments(prev => [...prev, ...newAttachments])
    e.target.value = ''
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const question = input.trim()
    const isResearch = question.toLowerCase().includes('/research') || question.toLowerCase().includes('/deep')

    if (!connected) {
      const missing: string[] = []
      if (!settings.apiEndpoint) missing.push('API endpoint is not configured')
      else missing.push('API endpoint is not reachable (check Settings)')
      if (!settings.model) missing.push('No model selected')
      if (isResearch) {
        if (!settings.crawl4aiEndpoint) missing.push('Crawl4AI endpoint is not configured')
        else missing.push('Crawl4AI endpoint is not reachable (check Settings)')
      }
      setDisconnectedDetail(missing)
      setShowDisconnected(true)
      return
    }

    const missing: string[] = []
    if (!settings.apiEndpoint) missing.push('API endpoint is not configured')
    if (!settings.model) missing.push('No model selected')
    if (isResearch && !settings.crawl4aiEndpoint) missing.push('Crawl4AI endpoint is not configured')
    if (missing.length > 0) {
      setDisconnectedDetail(missing)
      setShowDisconnected(true)
      return
    }
    setInput('')

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

    const updated = { ...activeConv }
    let needsTitle = updated.title === 'New conversation'

    // Add attachment messages first
    for (const att of attachments) {
      const attMsg: Message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'user',
        content: att.content,
        timestamp: Date.now(),
        attachments: [att],
      }
      updated.messages = [...updated.messages, attMsg]
    }

    // Add user text message
    const userMsg: Message = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    }
    updated.messages = [...updated.messages, userMsg]
    if (needsTitle) {
      onRename(activeConv.id, question.slice(0, 40))
    }
    onUpdateConversation(updated)
    setAttachments([])

    setLoading(true)
    const assistantMsg: Message = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    updated.messages = [...updated.messages, assistantMsg]
    onUpdateConversation({ ...updated })

    // Last assistant message from the conversation (before the current turn)
    const lastAssistantContent = conversation?.messages.filter(m => m.role === 'assistant').pop()?.content

    const history = buildMessagesWithSkills(
      updated.messages.slice(0, -1).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      skills,
      question,
      lastAssistantContent,
    )

    try {
      const toolsEnabled = settings.tools?.enabled ?? false
      const enabledToolNames: string[] = []
      if (toolsEnabled) {
        if (settings.tools.readFile) enabledToolNames.push('read_file')
        if (settings.tools.writeFile) enabledToolNames.push('write_file')
        if (settings.tools.listDirectory) enabledToolNames.push('list_directory')
        if (settings.tools.shell) enabledToolNames.push('run_shell')
      }

      // apiMessages: used only for the API call, includes tool calls/results
      // messages: what's actually stored in the conversation
      let apiMessages = [...updated.messages].map(m => ({ ...m }))
      const toolChainCalls: ToolCall[] = []
      let toolChainActive = false
      let fullContent = ''
      let continueLoop = true
      let iterations = 0
      const maxIterations = 10

      // Helper to update the tool chain in the conversation and local state
      const updateToolChain = (calls: ToolCall[], isActive: boolean) => {
        setToolChain({ calls: [...calls], isActive })
        onUpdateConversation({ ...updated, messages: updated.messages, toolChain: { calls: [...calls], isActive } })
      }

      while (continueLoop && iterations < maxIterations) {
        iterations++

        const apiPayload = apiMessages
          .filter(m => m.role !== 'system' || true)
          .map(m => {
            if (m.role === 'tool') {
              return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId || '' }
            }
            if (m.toolCalls && m.toolCalls.length > 0) {
              return {
                role: 'assistant' as const,
                content: m.content || null,
                tool_calls: m.toolCalls.map(tc => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: tc.name, arguments: tc.arguments },
                })),
              }
            }
            return { role: m.role as 'user' | 'assistant' | 'system', content: m.content }
          })

        const lastAssistantContent = apiMessages.filter(m => m.role === 'assistant').pop()?.content
        const finalMessages = buildMessagesWithSkills(
          apiPayload.map(m => {
            if (m.role === 'tool') return { role: 'user' as const, content: m.content }
            if (m.role === 'assistant' && (m as any).tool_calls) {
              return { role: 'assistant' as const, content: (m as any).content || '' }
            }
            return { role: m.role, content: m.content as string }
          }),
          skills,
          question,
          lastAssistantContent,
        )

        // For streaming updates, show partial content
        let streamedContent = ''

        const { content, toolCalls } = await chatWithTools(settings, finalMessages as any, enabledToolNames, (chunk) => {
          streamedContent += chunk
          fullContent = streamedContent
        })

        if (toolCalls.length === 0) {
          continueLoop = false
          break
        }

        // Add tool calls to the chain with running status
        for (const tc of toolCalls) {
          const toolCallEntry: ToolCall = {
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
            status: 'running',
            startTime: Date.now(),
          }
          toolChainCalls.push(toolCallEntry)
        }
        toolChainActive = true
        updateToolChain([...toolChainCalls], true)

        // Add to apiMessages for the next iteration
        const assistantApiMsg: Message = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          role: 'assistant',
          content: content,
          timestamp: Date.now(),
          toolCalls: toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          })),
        }
        apiMessages = [...apiMessages, assistantApiMsg]

        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {}
          try { args = JSON.parse(tc.arguments) } catch {}

          if (tc.name === 'run_shell') {
            const command = String(args.command || '')
            const cmdBase = command.trim().split(/\s+/)[0]
            const whitelist = settings.tools.shellWhitelist || []
            if (!whitelist.includes(cmdBase)) {
              setPendingToolCall({ name: tc.name, args })
              await new Promise<void>((resolve) => {
                const check = () => {
                  if (!document.querySelector('[data-tool-approval-dialog]')) {
                    resolve()
                  } else {
                    setTimeout(check, 100)
                  }
                }
                check()
              })
            }
          }

          if (!window.electronAPI?.tools) continue
          const result = await window.electronAPI.tools.execute(tc.name, args, settings.tools.shellWhitelist || [])

          // Update the tool call in the chain with the result
          const tcIndex = toolChainCalls.findIndex(c => c.id === tc.id)
          if (tcIndex >= 0) {
            toolChainCalls[tcIndex] = {
              ...toolChainCalls[tcIndex],
              result: { success: result.success, output: result.output },
              status: result.success ? 'success' : 'error',
              endTime: Date.now(),
            }
            updateToolChain([...toolChainCalls], true)
          }

          // Add to apiMessages for the next iteration
          const toolResultMsg: Message = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            role: 'tool',
            content: result.success ? result.output : `Error: ${result.output}`,
            timestamp: Date.now(),
            toolCallId: tc.id,
          }
          apiMessages = [...apiMessages, toolResultMsg]
        }
      }

      // All done — mark tool chain as inactive
      toolChainActive = false
      const finalToolChain = { calls: toolChainCalls, isActive: false }

      // Add the final assistant message
      const finalAssistantMsg: Message = {
        ...assistantMsg,
        content: fullContent,
      }
      updated.messages = [...updated.messages, finalAssistantMsg]
      onUpdateConversation({ ...updated, toolChain: finalToolChain })

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
    <div className="relative flex flex-col h-full">
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

            <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 font-mono">
              {suggestions.map(s => (
                <button key={s.label}
                        onClick={() => setInput(s.label)}
                        className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3.5 py-3 text-left text-sm text-foreground/90 transition hover:border-primary/40 hover:bg-card focus:outline-none focus:ring-1 focus:ring-primary/40">
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
              {conversation!.messages.map((msg, idx) => (
                <div key={msg.id}>
                  <MessageBubble message={msg} />
                  {/* Render tool activity panel after the user message that triggered it */}
                  {msg.role === 'user' && conversation!.toolChain && conversation!.toolChain.calls.length > 0 && idx === conversation!.messages.length - 2 && (
                    <ToolActivityPanel toolChain={conversation!.toolChain} />
                  )}
                </div>
              ))}
              {/* Show current tool chain while loading (before assistant message is added) */}
              {loading && toolChain.calls.length > 0 && (
                <ToolActivityPanel toolChain={toolChain} />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      {/* Composer */}
      <div className="bg-background px-4 py-4">
        <div className="mx-auto max-w-6xl">
          {/* File chips */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs text-foreground/80">
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  <span className="text-muted-foreground/50">{formatFileSize(att.size)}</span>
                  <button onClick={() => handleRemoveAttachment(att.id)} className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/50 hover:text-destructive focus:outline-none focus:ring-1 focus:ring-destructive/40">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="group relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft transition focus-within:border-primary/50 focus-within:shadow-glow">
            {showCmd && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-card shadow-lift overflow-hidden">
                {commands.map((cmd, i) => (
                  <button key={cmd.name}
                          onMouseDown={e => { e.preventDefault(); selectCommand(cmd.name) }}
                          onMouseEnter={() => setCmdIndex(i)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm transition focus:outline-none ${
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

            {/* Paperclip */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-primary/40"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Playbook */}
            <Playbook
              prompts={settings.playbook}
              onInsert={text => setInput(prev => prev + (prev ? '\n' : '') + text)}
              onSave={playbook => onUpdateSettings({ ...settings, playbook })}
            />

            {/* Model switcher */}
            <div className="relative font-mono" ref={modelDropdownRef}>
              <button
                onClick={() => { setShowModelDropdown(v => !v); fetchModels() }}
                disabled={loading}
                className="flex h-9 items-center gap-1 rounded-xl border border-border bg-secondary/60 px-2.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <Bot className="h-3.5 w-3.5" />
                <span className="max-w-[80px] truncate">{settings.model || 'Model'}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showModelDropdown && (
                <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-border bg-card shadow-lift overflow-hidden">
                  {models.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground/60">No models found</div>
                  ) : (
                    models.map(m => (
                      <button
                        key={m}
                        onClick={() => { onUpdateSettings({ ...settings, model: m }); setShowModelDropdown(false) }}
                        className={`w-full px-3 py-2 text-left text-xs transition hover:bg-secondary/60 focus:outline-none focus:bg-secondary/60 ${
                          m === settings.model ? 'text-primary font-medium' : 'text-foreground/80'
                        }`}
                      >
                        {m}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

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
                    disabled={(!input.trim() && attachments.length === 0) || loading}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft transition enabled:hover:shadow-glow disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-primary/40"
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

      {showDisconnected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80" onClick={() => setShowDisconnected(false)}>
          <div className="w-80 rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <Send className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Not Connected</h3>
              {disconnectedDetail.length === 1 ? (
                <p className="text-xs text-muted-foreground leading-relaxed">{disconnectedDetail[0]}</p>
              ) : (
                <ul className="text-xs text-muted-foreground text-left space-y-1.5">
                  {disconnectedDetail.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setShowDisconnected(false)}
                      className="rounded-lg border border-border bg-secondary px-4 py-1.5 text-xs text-foreground transition hover:bg-secondary/80 focus:outline-none focus:ring-1 focus:ring-primary/40">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingToolCall && (
        <div data-tool-approval-dialog
             className="absolute inset-0 z-50 flex items-center justify-center bg-background/80"
             onClick={() => setPendingToolCall(null)}>
          <div className="w-96 rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <Wrench className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Tool Approval Required</h3>
                  <p className="text-xs text-muted-foreground">The AI wants to run a command not in the whitelist</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs font-mono text-foreground break-all">
                  {String(pendingToolCall.args.command || '')}
                </p>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => setPendingToolCall(null)}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-foreground transition hover:bg-secondary/80 focus:outline-none focus:ring-1 focus:ring-primary/40">
                  <XCircle className="h-3.5 w-3.5" />
                  Deny
                </button>
                <button onClick={async () => {
                          if (window.electronAPI?.tools) {
                            const result = await window.electronAPI.tools.execute(
                              pendingToolCall.name,
                              pendingToolCall.args,
                              settings.tools.shellWhitelist || []
                            )
                            const newWhitelist = [...(settings.tools.shellWhitelist || []), String(pendingToolCall.args.command || '').trim().split(/\s+/)[0]]
                            onUpdateSettings({ ...settings, tools: { ...settings.tools, shellWhitelist: Array.from(new Set(newWhitelist)) } })
                          }
                          setPendingToolCall(null)
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-foreground transition hover:bg-secondary/80 focus:outline-none focus:ring-1 focus:ring-primary/40">
                  <Check className="h-3.5 w-3.5" />
                  Allow & Whitelist
                </button>
                <button onClick={async () => {
                          if (window.electronAPI?.tools) {
                            await window.electronAPI.tools.execute(
                              pendingToolCall.name,
                              pendingToolCall.args,
                              settings.tools.shellWhitelist || []
                            )
                          }
                          setPendingToolCall(null)
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-primary/40">
                  <Check className="h-3.5 w-3.5" />
                  Allow Once
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
