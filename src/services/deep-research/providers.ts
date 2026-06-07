import OpenAI from 'openai'
import type { Settings } from '../../types'

let client: OpenAI | null = null

export function getClient(settings: Settings): OpenAI {
  let baseURL = settings.apiEndpoint.replace(/\/+$/, '')
  if (!baseURL.endsWith('/v1')) baseURL += '/v1'
  if (client && client.baseURL === baseURL) return client
  client = new OpenAI({
    baseURL,
    apiKey: settings.apiKey || 'sk-dummy',
    dangerouslyAllowBrowser: true,
  })
  return client
}

function extractJSON(text: string): string {
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  let start = cleaned.indexOf('{')
  if (start === -1) start = cleaned.indexOf('[')
  if (start === -1) return cleaned

  let depth = 0
  let inString = false
  let escape = false
  let end = -1

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) { end = i + 1; break }
    }
  }

  if (end === -1) return cleaned.slice(start)
  return cleaned.slice(start, end)
}

function fixJSON(text: string): string {
  let s = text.replace(/,(\s*[}\]])/g, '$1')
  s = s.replace(/'/g, '"')
  s = s.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
  return s
}

function escapeNewlinesInStrings(text: string): string {
  let result = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') { inString = !inString; result += ch; continue }
    if (inString && ch === '\n') { result += '\\n'; continue }
    if (inString && ch === '\r') { result += '\\r'; continue }
    if (inString && ch === '\t') { result += '\\t'; continue }
    result += ch
  }
  return result
}

function tryParse(text: string): any {
  // Strategy 1: direct parse
  try { return JSON.parse(text) } catch {}

  // Strategy 2: extract JSON substring
  const extracted = extractJSON(text)
  if (extracted !== text) {
    try { return JSON.parse(extracted) } catch {}
  }

  // Strategy 3: escape unescaped newlines/tabs inside strings (common with local models)
  const escaped = escapeNewlinesInStrings(extracted)
  try { return JSON.parse(escaped) } catch {}

  // Strategy 4: fix then parse
  const fixed = fixJSON(escaped)
  try { return JSON.parse(fixed) } catch {}

  // Strategy 5: fix + extract
  const reExtract = extractJSON(fixed)
  if (reExtract !== fixed) {
    try { return JSON.parse(reExtract) } catch {}
  }

  throw new Error(`Invalid JSON response from model. Raw text:\n${text.slice(0, 500)}`)
}

export async function generateJSON<T>(
  settings: Settings,
  system: string,
  prompt: string,
  schema: { description: string },
  signal?: AbortSignal,
): Promise<T> {
  const c = getClient(settings)
  const res = await c.chat.completions.create(
    {
      model: settings.model || 'gpt-4o',
      messages: [
        { role: 'system', content: `${system}\n\nYou must ALWAYS respond with ONLY valid JSON. No markdown, no code blocks, no explanation. Escape newlines and special characters in string values.` },
        {
          role: 'user',
          content: `${prompt}\n\nRespond with valid JSON matching this structure:\n${schema.description}\n\nONLY output the raw JSON object, no other text. Escape all newlines as \\n inside string values.`,
        },
      ],
      temperature: 0,
      stream: false,
    },
    { signal },
  )

  const text = res.choices[0]?.message?.content || ''
  return tryParse(text) as T
}
