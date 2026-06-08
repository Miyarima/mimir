import OpenAI from 'openai'
import type { Settings, Skill } from '../types'

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

function matchesSkill(text: string | undefined, skill: Skill): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  const name = skill.name.toLowerCase()
  if (t.includes(name)) return true
  const desc = skill.description.toLowerCase()
  return [...name.split(/\s+/), ...desc.split(/\s+/)]
    .filter(w => w.length > 3)
    .some(kw => t.includes(kw))
}

export function buildMessagesWithSkills(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  skills: Skill[],
  userQuery?: string,
  lastAssistantContent?: string,
): { role: 'user' | 'assistant' | 'system'; content: string }[] {
  const enabled = skills.filter(s => s.enabled)
  if (enabled.length === 0) return messages

  // Always include a reference listing available skills
  const refLines = enabled.map(s => `- ${s.name}: ${s.description || 'No description'}`)
  const refMessage: { role: 'user' | 'assistant' | 'system'; content: string } = {
    role: 'system',
    content: `You have access to these skills:\n${refLines.join('\n')}\n\nUse them when appropriate for the conversation.`,
  }

  // Inject full instructions for skills that are relevant to the current query
  // or that the model itself mentioned in its last response
  const extraMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = []
  for (const skill of enabled) {
    if (matchesSkill(userQuery, skill) || matchesSkill(lastAssistantContent, skill)) {
      extraMessages.push({
        role: 'system',
        content: skill.instructions,
      })
    }
  }

  return [refMessage, ...extraMessages, ...messages]
}
