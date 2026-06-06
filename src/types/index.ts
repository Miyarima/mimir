export interface Settings {
  apiEndpoint: string
  apiKey: string
  model: string
  searchProvider: 'duckduckgo' | 'tavily' | 'searxng'
  searchEndpoint: string
  maxResearchSteps: number
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  sources?: Source[]
}

export interface Source {
  title: string
  url: string
  snippet: string
}

export interface ResearchStep {
  step: number
  query: string
  findings: string
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
  researchResult?: ResearchResult
}

export interface ConversationListItem {
  id: string
  title: string
  isResearch: boolean
  createdAt: number
  updatedAt: number
}

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      maximize: () => void
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
      }
    }
  }
}
