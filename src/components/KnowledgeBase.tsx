import { useState } from 'react'
import { MessageSquare, Sparkles, Puzzle, Bookmark, Archive, ArrowLeft, Plus, Upload, Trash2 } from 'lucide-react'
import type { Conversation, Skill, Settings } from '../types'
import SkillEditor, { type EditorMode } from './SkillEditor'

interface KnowledgeBaseProps {
  conversations: Conversation[]
  skills: Skill[]
  settings: Settings
  onSelect: (id: string) => void
  onArchive: (id: string) => void
  onSaveSkill: (skill: Skill) => void
  onDeleteSkill: (id: string) => void
  onClose: () => void
}

type TabId = 'chats' | 'deep-research' | 'skills' | 'memories' | 'archived'

interface Tab {
  id: TabId
  label: string
  icon: typeof MessageSquare
}

const tabs: Tab[] = [
  { id: 'chats', label: 'Chats', icon: MessageSquare },
  { id: 'deep-research', label: 'Deep Research', icon: Sparkles },
  { id: 'skills', label: 'Skills', icon: Puzzle },
  { id: 'memories', label: 'Memories', icon: Bookmark },
  { id: 'archived', label: 'Archived', icon: Archive },
]

const iconMap: Record<string, typeof MessageSquare> = {
  chats: MessageSquare,
  'deep-research': Sparkles,
  skills: Puzzle,
  memories: Bookmark,
  archived: Archive,
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800000) return d.toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function lastMessagePreview(conv: Conversation): string {
  if (conv.messages.length === 0) return 'No messages yet'
  const last = conv.messages[conv.messages.length - 1]
  const text = last.content.replace(/[#*`\[\]]/g, '').slice(0, 120)
  return text + (last.content.length > 120 ? '…' : '')
}

function ConversationCard({ conv, onSelect, onArchive, showArchive }: { conv: Conversation; onSelect: (id: string) => void; onArchive: (id: string) => void; showArchive: boolean }) {
  const Icon = iconMap[conv.isResearch ? 'deep-research' : 'chats'] || MessageSquare

  return (
    <button onClick={() => onSelect(conv.id)}
            className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left transition hover:border-border/70 hover:bg-secondary/30">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground/90">{conv.title || 'New conversation'}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground/60">{formatDate(conv.updatedAt)}</span>
        </div>
        <span className="text-xs text-muted-foreground/70 line-clamp-2">{lastMessagePreview(conv)}</span>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50">{conv.messages.length} message{conv.messages.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {showArchive && (
        <button onClick={e => { e.stopPropagation(); onArchive(conv.id) }}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <Archive className="h-3 w-3" />
          {conv.archived ? 'Unarchive' : 'Archive'}
        </button>
      )}
    </button>
  )
}

function SkillCard({ skill, onEdit, onToggle, onDelete }: { skill: Skill; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const charCount = skill.instructions.length

  return (
    <button onClick={onEdit}
            className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left transition hover:border-border/70 hover:bg-secondary/30">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Puzzle className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground/90">{skill.name || 'Unnamed Skill'}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground/60">{formatDate(skill.updatedAt)}</span>
        </div>
        <span className="text-xs text-muted-foreground/70 line-clamp-2">{skill.description || '\u00a0'}</span>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50">{charCount} chars</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={onToggle}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none ${
                  skill.enabled ? 'border-primary bg-primary' : 'border-border bg-secondary'
                }`}>
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow-sm transition-transform ${
            skill.enabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`} />
        </button>
        <button onClick={onDelete}
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 transition hover:bg-destructive/15 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </button>
  )
}

function EmptyState({ icon: Icon, title, description, children }: { icon: typeof MessageSquare; title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary ring-1 ring-border">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      <p className="text-xs text-muted-foreground/60">{description}</p>
      {children}
    </div>
  )
}

