import { exec } from 'child_process'
import net from 'net'

const DEFAULT_ENDPOINT = 'http://localhost:8000'

let _starting = false

export function isStarting(): boolean {
  return _starting
}

export interface Crawl4AIStatus {
  running: boolean
  dockerAvailable: boolean
  containerExists: boolean
  starting: boolean
  endpoint: string
}

function tcpCheck(host: string, port: number, timeout = 3000): Promise<boolean> {
  return new Promise(resolve => {
    const sock = new net.Socket()
    sock.setTimeout(timeout)
    sock.on('connect', () => { sock.destroy(); resolve(true) })
    sock.on('error', () => { sock.destroy(); resolve(false) })
    sock.on('timeout', () => { sock.destroy(); resolve(false) })
    sock.connect(port, host)
  })
}

function execPromise(cmd: string, timeout = 300_000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise(resolve => {
    exec(cmd, { timeout }, (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', code: err?.code ?? (err ? 1 : 0) })
    })
  })
}

async function portOpen(endpoint: string): Promise<boolean> {
  const base = endpoint.replace(/\/+$/, '').replace(/^https?:\/\//, '')
  const [host, portStr = '8000'] = base.split(':')
  const port = parseInt(portStr, 10) || 8000
  return tcpCheck(host, port, 3000)
}

export async function checkStatus(endpoint?: string): Promise<Crawl4AIStatus> {
  const ep = (endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, '')

  const reachable = await portOpen(ep)

  const dockerResult = await execPromise(
    'docker ps --filter name=crawl4ai --format "{{.Status}}" 2>/dev/null || echo "DOCKER_NOT_FOUND"',
    5000,
  )
  const dockerAvailable = !dockerResult.stdout.includes('DOCKER_NOT_FOUND') && !dockerResult.stderr
  const containerRunning = dockerResult.stdout.trim().length > 0 && !dockerResult.stdout.includes('DOCKER_NOT_FOUND')

  return {
    running: reachable || containerRunning,
    dockerAvailable,
    containerExists: containerRunning,
    starting: _starting,
    endpoint: ep,
  }
}

export async function startCrawl4AI(endpoint?: string): Promise<boolean> {
  const ep = (endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, '')

  const status = await checkStatus(ep)
  if (status.running) return true
  if (!status.dockerAvailable) return false

  _starting = true

  try {
    // Pull first (long timeout) so the run below is fast
    console.log('Pulling unclecode/crawl4ai image (this may take a while)…')
    await execPromise('docker pull unclecode/crawl4ai 2>/dev/null', 300_000)

    // Start existing container or create a new one
    const cmd = 'docker start crawl4ai 2>/dev/null || docker run -d --name crawl4ai -p 8000:8000 unclecode/crawl4ai'
    console.log('Starting Crawl4AI container…')
    const result = await execPromise(cmd, 30_000)

    if (result.stderr && !result.stderr.includes('2>/dev/null')) {
      console.error('Crawl4AI start error:', result.stderr)
    }

    // Wait for the port to open
    for (let i = 0; i < 30; i++) {
      const ok = await portOpen(ep)
      if (ok) {
        console.log('Crawl4AI is now reachable')
        return true
      }
      await new Promise(r => setTimeout(r, 2000))
    }

    console.error('Crawl4AI container started but never became reachable')
    return false
  } finally {
    _starting = false
  }
}

export async function stopCrawl4AI(): Promise<boolean> {
  const result = await execPromise('docker stop crawl4ai 2>/dev/null', 15_000)
  return result.code === 0 || result.stdout.includes('crawl4ai')
}
