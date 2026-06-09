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
  researchResult?: ResearchResult
}

export interface ConversationListItem {
  id: string
  title: string
  isResearch: boolean
  createdAt: number
  updatedAt: number
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
    }
  }
}
