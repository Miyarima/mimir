import { getClient } from './api'
import type { Settings } from '../types'

export interface GeneratedSkill {
  name: string
  description: string
  instructions: string
}

export async function generateSkill(settings: Settings, userDescription: string): Promise<GeneratedSkill> {
  const client = getClient(settings)
  const res = await client.chat.completions.create({
    model: settings.model || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a skill generator for an AI assistant. Generate a skill definition based on the user's description.

A skill has:
- name: A short, descriptive name (2-5 words)
- description: A one-line summary of what the skill does
- instructions: Detailed system prompt / instructions for the AI to follow. This should be thorough and specific.

You MUST respond with ONLY valid JSON. No markdown, no code blocks, no explanation.`,
      },
      {
        role: 'user',
        content: `Generate a skill for: ${userDescription}

Respond with valid JSON matching this structure:
{ "name": string, "description": string, "instructions": string }

ONLY output the raw JSON object, no other text.`,
      },
    ],
    temperature: 0.7,
    stream: false,
  })

  const text = res.choices[0]?.message?.content || ''
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.slice(start, end + 1)
  }
  return JSON.parse(cleaned) as GeneratedSkill
}