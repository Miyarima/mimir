export interface ParsedSkill {
  name: string
  description: string
  instructions: string
}

export function parseSkillMarkdown(text: string): ParsedSkill {
  const result: ParsedSkill = { name: '', description: '', instructions: text.trim() }
  const trimmed = text.trim()
  if (!trimmed.startsWith('---')) return result

  const endIdx = trimmed.indexOf('---', 3)
  if (endIdx === -1) return result

  const frontmatter = trimmed.slice(3, endIdx).trim()
  const body = trimmed.slice(endIdx + 3).trim()

  const lines = frontmatter.split('\n')
  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim().toLowerCase()
    const value = line.slice(colonIdx + 1).trim()
    if (key === 'name') result.name = value
    else if (key === 'description') result.description = value
  }

  result.instructions = body || result.instructions
  return result
}

export function toSkillMarkdown(name: string, description: string, instructions: string): string {
  let md = '---\n'
  md += `name: ${name}\n`
  md += `description: ${description}\n`
  md += '---\n\n'
  md += instructions
  return md
}