import { useState, useRef, useEffect, memo } from 'react'
import { MessageSquare, Settings, Plus, Sparkles, MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronRight, ChevronLeft, Library, Archive, Pin, Search, Tag, X, Bot } from 'lucide-react'
import type { Conversation } from '../types'
import { CONVERSATION_TAGS } from '../types'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onArchive: (id: string) => void
  onPin: (id: string) => void
  onUpdateTags: (id: string, tags: string[]) => void
  onSettings: () => void
  onKnowledgeBase: () => void
  showSettings: boolean
  showKnowledgeBase: boolean
  sidebarOpen: boolean
  model: string
}

function TagBadge({ tagId, onRemove }: { tagId: string; onRemove?: () => void }) {
  const tag = CONVERSATION_TAGS.find(t => t.id === tagId)
  if (!tag) return null
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/20 text-primary',
    secondary: 'bg-secondary text-secondary-foreground',
    accent: 'bg-accent text-accent-foreground',
    muted: 'bg-muted text-muted-foreground',
    destructive: 'bg-destructive/20 text-destructive',
  }
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${colorMap[tag.color]}`}>
      {tag.label}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove() }} className="ml-0.5 opacity-60 hover:opacity-100">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

function ConversationItem({ conv, index, total, activeId, renamingId, renameValue, menuState, onSelect, onRename, onDelete, onArchive, onPin, onUpdateTags, setMenuState, setRenamingId, setRenameValue, inputRef, menuRef, tagMenuOpen, setTagMenuOpen }: {
  conv: Conversation
  index: number
  total: number
  activeId: string | null
  renamingId: string | null
  renameValue: string
  menuState: { id: string; top: number; left: number } | null
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onPin: (id: string) => void
  onUpdateTags: (id: string, tags: string[]) => void
  setMenuState: (s: { id: string; top: number; left: number } | null) => void
  setRenamingId: (s: string | null) => void
  tagMenuOpen: boolean
  setTagMenuOpen: (open: boolean) => void
  setRenameValue: (s: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  const isUnread = conv.lastReadAt !== undefined && conv.updatedAt > conv.lastReadAt
  const tags = conv.tags || []

  return (
    <div className="group relative flex items-center pl-[19px]">
      {/* Tree lines */}
      {index === total - 1 ? (
        <>
          <div className="absolute left-[7px] top-0 w-px h-1/2 bg-sidebar-foreground/20 rounded-b-full" />
          <div className="absolute left-[7px] top-1/2 w-3 h-px bg-sidebar-foreground/20" />
        </>
      ) : (
        <>
          <div className="absolute left-[7px] inset-y-0 w-px bg-sidebar-foreground/20" />
          <div className="absolute left-[7px] top-1/2 w-3 h-px bg-sidebar-foreground/20 -translate-y-1/2" />
        </>
      )}
      <button
        onClick={() => { setMenuState(null); onSelect(conv.id) }}
        className={`flex w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg px-3 py-1 text-left text-xs transition ${
          activeId === conv.id
            ? 'bg-accent text-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-secondary/60'
        }`}
      >
        {conv.pinned && <Pin className="h-3 w-3 shrink-0 text-primary opacity-70" />}
        {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="New messages" />}

        {renamingId === conv.id ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={() => { onRename(conv.id, renameValue || conv.title); setRenamingId(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onRename(conv.id, renameValue || conv.title); setRenamingId(null) }
              if (e.key === 'Escape') setRenamingId(null)
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 truncate bg-transparent text-xs text-foreground outline-none"
          />
        ) : (
          <span className="flex-1 truncate">{conv.isResearch ? conv.title.replace(/^Research:\s*/i, '') : conv.title || 'New conversation'}</span>
        )}
        <MoreHorizontal onClick={(e) => {
          e.stopPropagation()
          if (menuState?.id === conv.id) { setMenuState(null); return }
          const rect = e.currentTarget.getBoundingClientRect()
          setMenuState({ id: conv.id, top: rect.bottom + 4, left: rect.right })
        }}
                        className="h-4 w-4 shrink-0 text-sidebar-foreground/40 opacity-0 transition hover:text-foreground group-hover:opacity-100" />
      </button>

      {/* Context menu */}
      {menuState?.id === conv.id && (
        <div ref={menuRef}
             onMouseLeave={() => { setMenuState(null); setTagMenuOpen(false) }}
             className="fixed z-[100] w-44 overflow-visible rounded-lg border border-border bg-card py-1 shadow-lg"
             style={{ top: menuState.top, left: menuState.left }}>
          <button onClick={() => { onPin(conv.id); setMenuState(null) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground/80 transition hover:bg-secondary">
            <Pin className="h-3.5 w-3.5" />
            {conv.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button onClick={() => { setRenamingId(conv.id); setRenameValue(conv.title); setMenuState(null) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground/80 transition hover:bg-secondary">
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
          <div className="relative"
               onMouseLeave={() => setTagMenuOpen(false)}>
            <button onClick={() => setTagMenuOpen(!tagMenuOpen)}
                    onMouseEnter={() => setTagMenuOpen(true)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground/80 transition hover:bg-secondary">
              <Tag className="h-3.5 w-3.5" />
              Tags
              <ChevronRight className="ml-auto h-3 w-3" />
            </button>
          {tagMenuOpen && (
            <div onMouseEnter={() => setTagMenuOpen(true)}
                 className="absolute left-full top-0 ml-0 w-40 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
              {CONVERSATION_TAGS.map(tag => {
                const hasTag = (conv.tags || []).includes(tag.id)
                return (
                  <button key={tag.id}
                          onClick={() => {
                            const currentTags = conv.tags || []
                            const newTags = hasTag
                              ? currentTags.filter(t => t !== tag.id)
                              : [...currentTags, tag.id]
                            onUpdateTags(conv.id, newTags)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground/80 transition hover:bg-secondary">
                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${hasTag ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                      {hasTag && <span className="text-[10px] leading-none">✓</span>}
                    </span>
                    {tag.label}
                  </button>
                )
              })}
            </div>
          )}
          </div>

          <button onClick={() => { onArchive(conv.id); setMenuState(null) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground/80 transition hover:bg-secondary">
            <Archive className="h-3.5 w-3.5" />
            {conv.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => { onDelete(conv.id); setMenuState(null) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive transition hover:bg-destructive/15">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onRename, onArchive, onPin, onUpdateTags, onSettings, onKnowledgeBase, showSettings, showKnowledgeBase, sidebarOpen, model }: SidebarProps) {
  const [menuState, setMenuState] = useState<{ id: string; top: number; left: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tagMenuOpen, setTagMenuOpen] = useState(false)
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({ Pinned: true, Chats: true, 'Deep Research': true })
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = conversations.filter(c => !c.archived)
  const pinned = filtered.filter(c => c.pinned)
  const chats = filtered.filter(c => !c.isResearch && !c.pinned)
  const deepResearch = filtered.filter(c => c.isResearch && !c.pinned)

  // Search filter
  const matchesSearch = (conv: Conversation) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const title = (conv.isResearch ? conv.title.replace(/^Research:\s*/i, '') : conv.title || '').toLowerCase()
    if (title.includes(q)) return true
    const tags = conv.tags || []
    if (tags.some(t => {
      const tagDef = CONVERSATION_TAGS.find(ct => ct.id === t)
      return tagDef && tagDef.label.toLowerCase().includes(q)
    })) return true
    return false
  }

  const filteredPinned = pinned.filter(matchesSearch)
  const filteredChats = chats.filter(matchesSearch)
  const filteredDeepResearch = deepResearch.filter(matchesSearch)

  useEffect(() => {
    if (renamingId && inputRef.current) inputRef.current.focus()
  }, [renamingId])

  useEffect(() => {
    if (!menuState) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuState(null)
      }
    }
    setTimeout(() => document.addEventListener('mousedown', close), 0)
    return () => document.removeEventListener('mousedown', close)
  }, [menuState])

  const toggleSection = (name: string) => {
    setSectionsOpen(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function renderSection(label: string, items: Conversation[], icon: React.ReactNode) {
    if (items.length === 0 && searchQuery.trim()) return null
    return (
      <>
        <button onClick={() => toggleSection(label)}
                className="flex w-full items-center gap-1.5 overflow-hidden whitespace-nowrap px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition">
          {sectionsOpen[label] ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
          <span className="ml-auto shrink-0 text-[9px] opacity-50">{items.length}</span>
        </button>
        <div className={`grid transition-all duration-300 ease-out ${
          sectionsOpen[label] ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}>
          <div className="overflow-hidden">
            <div className="flex flex-col px-2 mt-1">
              {items.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No {label.toLowerCase()} yet
                </div>
              )}
              {items.map((conv, idx) => (
                <div key={conv.id} className="space-y-1">
                  <ConversationItem
                    conv={conv}
                    index={idx}
                    total={items.length}
                    activeId={activeId}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    menuState={menuState}
                    onSelect={onSelect}
                    onRename={onRename}
                    onDelete={onDelete}
                    onArchive={onArchive}
                    onPin={onPin}
                    onUpdateTags={onUpdateTags}
                    setMenuState={setMenuState}
                    setRenamingId={setRenamingId}
                    setRenameValue={setRenameValue}
                    inputRef={inputRef}
                    menuRef={menuRef}
                    tagMenuOpen={menuState?.id === conv.id && tagMenuOpen}
                    setTagMenuOpen={setTagMenuOpen}
                  />
                  {(conv.tags || []).length > 0 && (
                    <div className="ml-9 -mt-0.5 flex flex-wrap gap-1">
                      {conv.tags!.map(tagId => (
                        <TagBadge key={tagId} tagId={tagId} onRemove={() => onUpdateTags(conv.id, conv.tags!.filter(t => t !== tagId))} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <aside className={`flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar font-mono transition-[width] duration-300 ease-out overflow-hidden ${sidebarOpen ? 'w-72' : 'w-0'}`}>
      <div className={`flex h-full flex-col overflow-hidden transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 overflow-hidden whitespace-nowrap px-4 pt-4 pb-3">
          <img src="/logo.svg" alt="Mimir" className="h-8 w-8 shrink-0" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">Mimir</span>
            <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">Local · v1.0</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-border bg-background px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 min-w-0 truncate bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="shrink-0 text-muted-foreground/50 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* New chat */}
        <div className="px-3 pb-3">
          <button onClick={onNew}
                  className="group flex w-full items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:shadow-glow active:scale-[0.98]">
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">New Chat</span>
          </button>
        </div>

        <div className="mx-3 my-1 h-px bg-sidebar-border" />

        {/* Conversation sections */}
        <div className="flex-1 overflow-y-auto pt-2 pb-1">
          {renderSection('Pinned', filteredPinned, <Pin className="h-3 w-3 opacity-70" />)}
          {renderSection('Chats', filteredChats, <MessageSquare className="h-3 w-3 opacity-70" />)}
          {renderSection('Deep Research', filteredDeepResearch, <Sparkles className="h-3 w-3 opacity-70" />)}

          {searchQuery && filteredPinned.length === 0 && filteredChats.length === 0 && filteredDeepResearch.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No results for "{searchQuery}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {model && (
            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] text-muted-foreground/70">
              <Bot className="h-3 w-3 shrink-0" />
              <span className="truncate">{model}</span>
            </div>
          )}
          <button onClick={onKnowledgeBase}
                  className={`flex w-full items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition ${
                    showKnowledgeBase
                      ? 'bg-accent text-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-secondary/60'
                  }`}>
            <Library className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">Knowledge Base</span>
          </button>
          <button onClick={onSettings}
                  className={`flex w-full items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition ${
                    showSettings
                      ? 'bg-accent text-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-secondary/60'
                  }`}>
            <Settings className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">Settings</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

export default memo(Sidebar)
