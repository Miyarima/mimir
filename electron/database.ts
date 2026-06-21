import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

let db: SqlJsDatabase | null = null
let dbPath: string = ''

export interface ConversationRow {
  id: string
  title: string
  is_research: number
  created_at: number
  updated_at: number
  pinned: number
  tags: string
  last_read_at: number
  tool_chain: string
}

export interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  sources: string | null
  timestamp: number
}

export interface SettingsRow {
  key: string
  value: string
}

async function getDbPath(): Promise<string> {
  const userData = app.getPath('userData')
  return path.join(userData, 'mimir.db')
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs()
  dbPath = await getDbPath()

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      is_research INTEGER NOT NULL DEFAULT 0,
      created_at REAL NOT NULL,
      updated_at REAL NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      last_read_at REAL NOT NULL DEFAULT 0,
      tool_chain TEXT NOT NULL DEFAULT '{}'
    )
  `)

  // Migration: add new columns to existing databases
  const columns = db.exec("PRAGMA table_info(conversations)")
  const columnNames = new Set(columns[0]?.values.flat() || [])
  if (!columnNames.has('pinned')) {
    db.run('ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnNames.has('tags')) {
    db.run("ALTER TABLE conversations ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
  }
  if (!columnNames.has('last_read_at')) {
    db.run('ALTER TABLE conversations ADD COLUMN last_read_at REAL NOT NULL DEFAULT 0')
  }
  if (!columnNames.has('tool_chain')) {
    db.run("ALTER TABLE conversations ADD COLUMN tool_chain TEXT NOT NULL DEFAULT '{}'")
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources TEXT,
      timestamp REAL NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      created_at REAL NOT NULL,
      updated_at REAL NOT NULL
    )
  `)

  save()
}

function save(): void {
  if (!db || !dbPath) return
  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    fs.writeFileSync(dbPath, buffer)
  } catch (err) {
    console.error('Failed to save database:', err)
  }
}

function runInTransaction<T>(fn: () => T): T | undefined {
  if (!db) return undefined
  try {
    db.run('BEGIN TRANSACTION')
    const result = fn()
    db.run('COMMIT')
    save()
    return result
  } catch (err) {
    try { db.run('ROLLBACK') } catch {}
    console.error('Transaction failed:', err)
    return undefined
  }
}

export function loadConversations(): ConversationRow[] {
  if (!db) return []
  try {
    const stmt = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
    const rows: ConversationRow[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as ConversationRow)
    }
    stmt.free()
    return rows
  } catch (err) {
    console.error('Failed to load conversations:', err)
    return []
  }
}

export function loadConversationsWithDetails(): Array<{
  id: string
  title: string
  isResearch: boolean
  createdAt: number
  updatedAt: number
  pinned: boolean
  tags: string[]
  lastReadAt: number
  toolChain: { calls: unknown[]; isActive: boolean }
}> {
  if (!db) return []
  try {
    const stmt = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
    const rows: Array<{
      id: string
      title: string
      isResearch: boolean
      createdAt: number
      updatedAt: number
      pinned: boolean
      tags: string[]
      lastReadAt: number
      toolChain: { calls: unknown[]; isActive: boolean }
    }> = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as ConversationRow
      let tags: string[] = []
      try {
        tags = row.tags ? JSON.parse(row.tags) : []
      } catch {
        tags = []
      }
      let toolChain: { calls: unknown[]; isActive: boolean } = { calls: [], isActive: false }
      try {
        toolChain = row.tool_chain ? JSON.parse(row.tool_chain) : { calls: [], isActive: false }
      } catch {
        toolChain = { calls: [], isActive: false }
      }
      rows.push({
        id: row.id,
        title: row.title,
        isResearch: row.is_research === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        pinned: row.pinned === 1,
        tags,
        lastReadAt: row.last_read_at,
        toolChain,
      })
    }
    stmt.free()
    return rows
  } catch (err) {
    console.error('Failed to load conversations:', err)
    return []
  }
}

