import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface ToolExecutionResult {
  success: boolean
  output: string
}

function isPathSafe(targetPath: string): boolean {
  const resolved = path.resolve(targetPath)
  return !resolved.includes('..') || resolved.startsWith(process.cwd())
}

export async function executeTool(name: string, args: Record<string, unknown>, whitelist: string[]): Promise<ToolExecutionResult> {
  try {
    switch (name) {
      case 'read_file': {
        const filePath = String(args.path || '')
        if (!filePath) return { success: false, output: 'No file path provided' }
        if (!fs.existsSync(filePath)) return { success: false, output: `File not found: ${filePath}` }
        const content = fs.readFileSync(filePath, 'utf-8')
        const maxLen = 10000
        if (content.length > maxLen) {
          return { success: true, output: content.slice(0, maxLen) + `\n\n[... truncated, file is ${content.length} chars total]` }
        }
        return { success: true, output: content }
      }

      case 'write_file': {
        const filePath = String(args.path || '')
        const content = String(args.content || '')
        if (!filePath) return { success: false, output: 'No file path provided' }
        fs.writeFileSync(filePath, content, 'utf-8')
        return { success: true, output: `Wrote ${content.length} chars to ${filePath}` }
      }

      case 'list_directory': {
        const dirPath = String(args.path || '.')
        if (!fs.existsSync(dirPath)) return { success: false, output: `Directory not found: ${dirPath}` }
        const items = fs.readdirSync(dirPath, { withFileTypes: true })
        const listing = items
          .map(item => `${item.isDirectory() ? '📁' : '📄'} ${item.name}`)
          .join('\n')
        return { success: true, output: listing || '(empty directory)' }
      }

      case 'run_shell': {
        const command = String(args.command || '')
        if (!command) return { success: false, output: 'No command provided' }
        const cmdBase = command.trim().split(/\s+/)[0]
        if (!whitelist.includes(cmdBase)) {
          return { success: false, output: `Command "${cmdBase}" is not in the whitelist. User approval required.` }
        }
        return new Promise<ToolExecutionResult>((resolve) => {
          exec(command, { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
              resolve({ success: false, output: `Error: ${err.message}\n${stderr}` })
            } else {
              resolve({ success: true, output: stdout || stderr || '(no output)' })
            }
          })
        })
      }

      default:
        return { success: false, output: `Unknown tool: ${name}` }
    }
  } catch (err: any) {
    return { success: false, output: `Error: ${err.message}` }
  }
}
