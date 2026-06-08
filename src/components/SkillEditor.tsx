import { useState } from 'react'
import { ArrowLeft, Download, Save, Loader2, Sparkles, Upload, AlertCircle } from 'lucide-react'
import type { Settings } from '../types'
import { parseSkillMarkdown, toSkillMarkdown } from '../services/markdown'
import { generateSkill } from '../services/skill-generator'

export type EditorMode = 'create' | 'edit' | 'import' | 'generate'

interface SkillForm {
  name: string
  description: string
  instructions: string
}

interface SkillEditorProps {
  mode: EditorMode
  initial?: { name: string; description: string; instructions: string }
  settings: Settings
  onSave: (data: SkillForm) => void
  onCancel: () => void
}

export default function SkillEditor({ mode, initial, settings, onSave, onCancel }: SkillEditorProps) {
  const [form, setForm] = useState<SkillForm>(initial ?? { name: '', description: '', instructions: '' })
  const [importText, setImportText] = useState('')
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (key: keyof SkillForm, value: string) => setForm(p => ({ ...p, [key]: value }))

  const handleParseImport = () => {
    setError(null)
    try {
      const parsed = parseSkillMarkdown(importText)
      if (!parsed.name && !parsed.instructions) {
        setError('Could not parse the markdown. Make sure it has frontmatter (---) with name and instructions.')
        return
      }
      setForm(parsed)
    } catch {
      setError('Failed to parse markdown content.')
    }
  }

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const result = await generateSkill(settings, generatePrompt.trim())
      setForm({ name: result.name, description: result.description, instructions: result.instructions })
    } catch (err: any) {
      setError(err.message || 'Failed to generate skill. Check your API connection.')
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = () => {
    const md = toSkillMarkdown(form.name, form.description, form.instructions)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.name.toLowerCase().replace(/\s+/g, '-') || 'skill'}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSave = () => {
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.instructions.trim()) { setError('Instructions are required.'); return }
    onSave(form)
  }

  const title = mode === 'create' ? 'New Skill'
    : mode === 'edit' ? 'Edit Skill'
    : mode === 'import' ? 'Import Skill'
    : 'Generate Skill with AI'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex items-center gap-3">
          <button onClick={onCancel}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-medium text-foreground/90">{title}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {mode === 'edit' && (
            <button onClick={handleExport}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          )}
          <button onClick={handleSave}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:brightness-110">
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Import mode: paste markdown first */}
          {mode === 'import' && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-foreground/80">
                Paste skill markdown
              </label>
              <textarea value={importText}
                        onChange={e => setImportText(e.target.value)}
                        rows={6}
                        placeholder={`Paste markdown with frontmatter:\n\n---\nname: My Skill\ndescription: What it does\n---\n\nInstructions here...`}
                        className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono" />
              <button onClick={handleParseImport}
                      className="flex items-center gap-1.5 rounded-lg bg-secondary px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-secondary/70">
                <Upload className="h-3.5 w-3.5" />
                Parse
              </button>
            </div>
          )}

          {/* Generate mode: describe skill first */}
          {mode === 'generate' && !generating && !form.instructions && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-foreground/80">
                Describe the skill you want
              </label>
              <textarea value={generatePrompt}
                        onChange={e => setGeneratePrompt(e.target.value)}
                        rows={4}
                        placeholder="e.g. A skill that makes the AI respond like a pirate, using nautical terms and pirate slang..."
                        className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
              <button onClick={handleGenerate} disabled={!generatePrompt.trim() || generating}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-40">
                <Sparkles className="h-3.5 w-3.5" />
                Generate
              </button>
            </div>
          )}

          {mode === 'generate' && generating && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Generating skill…</p>
              </div>
            </div>
          )}

          {/* Form (visible in create/edit modes, and after parse/generate in import/generate modes) */}
          {(mode !== 'import' || form.instructions) && (mode !== 'generate' || form.instructions) && (
            <>
              <div className="space-y-3">
                <label className="text-xs font-medium text-foreground/80">
                  Name <span className="text-destructive">*</span>
                </label>
                <input value={form.name}
                       onChange={e => update('name', e.target.value)}
                       placeholder="e.g. Pirate Mode"
                       className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium text-foreground/80">
                  Description
                </label>
                <textarea value={form.description}
                          onChange={e => update('description', e.target.value)}
                          rows={2}
                          placeholder="What does this skill do?"
                          className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium text-foreground/80">
                  Instructions (system prompt) <span className="text-destructive">*</span>
                </label>
                <textarea value={form.instructions}
                          onChange={e => update('instructions', e.target.value)}
                          rows={12}
                          placeholder="Write the system prompt instructions for the AI to follow..."
                          className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono leading-relaxed" />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}