export function createConversation(id: string, title: string, isResearch: boolean): void {
  runInTransaction(() => {
    db!.run(
      'INSERT INTO conversations (id, title, is_research, created_at, updated_at, pinned, tags, last_read_at, tool_chain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, isResearch ? 1 : 0, Date.now(), Date.now(), 0, '[]', Date.now(), '{}']
    )
  })
}

export function updateConversation(id: string, messages: { id: string; role: string; content: string; sources?: string | null; timestamp: number }[]): void {
  runInTransaction(() => {
    db!.run('DELETE FROM messages WHERE conversation_id = ?', [id])
    const seen = new Set<string>()
    for (const msg of messages) {
      if (seen.has(msg.id)) continue
      seen.add(msg.id)
      db!.run('INSERT INTO messages (id, conversation_id, role, content, sources, timestamp) VALUES (?, ?, ?, ?, ?, ?)', [msg.id, id, msg.role, msg.content, msg.sources || null, msg.timestamp])
    }
    db!.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [Date.now(), id])
  })
}

export function renameConversation(id: string, title: string): void {
  runInTransaction(() => {
    db!.run('UPDATE conversations SET title = ? WHERE id = ?', [title, id])
  })
}

export function updateConversationFields(id: string, fields: { pinned?: boolean; tags?: string[]; lastReadAt?: number; toolChain?: { calls: unknown[]; isActive: boolean } }): void {
  runInTransaction(() => {
    if (fields.pinned !== undefined) {
      db!.run('UPDATE conversations SET pinned = ? WHERE id = ?', [fields.pinned ? 1 : 0, id])
    }
    if (fields.tags !== undefined) {
      db!.run('UPDATE conversations SET tags = ? WHERE id = ?', [JSON.stringify(fields.tags), id])
    }
    if (fields.lastReadAt !== undefined) {
      db!.run('UPDATE conversations SET last_read_at = ? WHERE id = ?', [fields.lastReadAt, id])
    }
    if (fields.toolChain !== undefined) {
      db!.run('UPDATE conversations SET tool_chain = ? WHERE id = ?', [JSON.stringify(fields.toolChain), id])
    }
  })
}

export function deleteConversation(id: string): void {
  runInTransaction(() => {
    db!.run('DELETE FROM messages WHERE conversation_id = ?', [id])
    db!.run('DELETE FROM conversations WHERE id = ?', [id])
  })
}

export function loadMessages(conversationId: string): MessageRow[] {
  if (!db) return []
  try {
    const stmt = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC')
    stmt.bind([conversationId])
    const rows: MessageRow[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as MessageRow)
    }
    stmt.free()
    return rows
  } catch (err) {
    console.error('Failed to load messages:', err)
    return []
  }
}

export function loadSettings(): Record<string, string> {
  if (!db) return {}
  try {
    const stmt = db.prepare('SELECT key, value FROM settings')
    const result: Record<string, string> = {}
    while (stmt.step()) {
      const row = stmt.getAsObject() as { key: string; value: string }
      result[row.key] = row.value
    }
    stmt.free()
    return result
  } catch (err) {
    console.error('Failed to load settings:', err)
    return {}
  }
}

export interface SkillRow {
  id: string
  name: string
  description: string
  instructions: string
  enabled: number
  created_at: number
  updated_at: number
}

export function loadSkills(): SkillRow[] {
  if (!db) return []
  try {
    const stmt = db.prepare('SELECT * FROM skills ORDER BY updated_at DESC')
    const rows: SkillRow[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SkillRow)
    }
    stmt.free()
    return rows
  } catch (err) {
    console.error('Failed to load skills:', err)
    return []
  }
}

export function saveSkill(skill: { id: string; name: string; description: string; instructions: string; enabled: boolean; createdAt: number; updatedAt: number }): void {
  runInTransaction(() => {
    db!.run(
      'INSERT OR REPLACE INTO skills (id, name, description, instructions, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [skill.id, skill.name, skill.description, skill.instructions, skill.enabled ? 1 : 0, skill.createdAt, skill.updatedAt]
    )
  })
}

export function deleteSkill(id: string): void {
  runInTransaction(() => {
    db!.run('DELETE FROM skills WHERE id = ?', [id])
  })
}

export function saveSetting(key: string, value: string): void {
  runInTransaction(() => {
    db!.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  })
}
