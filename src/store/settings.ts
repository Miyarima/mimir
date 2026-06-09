import type { Settings } from '../types'

export const defaultSettings: Settings = {
  theme: 'emerald',
  apiEndpoint: 'http://localhost:11434/v1',
  apiKey: '',
  model: '',
  searchProvider: 'duckduckgo',
  searchEndpoint: '',
  maxResearchSteps: 5,
  researchBreadth: 4,
  researchDepth: 2,
  crawl4aiEndpoint: 'http://localhost:8000',
  autoStartCrawl4AI: false,
  playbook: [
    { id: 'builtin-1', name: 'Summarize', text: 'Summarize the following content in 3-5 bullet points:', isBuiltin: true },
    { id: 'builtin-2', name: 'Explain code', text: 'Explain what this code does step by step:', isBuiltin: true },
    { id: 'builtin-3', name: 'Debug', text: 'Find and explain any bugs or issues in this code:', isBuiltin: true },
    { id: 'builtin-4', name: 'Translate to English', text: 'Translate the following to English:', isBuiltin: true },
  ],
}

export async function loadSettings(): Promise<Settings> {
  if (!window.electronAPI?.db) {
    try {
      const stored = localStorage.getItem('mimir-settings')
      if (stored) return { ...defaultSettings, ...JSON.parse(stored) }
    } catch {}
    return defaultSettings
  }

  const rows = await window.electronAPI.db.loadSettings()
  if (rows && rows.settings) {
    try {
      return { ...defaultSettings, ...JSON.parse(rows.settings) }
    } catch {}
  }
  return defaultSettings
}

export function saveSettings(settings: Settings): void {
  if (window.electronAPI?.db) {
    window.electronAPI.db.saveSetting('settings', JSON.stringify(settings))
  } else {
    localStorage.setItem('mimir-settings', JSON.stringify(settings))
  }
}
