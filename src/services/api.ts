import OpenAI from 'openai'
import type { Settings } from '../types'

let client: OpenAI | null = null

export function getClient(settings: Settings): OpenAI {
  let baseURL = settings.apiEndpoint.replace(/\/+$/, '')
  if (!baseURL.endsWith('/v1')) baseURL += '/v1'
  if (client && client.baseURL === baseURL) return client
  client = new OpenAI({
    baseURL,
    apiKey: settings.apiKey || 'not-needed',
    dangerouslyAllowBrowser: true,
  })
  return client
}

export async function chat(
  settings: Settings,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  onChunk?: (chunk: string) => void
): Promise<string> {
  const c = getClient(settings)
  const stream = await c.chat.completions.create({
    model: settings.model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: true,
  })

  let full = ''
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || ''
    full += content
    onChunk?.(content)
  }
  return full
}
