import type { Source, Settings } from '../types'

export async function search(query: string, settings: Settings): Promise<Source[]> {
  switch (settings.searchProvider) {
    case 'duckduckgo':
      return searchDuckDuckGo(query)
    case 'tavily':
      return searchTavily(query, settings)
    case 'searxng':
      return searchSearXNG(query, settings)
    default:
      return searchDuckDuckGo(query)
  }
}

async function searchDuckDuckGo(query: string): Promise<Source[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  const html = await res.text()
  const sources: Source[] = []
  const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

  const links = [...html.matchAll(linkRegex)]
  const snippets = [...html.matchAll(snippetRegex)]

  for (let i = 0; i < Math.min(links.length, 5); i++) {
    sources.push({
      title: links[i][2].replace(/<[^>]+>/g, '').trim(),
      url: links[i][1],
      snippet: snippets[i]?.[1]?.replace(/<[^>]+>/g, '').trim() || '',
    })
  }
  return sources
}

async function searchTavily(query: string, settings: Settings): Promise<Source[]> {
  const res = await fetch(settings.searchEndpoint || 'https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: settings.apiKey,
      query,
      max_results: 5,
    }),
  })
  const data = await res.json()
  return (data.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }))
}

async function searchSearXNG(query: string, settings: Settings): Promise<Source[]> {
  const url = `${settings.searchEndpoint.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url)
  const data = await res.json()
  return (data.results || []).slice(0, 5).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }))
}
