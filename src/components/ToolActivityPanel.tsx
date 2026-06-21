import { useState } from 'react'
import { Wrench, Check, XCircle, ChevronDown, ChevronRight, FileSearch, FilePlus, FolderOpen, Terminal, Loader2 } from 'lucide-react'
import type { ToolCall, ToolChain } from '../types'

const TOOL_ICONS: Record<string, typeof Wrench> = {
  read_file: FileSearch,
  write_file: FilePlus,
  list_directory: FolderOpen,
  run_shell: Terminal,
}

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Read file',
  write_file: 'Write file',
  list_directory: 'List directory',
  run_shell: 'Run command',
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = TOOL_ICONS[toolCall.name] || Wrench
  const label = TOOL_LABELS[toolCall.name] || toolCall.name

  let args: Record<string, unknown> = {}
  try { args = JSON.parse(toolCall.arguments) } catch {}

  const status = toolCall.status || (toolCall.result ? (toolCall.result.success ? 'success' : 'error') : 'pending')
  const isRunning = status === 'running' || status === 'pending'
  const isSuccess = status === 'success'
  const isError = status === 'error'
  const duration = toolCall.startTime && toolCall.endTime ? toolCall.endTime - toolCall.startTime : null

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-secondary/30"
      >
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
          isRunning ? 'bg-primary/20 text-primary' :
          isSuccess ? 'bg-primary/15 text-primary' :
          isError ? 'bg-destructive/15 text-destructive' :
          'bg-secondary text-muted-foreground'
        }`}>
          {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
        </div>
        <span className="font-medium text-foreground/90">{label}</span>
        {(toolCall.name === 'run_shell' || toolCall.name === 'read_file') && (
          <code className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {String(args.command || args.path || '')}
          </code>
        )}
        {!isRunning && (
          <span className="shrink-0 text-[10px] text-muted-foreground/60">
            {duration !== null ? formatDuration(duration) : ''}
          </span>
        )}
        {isSuccess && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        {isError && <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
        {isRunning && <span className="text-[10px] text-primary/70">running...</span>}
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border bg-secondary/20 px-3 py-2 space-y-2">
          {Object.keys(args).length > 0 && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">Input</div>
              <pre className="overflow-x-auto rounded bg-background/60 p-2 text-[11px] font-mono text-foreground/80">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.result && (
            <div>
              <div className={`text-[10px] font-medium uppercase tracking-wider mb-1 ${
                toolCall.result.success ? 'text-muted-foreground/60' : 'text-destructive/70'
              }`}>
                {toolCall.result.success ? 'Output' : 'Error'}
              </div>
              <pre className="max-h-48 overflow-auto rounded bg-background/60 p-2 text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
                {toolCall.result.output || '(empty)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ToolActivityPanel({ toolChain, onDismiss }: { toolChain: ToolChain; onDismiss?: () => void }) {
  const [expanded, setExpanded] = useState(toolChain.isActive)
  const totalCalls = toolChain.calls.length
  const successCount = toolChain.calls.filter(c => c.status === 'success' || (c.result?.success)).length
  const errorCount = toolChain.calls.filter(c => c.status === 'error' || (c.result && !c.result.success)).length
  const runningCount = toolChain.calls.filter(c => c.status === 'running' || c.status === 'pending').length

  return (
    <div className="my-3 ml-12 max-w-[75%]">
      <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-secondary/30"
        >
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
            toolChain.isActive ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
          }`}>
            {toolChain.isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-foreground/90">
                {toolChain.isActive ? 'Calling tools...' : 'Tool calls'}
              </span>
              <span className="text-muted-foreground/60">({totalCalls})</span>
              {!toolChain.isActive && successCount > 0 && (
                <span className="flex items-center gap-0.5 text-primary/70">
                  <Check className="h-3 w-3" />
                  <span>{successCount}</span>
                </span>
              )}
              {!toolChain.isActive && errorCount > 0 && (
                <span className="flex items-center gap-0.5 text-destructive/70">
                  <XCircle className="h-3 w-3" />
                  <span>{errorCount}</span>
                </span>
              )}
            </div>
            {toolChain.isActive && runningCount > 0 && (
              <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                {runningCount} running
              </div>
            )}
          </div>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {expanded && (
          <div className="border-t border-border bg-secondary/10 p-2 space-y-1.5">
            {toolChain.calls.map(tc => (
              <ToolCallItem key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