export default function KnowledgeBase({ conversations, skills, settings, onSelect, onArchive, onSaveSkill, onDeleteSkill, onClose }: KnowledgeBaseProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chats')
  const [skillEditor, setSkillEditor] = useState<{ mode: EditorMode; editId?: string } | null>(null)

  const chats = conversations.filter(c => !c.isResearch && !c.archived)
  const deepResearch = conversations.filter(c => c.isResearch && !c.archived)
  const archived = conversations.filter(c => c.archived)

  const editingSkill = skillEditor?.editId ? skills.find(s => s.id === skillEditor.editId) : undefined

  const handleSkillSave = (data: { name: string; description: string; instructions: string }) => {
    const now = Date.now()

    const skill: Skill = editingSkill
      ? { ...editingSkill, name: data.name, description: data.description, instructions: data.instructions, updatedAt: now }
      : {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          name: data.name,
          description: data.description,
          instructions: data.instructions,
          enabled: false,
          createdAt: now,
          updatedAt: now,
        }
    onSaveSkill(skill)
    setSkillEditor(null)
  }

  if (skillEditor && activeTab === 'skills') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <button onClick={() => setSkillEditor(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-sm font-medium text-foreground/90">Knowledge Base</h1>
        </header>
        <SkillEditor
          mode={skillEditor.mode}
          initial={editingSkill ? { name: editingSkill.name, description: editingSkill.description, instructions: editingSkill.instructions } : undefined}
          settings={settings}
          onSave={handleSkillSave}
          onCancel={() => setSkillEditor(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="flex h-14 items-center gap-3 border-b border-border px-4">
        <button onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-medium text-foreground/90">Knowledge Base</h1>
      </header>

      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-border px-4 pt-2">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSkillEditor(null) }}
                  className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-card text-foreground border border-border border-b-transparent -mb-px'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-3">
          {activeTab === 'chats' && (
            chats.length === 0
              ? <EmptyState icon={MessageSquare} title="No Chats" description="Start a new conversation to see it here." />
              : chats.map(conv => (
                  <ConversationCard key={conv.id} conv={conv} onSelect={onSelect} onArchive={onArchive} showArchive={false} />
                ))
          )}

          {activeTab === 'deep-research' && (
            deepResearch.length === 0
              ? <EmptyState icon={Sparkles} title="No Deep Research" description="Run a deep research session to see it here." />
              : deepResearch.map(conv => (
                  <ConversationCard key={conv.id} conv={conv} onSelect={onSelect} onArchive={onArchive} showArchive={false} />
                ))
          )}

          {activeTab === 'skills' && (
            <>
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button onClick={() => setSkillEditor({ mode: 'create' })}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:bg-secondary hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  Create
                </button>
                <button onClick={() => setSkillEditor({ mode: 'import' })}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:bg-secondary hover:text-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </button>
                <button onClick={() => setSkillEditor({ mode: 'generate' })}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition hover:brightness-110">
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate with AI
                </button>
              </div>

              {/* Skill cards */}
              {skills.length === 0 ? (
                <EmptyState icon={Puzzle} title="No Skills Yet" description="Create, import, or generate a skill to get started." />
              ) : (
                skills.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onEdit={() => setSkillEditor({ mode: 'edit', editId: skill.id })}
                    onToggle={() => onSaveSkill({ ...skill, enabled: !skill.enabled, updatedAt: Date.now() })}
                    onDelete={() => onDeleteSkill(skill.id)}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'memories' && (
            <EmptyState icon={Bookmark} title="No Memories Yet" description="Memories will appear here once configured." />
          )}

          {activeTab === 'archived' && (
            archived.length === 0
              ? <EmptyState icon={Archive} title="No Archived Conversations" description="Archive a chat or deep research to see it here." />
              : archived.map(conv => (
                  <ConversationCard key={conv.id} conv={conv} onSelect={onSelect} onArchive={onArchive} showArchive={true} />
                ))
          )}
        </div>
      </main>
    </div>
  )
}