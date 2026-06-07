interface CrawlResult {
  markdown: string
}

function extractMarkdown(result: any): string {
  if (!result) return ''
  if (typeof result.markdown === 'string') return result.markdown
  return result.markdown?.raw_markdown || result.markdown?.fit_markdown || ''
}

export async function crawlUrl(url: string, endpoint: string): Promise<string> {
  const base = endpoint.replace(/\/+$/, '')
  const body = JSON.stringify({
    urls: [url],
    priority: 10,
    word_count_threshold: 10,
    extraction_strategy: 'NoExtractionStrategy',
  })

  // Try new API format first (/crawl), fall back to old (/crawl_sync)
  for (const path of ['/crawl', '/crawl_sync']) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        if (path === '/crawl_sync') {
          const text = await res.text().catch(() => '')
          throw new Error(`Crawl4AI error (${res.status}): ${text || res.statusText}`)
        }
        continue
      }

      const data = await res.json()

      if (data.success === false) {
        throw new Error(data.error_message || 'Crawl failed')
      }
      if (data.status === 'error') {
        throw new Error(data.error || 'Crawl failed')
      }

      // New format: { results: [{ markdown: { raw_markdown: '...' } }] }
      if (data.results?.length > 0) {
        return extractMarkdown(data.results[0])
      }

      // Old format: { result: { markdown: '...' } }
      if (data.result) {
        return extractMarkdown(data.result)
      }

      // Direct response
      const markdown = extractMarkdown(data)
      if (markdown) return markdown

      if (path === '/crawl_sync') {
        return ''
      }
    } catch (e) {
      if (path === '/crawl_sync') throw e
    }
  }

  return ''
}
