import type { ResearchResult, ResearchStep, Settings, Source } from '../types'
import { chat } from './api'
import { search } from './search'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export async function runDeepResearch(
  question: string,
  settings: Settings,
  onStep: (step: ResearchStep) => void,
  onReport: (chunk: string) => void,
  onSources?: (query: string, sources: Source[]) => void
): Promise<ResearchResult> {
  const allSources: Source[] = []
  const steps: ResearchStep[] = []
  const maxSteps = settings.maxResearchSteps || 5

  const subQueriesPrompt = `You are a research assistant. Break down this question into ${maxSteps} specific search queries to comprehensively answer it. Return ONLY a numbered list of search queries, one per line, no explanation.

Question: ${question}`

  const queriesText = await chat(settings, [
    { role: 'system', content: 'You are a research assistant. Output only the requested format.' },
    { role: 'user', content: subQueriesPrompt },
  ])

  const queries = queriesText
    .split('\n')
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, maxSteps)

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]

    const sources = await search(query, settings)
    allSources.push(...sources)
    onSources?.(query, sources)

    const context = sources.map(s => `Title: ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}`).join('\n\n')

    const analysisPrompt = `You are researching the question: "${question}"

Search results for query "${query}":
${context || 'No search results found.'}

Provide a concise analysis of these findings relevant to the main question. Include key facts, statistics, and insights.`

    const findings = await chat(settings, [
      { role: 'system', content: 'You are a thorough research analyst. Provide detailed, factual analysis.' },
      { role: 'user', content: analysisPrompt },
    ])

    const step: ResearchStep = {
      step: i + 1,
      query,
      findings,
      sources,
    }
    steps.push(step)
    onStep(step)
  }

  const synthesisPrompt = `You are a research report writer. Synthesize the following research findings into a comprehensive, well-structured report.

Original Question: "${question}"

Research Findings:
${steps.map(s => `## Step ${s.step}: ${s.query}\n${s.findings}`).join('\n\n')}

Write a comprehensive report that:
1. Directly answers the original question
2. Cites specific sources (use [Source N] notation referencing the source URLs)
3. Covers all key aspects found in the research
4. Highlights any conflicting findings or open questions
5. Provides a conclusion with actionable takeaways

Format the report with clear markdown headings and structure.`

  let report = ''
  await chat(settings, [
    { role: 'system', content: 'You are an expert report writer. Write comprehensive, well-structured markdown reports.' },
    { role: 'user', content: synthesisPrompt },
  ], (chunk) => {
    report += chunk
    onReport(chunk)
  })

  const uniqueSources = Array.from(
    new Map(allSources.map(s => [s.url, s])).values()
  )

  return {
    id: generateId(),
    question,
    report,
    steps,
    sources: uniqueSources,
    timestamp: Date.now(),
  }
}
