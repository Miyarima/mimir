import type { Settings } from '../types'

export const defaultSettings: Settings = {
  apiEndpoint: 'http://localhost:11434/v1',
  apiKey: '',
  model: '',
  searchProvider: 'duckduckgo',
  searchEndpoint: '',
  maxResearchSteps: 5,
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
