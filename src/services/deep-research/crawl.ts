interface CrawlResult {
  markdown: string
}

export async function crawlUrl(url: string, endpoint: string): Promise<string> {
  const base = endpoint.replace(/\/+$/, '')
  const res = await fetch(`${base}/crawl_sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls: [url],
      priority: 10,
      word_count_threshold: 10,
      extraction_strategy: 'NoExtractionStrategy',
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Crawl4AI error (${res.status}): ${text || res.statusText}`)
  }

  const data = await res.json()
  if (data.status === 'error') {
    throw new Error(`Crawl4AI crawl error: ${data.error || 'unknown'}`)
  }

  const result: CrawlResult | undefined = data.result
  if (!result?.markdown) {
    return ''
  }

  return result.markdown
}
