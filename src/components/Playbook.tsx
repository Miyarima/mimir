import { useState, useRef, useEffect } from 'react'
import { BookOpen, Plus, X, Sparkles, Trash2 } from 'lucide-react'
import type { PlaybookPrompt } from '../types'

interface PlaybookProps {
  prompts: PlaybookPrompt[]
  onInsert: (text: string) => void
  onSave: (prompts: PlaybookPrompt[]) => void
}

export default function Playbook({ prompts, onInsert, onSave }: PlaybookProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newText, setNewText] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAdd = () => {
    if (!newName.trim() || !newText.trim()) return
    const updated = [
      ...prompts,
      { id: Date.now().toString(36), name: newName.trim(), text: newText.trim(), isBuiltin: false },
    ]
    onSave(updated)
    setCreating(false)
    setNewName('')
    setNewText('')
  }

  const handleDelete = (id: string) => {
    const updated = prompts.filter(p => p.id !== id)
    onSave(updated)
  }

  const builtin = prompts.filter(p => p.isBuiltin)
  const custom = prompts.filter(p => !p.isBuiltin)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        title="Prompt playbook"
      >
        <BookOpen className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl border border-border bg-card shadow-lift overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-foreground/80">Prompt Playbook</span>
            <button onClick={() => setCreating(v => !v)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              {creating ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>

          {creating && (
            <div className="space-y-2 border-b border-border p-3">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Prompt name"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
              <textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                placeholder="Prompt text"
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newText.trim()}
                className="w-full rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1">
            {builtin.length > 0 && (
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Pre-made</span>
              </div>
            )}
            {builtin.map(p => (
              <button
                key={p.id}
                onClick={() => { onInsert(p.text); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 transition hover:bg-secondary/60"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary/60" />
                {p.name}
              </button>
            ))}

            {custom.length > 0 && (
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Your prompts</span>
              </div>
            )}
            {custom.map(p => (
              <div key={p.id} className="group flex items-center gap-1 px-2">
                <button
                  onClick={() => { onInsert(p.text); setOpen(false) }}
                  className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 transition hover:bg-secondary/60"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {builtin.length === 0 && custom.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground/60">
                No prompts yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
