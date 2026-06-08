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
      updated_at REAL NOT NULL
    )
  `)
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
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  fs.writeFileSync(dbPath, buffer)
}

export function loadConversations(): ConversationRow[] {
  if (!db) return []
  const stmt = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
  const rows: ConversationRow[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as ConversationRow)
  }
  stmt.free()
  return rows
}

export function createConversation(id: string, title: string, isResearch: boolean): void {
  if (!db) return
  db.run(
    'INSERT INTO conversations (id, title, is_research, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, title, isResearch ? 1 : 0, Date.now(), Date.now()]
  )
  save()
}

export function updateConversation(id: string, messages: { id: string; role: string; content: string; sources?: string | null; timestamp: number }[]): void {
  if (!db) return

  db.run('DELETE FROM messages WHERE conversation_id = ?', [id])
  for (const msg of messages) {
    db.run('INSERT INTO messages (id, conversation_id, role, content, sources, timestamp) VALUES (?, ?, ?, ?, ?, ?)', [msg.id, id, msg.role, msg.content, msg.sources || null, msg.timestamp])
  }

  db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [Date.now(), id])
  save()
}

export function renameConversation(id: string, title: string): void {
  if (!db) return
  db.run('UPDATE conversations SET title = ? WHERE id = ?', [title, id])
  save()
}

export function deleteConversation(id: string): void {
  if (!db) return
  db.run('DELETE FROM messages WHERE conversation_id = ?', [id])
  db.run('DELETE FROM conversations WHERE id = ?', [id])
  save()
}

export function loadMessages(conversationId: string): MessageRow[] {
  if (!db) return []
  const stmt = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC')
  stmt.bind([conversationId])
  const rows: MessageRow[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as MessageRow)
  }
  stmt.free()
  return rows
}

export function loadSettings(): Record<string, string> {
  if (!db) return {}
  const stmt = db.prepare('SELECT key, value FROM settings')
  const result: Record<string, string> = {}
  while (stmt.step()) {
    const row = stmt.getAsObject() as { key: string; value: string }
    result[row.key] = row.value
  }
  stmt.free()
  return result
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
  const stmt = db.prepare('SELECT * FROM skills ORDER BY updated_at DESC')
  const rows: SkillRow[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as SkillRow)
  }
  stmt.free()
  return rows
}

export function saveSkill(skill: { id: string; name: string; description: string; instructions: string; enabled: boolean; createdAt: number; updatedAt: number }): void {
  if (!db) return
  db.run(
    'INSERT OR REPLACE INTO skills (id, name, description, instructions, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [skill.id, skill.name, skill.description, skill.instructions, skill.enabled ? 1 : 0, skill.createdAt, skill.updatedAt]
  )
  save()
}

export function deleteSkill(id: string): void {
  if (!db) return
  db.run('DELETE FROM skills WHERE id = ?', [id])
  save()
}

export function saveSetting(key: string, value: string): void {
  if (!db) return
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  save()
}
