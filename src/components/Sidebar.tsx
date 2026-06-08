import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Settings, Plus, Sparkles, MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronRight, Library, Archive } from 'lucide-react'
import type { Conversation } from '../types'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onArchive: (id: string) => void
  onSettings: () => void
  onKnowledgeBase: () => void
  showSettings: boolean
  showKnowledgeBase: boolean
  sidebarOpen: boolean
}

function ConversationItem({ conv, index, total, activeId, renamingId, renameValue, menuState, onSelect, onRename, onDelete, onArchive, setMenuState, setRenamingId, setRenameValue, inputRef, menuRef }: {
  conv: Conversation
  index: number
  total: number
  activeId: string | null
  renamingId: string | null
  renameValue: string
  menuState: { id: string; top: number; right: number } | null
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  setMenuState: (s: { id: string; top: number; right: number } | null) => void
  setRenamingId: (s: string | null) => void
  setRenameValue: (s: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
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
        className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-1 text-left text-sm transition ${
          activeId === conv.id
            ? 'bg-accent text-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-secondary/60'
        }`}
      >

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
            className="flex-1 truncate bg-transparent text-sm text-foreground outline-none"
          />
        ) : (
          <span className="flex-1 truncate">{conv.isResearch ? conv.title.replace(/^Research:\s*/i, '') : conv.title || 'New conversation'}</span>
        )}
        <MoreHorizontal onClick={(e) => {
          e.stopPropagation()
          if (menuState?.id === conv.id) { setMenuState(null); return }
          const rect = e.currentTarget.getBoundingClientRect()
          setMenuState({ id: conv.id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
        }}
                        className="h-4 w-4 shrink-0 text-sidebar-foreground/40 opacity-0 transition hover:text-foreground group-hover:opacity-100" />
      </button>

      {menuState?.id === conv.id && (
        <div ref={menuRef}
             className="fixed z-50 w-36 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
             style={{ top: menuState.top, right: menuState.right }}>
          <button onClick={() => { setRenamingId(conv.id); setRenameValue(conv.title); setMenuState(null) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground/80 transition hover:bg-secondary">
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
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

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onRename, onArchive, onSettings, onKnowledgeBase, showSettings, showKnowledgeBase, sidebarOpen }: SidebarProps) {
  const [menuState, setMenuState] = useState<{ id: string; top: number; right: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({ Chats: true, 'Deep Research': true })
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const chats = conversations.filter(c => !c.isResearch && !c.archived)
  const deepResearch = conversations.filter(c => c.isResearch && !c.archived)

  useEffect(() => {
    if (renamingId && inputRef.current) inputRef.current.focus()
  }, [renamingId])

  useEffect(() => {
    if (!menuState) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuState(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuState])

  const toggleSection = (name: string) => {
    setSectionsOpen(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function renderSection(label: string, items: Conversation[], icon: React.ReactNode) {
    return (
      <>
        <button onClick={() => toggleSection(label)}
                className="flex w-full items-center gap-1.5 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition">
          {sectionsOpen[label] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {icon}
          {label}
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
                <ConversationItem
                  key={conv.id}
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
                  setMenuState={setMenuState}
                  setRenamingId={setRenamingId}
                  setRenameValue={setRenameValue}
                  inputRef={inputRef}
                  menuRef={menuRef}
                />
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <aside className={`flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar ${sidebarOpen ? 'w-72' : 'w-0'} overflow-hidden`}>
      <div className={`flex h-full flex-col overflow-hidden ${sidebarOpen ? '' : 'invisible'}`}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <img src="/logo.svg" alt="Mimir" className="h-8 w-8" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Mimir</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Local · v1.0</span>
          </div>
        </div>

        {/* New chat */}
        <div className="px-3 pb-3">
          <button onClick={onNew}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:shadow-glow active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="mx-3 my-1 h-px bg-sidebar-border" />

        {/* Conversation sections */}
        <div className="flex-1 overflow-y-auto pt-2 pb-1">
          {renderSection('Chats', chats, <MessageSquare className="h-3 w-3 opacity-70" />)}
          {renderSection('Deep Research', deepResearch, <Sparkles className="h-3 w-3 opacity-70" />)}
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <button onClick={onKnowledgeBase}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                    showKnowledgeBase
                      ? 'bg-accent text-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-secondary/60'
                  }`}>
            <Library className="h-4 w-4 opacity-70" />
            Knowledge Base
          </button>
          <button onClick={onSettings}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                    showSettings
                      ? 'bg-accent text-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-secondary/60'
                  }`}>
            <Settings className="h-4 w-4 opacity-70" />
            Settings
          </button>
        </div>
      </div>
    </aside>
  )
}