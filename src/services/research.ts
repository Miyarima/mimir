import type { ResearchProgress, ResearchResult, ResearchStep, Settings, Skill, Source } from '../types'
import { runDeepResearch as runNewDeepResearch } from './deep-research/deep-research'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export async function runDeepResearch(
  question: string,
  settings: Settings,
  onStep: (step: ResearchStep) => void,
  onReport: (chunk: string) => void,
  onSources?: (query: string, sources: Source[]) => void,
  onProgress?: (ResearchProgress) => void,
  onSerpQueries?: (queries: string[]) => void,
  skills?: Skill[],
): Promise<ResearchResult> {
  const allSources: Source[] = []
  const steps: ResearchStep[] = []

  const sourceHandler = onSources || (() => {})

  const result = await runNewDeepResearch(
    question,
    settings,
    onProgress || (() => {}),
    (step) => {
      steps.push(step)
      onStep(step)
    },
    () => {},
    (query, sources) => {
      allSources.push(...sources)
      sourceHandler(query, sources)
    },
    onSerpQueries,
    skills,
  )

  onReport(result.report)

  const uniqueSources = Array.from(
    new Map(allSources.map(s => [s.url, s])).values()
  )

  return {
    id: generateId(),
    question,
    report: result.report,
    steps,
    sources: uniqueSources,
    timestamp: Date.now(),
  }
}
