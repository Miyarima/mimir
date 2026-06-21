export interface Settings {
  theme: string
  apiEndpoint: string
  apiKey: string
  model: string
  searchProvider: 'duckduckgo' | 'tavily' | 'searxng'
  searchEndpoint: string
  maxResearchSteps: number
  researchBreadth: number
  researchDepth: number
  crawl4aiEndpoint: string
  autoStartCrawl4AI: boolean
  playbook: PlaybookPrompt[]
  tools: ToolSettings
}

export interface ToolSettings {
  enabled: boolean
  readFile: boolean
  writeFile: boolean
  listDirectory: boolean
  shell: boolean
  shellWhitelist: string[]
}

export type ResearchStage = 'generating_queries' | 'searching' | 'analyzing' | 'reporting' | 'complete'

export interface ResearchProgress {
  stage: ResearchStage
  currentDepth: number
  totalDepth: number
  currentBreadth: number
  totalBreadth: number
  currentQuery?: string
  totalQueries: number
  completedQueries: number
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface FileAttachment {
  id: string
  name: string
  type: string
  content: string
  size: number
}

export interface PlaybookPrompt {
  id: string
  name: string
  text: string
  isBuiltin: boolean
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  sources?: Source[]
  attachments?: FileAttachment[]
  toolCalls?: ToolCall[]
  toolCallId?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
  result?: ToolResult
  pendingApproval?: boolean
  startTime?: number
  endTime?: number
  status?: 'pending' | 'running' | 'success' | 'error'
}

export interface ToolResult {
  success: boolean
  output: string
}

export interface ToolChain {
  calls: ToolCall[]
  isActive: boolean
}

export interface Source {
  title: string
  url: string
  snippet: string
}

export interface ResearchStep {
  step: number
  query: string
  learnings: string[]
  sources: Source[]
}

export interface ResearchResult {
  id: string
  question: string
  report: string
  steps: ResearchStep[]
  sources: Source[]
  timestamp: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  isResearch: boolean
  archived: boolean
  pinned?: boolean
  tags?: string[]
  lastReadAt?: number
  researchResult?: ResearchResult
  toolChain?: ToolChain
}

export interface ConversationListItem {
  id: string
  title: string
  isResearch: boolean
  createdAt: number
  updatedAt: number
  pinned?: boolean
  tags?: string[]
  lastReadAt?: number
  toolChain?: { calls: ToolCall[]; isActive: boolean }
}

export interface Skill {
  id: string
  name: string
  description: string
  instructions: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface Crawl4AIStatus {
  running: boolean
  dockerAvailable: boolean
  containerExists: boolean
  starting: boolean
  endpoint: string
}

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      fullscreen: () => void
      close: () => void
      db: {
        loadConversations: () => Promise<ConversationListItem[]>
        loadMessages: (conversationId: string) => Promise<Message[]>
        createConversation: (conv: { id: string; title: string; isResearch: boolean }) => Promise<void>
        updateConversation: (conv: { id: string; messages: Message[] }) => Promise<void>
        updateConversationFields: (id: string, fields: { pinned?: boolean; tags?: string[]; lastReadAt?: number; toolChain?: { calls: ToolCall[]; isActive: boolean } }) => Promise<void>
        renameConversation: (id: string, title: string) => Promise<void>
        deleteConversation: (id: string) => Promise<void>
        loadSettings: () => Promise<Record<string, string>>
        saveSetting: (key: string, value: string) => Promise<void>
        loadSkills: () => Promise<Skill[]>
        saveSkill: (skill: Skill) => Promise<void>
        deleteSkill: (id: string) => Promise<void>
      }
      crawl4ai: {
        status: (endpoint?: string) => Promise<Crawl4AIStatus>
        start: (endpoint?: string) => Promise<boolean>
        stop: () => Promise<boolean>
        isStarting: () => Promise<boolean>
      }
      tools: {
        execute: (name: string, args: Record<string, unknown>, whitelist: string[]) => Promise<{ success: boolean; output: string }>
      }
    }
  }
}

export const CONVERSATION_TAGS = [
  { id: 'work', label: 'Work', color: 'primary' },
  { id: 'research', label: 'Research', color: 'secondary' },
  { id: 'ideas', label: 'Ideas', color: 'accent' },
  { id: 'personal', label: 'Personal', color: 'muted' },
  { id: 'code', label: 'Code', color: 'destructive' },
] as const

export type ConversationTagId = typeof CONVERSATION_TAGS[number]['id']
