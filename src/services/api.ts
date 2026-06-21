import OpenAI from 'openai'
import type { Settings, Skill } from '../types'

let client: OpenAI | null = null

export function getClient(settings: Settings): OpenAI {
  let baseURL = settings.apiEndpoint.replace(/\/+$/, '')
  if (!baseURL.endsWith('/v1')) baseURL += '/v1'
  const cacheKey = `${baseURL}|${settings.apiKey || ''}`
  if (client && (client as any).__cacheKey === cacheKey) return client
  client = new OpenAI({
    baseURL,
    apiKey: settings.apiKey || 'not-needed',
    dangerouslyAllowBrowser: true,
  })
  ;(client as any).__cacheKey = cacheKey
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

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path. Returns the file content as a string.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The absolute or relative path to the file to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Write content to a file at the given path. Creates the file if it does not exist, or overwrites it if it does.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The absolute or relative path to the file to write' },
          content: { type: 'string', description: 'The content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_directory',
      description: 'List the contents of a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The directory path to list. Defaults to current directory.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_shell',
      description: 'Run a shell command. Only commands in the whitelist will be executed without explicit user approval. Returns the command output.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to run' },
        },
        required: ['command'],
      },
    },
  },
]

export interface ToolCallRequest {
  id: string
  name: string
  arguments: string
}

export async function chatWithTools(
  settings: Settings,
  messages: { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string }[],
  enabledTools: string[],
  onChunk?: (chunk: string) => void
): Promise<{ content: string; toolCalls: ToolCallRequest[] }> {
  const c = getClient(settings)
  const tools = TOOL_DEFINITIONS.filter(t => enabledTools.includes(t.function.name))

  // Add a system hint about tool efficiency if tools are enabled
  if (tools.length > 0) {
    const hint = {
      role: 'system' as const,
      content: 'You have access to tools. Use them efficiently: avoid calling the same tool with the same arguments multiple times, batch related operations, and prefer reading files once. Keep tool usage minimal and purposeful.'
    }
    // Only add the hint if there's no existing system message about tools
    const hasToolHint = messages.some(m => m.role === 'system' && m.content.includes('Use them efficiently'))
    if (!hasToolHint) {
      messages = [hint, ...messages]
    }
  }

  const params: any = {
    model: settings.model,
    messages,
    stream: true,
  }
  if (tools.length > 0) {
    params.tools = tools
  }

  const stream = await c.chat.completions.create(params)

  let full = ''
  const toolCalls: ToolCallRequest[] = []
  const toolCallBuffers: Record<number, { id: string; name: string; arguments: string }> = {}

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta as any
    if (delta?.content) {
      full += delta.content
      onChunk?.(delta.content)
    }
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index
        if (!toolCallBuffers[idx]) {
          toolCallBuffers[idx] = { id: '', name: '', arguments: '' }
        }
        if (tc.id) toolCallBuffers[idx].id = tc.id
        if (tc.function?.name) toolCallBuffers[idx].name = tc.function.name
        if (tc.function?.arguments) toolCallBuffers[idx].arguments += tc.function.arguments
      }
    }
  }

  for (const key of Object.keys(toolCallBuffers)) {
    const tc = toolCallBuffers[Number(key)]
    if (tc.id && tc.name) {
      toolCalls.push({ id: tc.id, name: tc.name, arguments: tc.arguments })
    }
  }

  return { content: full, toolCalls }
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
