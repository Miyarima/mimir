import pLimit from 'p-limit'
import { generateJSON } from './providers'
import { systemPrompt } from './prompt'
import { trimPrompt } from './text-splitter'
import { crawlUrl } from './crawl'
import { search } from '../search'
import type { Settings, Skill, Source, ResearchProgress, ResearchStep } from '../../types'

const ConcurrencyLimit = 2

type SerpQuery = {
  query: string
  researchGoal: string
}

async function generateSerpQueries({
  query,
  settings,
  numQueries = 3,
  learnings,
  skills,
}: {
  query: string
  settings: Settings
  numQueries?: number
  learnings?: string[]
  skills?: Skill[]
}): Promise<SerpQuery[]> {
  const res = await generateJSON<{ queries: SerpQuery[] }>(
    settings,
    systemPrompt(skills),
    `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
      learnings
        ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join('\n')}`
        : ''
    }`,
    {
      description: `{ "queries": [{ "query": string, "researchGoal": string }] } — a JSON object with a "queries" array of up to ${numQueries} objects, each with a "query" string (the SERP search query) and "researchGoal" string (detailed goal of what this query aims to find)`,
    },
    AbortSignal.timeout(30_000),
  )

  return res.queries.slice(0, numQueries)
}

async function processSerpResult({
  query,
  contents,
  settings,
  numLearnings = 3,
  numFollowUpQuestions = 3,
  skills,
}: {
  query: string
  contents: string[]
  settings: Settings
  numLearnings?: number
  numFollowUpQuestions?: number
  skills?: Skill[]
}) {
  const res = await generateJSON<{ learnings: string[]; followUpQuestions: string[] }>(
    settings,
    systemPrompt(skills),
    trimPrompt(
      `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contents
        .map(content => `<content>\n${content}\n</content>`)
        .join('\n')}</contents>`,
    ),
    {
      description: `{ "learnings": string[], "followUpQuestions": string[] } — a JSON object with a "learnings" array (up to ${numLearnings} string learnings) and a "followUpQuestions" array (up to ${numFollowUpQuestions} string follow-up questions)`,
    },
    AbortSignal.timeout(60_000),
  )

  return res
}

async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
  settings,
  skills,
}: {
  prompt: string
  learnings: string[]
  visitedUrls: string[]
  settings: Settings
  skills?: Skill[]
}) {
  const learningsString = learnings.map(l => `<learning>\n${l}\n</learning>`).join('\n')

  const res = await generateJSON<{ reportMarkdown: string }>(
    settings,
    systemPrompt(skills),
    trimPrompt(
      `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 3 or more pages, include ALL the learnings from research:\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    {
      description: `{ "reportMarkdown": string } — a JSON object with a single "reportMarkdown" field containing the full report in Markdown format`,
    },
  )

  const urlsSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`
  return res.reportMarkdown + urlsSection
}

async function writeFinalAnswer({
  prompt,
  learnings,
  settings,
  skills,
}: {
  prompt: string
  learnings: string[]
  settings: Settings
  skills?: Skill[]
}) {
  const learningsString = learnings.map(l => `<learning>\n${l}\n</learning>`).join('\n')

  const res = await generateJSON<{ exactAnswer: string }>(
    settings,
    systemPrompt(skills),
    trimPrompt(
      `Given the following prompt from the user, write a final answer on the topic using the learnings from research. Follow the format specified in the prompt. Do not yap or babble or include any other text than the answer besides the format specified in the prompt. Keep the answer as concise as possible - usually it should be just a few words or maximum a sentence.\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from research on the topic that you can use to help answer the prompt:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    {
      description: `{ "exactAnswer": string } — a JSON object with a single "exactAnswer" field containing the short, concise answer`,
    },
  )

  return res.exactAnswer
}

export async function deepResearch({
  query,
  settings,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
  onProgress,
  onStep,
  onSerpQueries,
  stepCounter = { current: 0 },
  skills,
}: {
  query: string
  settings: Settings
  breadth: number
  depth: number
  learnings?: string[]
  visitedUrls?: string[]
  onProgress?: (progress: ResearchProgress) => void
  onStep?: (step: ResearchStep) => void
  onSerpQueries?: (queries: string[]) => void
  stepCounter?: { current: number }
  skills?: Skill[]
}): Promise<{ learnings: string[]; visitedUrls: string[] }> {
  const totalDepth = depth
  const totalBreadth = breadth

  onProgress?.({
    stage: 'generating_queries',
    currentDepth: depth,
    totalDepth,
    currentBreadth: breadth,
    totalBreadth,
    totalQueries: 0,
    completedQueries: 0,
  })

  const serpQueries = await generateSerpQueries({
    query,
    settings,
    learnings,
    numQueries: breadth,
    skills,
  })

  onSerpQueries?.(serpQueries.map(sq => sq.query))

  onProgress?.({
    stage: 'searching',
    currentDepth: depth,
    totalDepth,
    currentBreadth: breadth,
    totalBreadth,
    totalQueries: serpQueries.length,
    completedQueries: 0,
    currentQuery: serpQueries[0]?.query,
  })

  const limit = pLimit(ConcurrencyLimit)

  const results = await Promise.all(
    serpQueries.map(serpQuery =>
      limit(async () => {
        try {
          const sources = await search(serpQuery.query, settings)

          const newUrls = sources.map(s => s.url)
          let contents: string[] = []

          if (settings.crawl4aiEndpoint) {
            const crawlLimit = pLimit(3)
            const crawlResults = await Promise.all(
              sources.map(s =>
                crawlLimit(async () => {
                  try {
                    return await crawlUrl(s.url, settings.crawl4aiEndpoint!)
                  } catch {
                    return s.snippet
                  }
                }),
              ),
            )
            contents = crawlResults.filter(Boolean) as string[]
          } else {
            contents = sources.map(s => s.snippet)
          }

          const newBreadth = Math.ceil(breadth / 2)
          const newDepth = depth - 1

          onProgress?.({
            stage: 'analyzing',
            currentDepth: depth,
            totalDepth,
            currentBreadth: breadth,
            totalBreadth,
            currentQuery: serpQuery.query,
            totalQueries: serpQueries.length,
            completedQueries: serpQueries.indexOf(serpQuery) + 1,
          })

          const newLearnings = await processSerpResult({
            query: serpQuery.query,
            contents,
            settings,
            numFollowUpQuestions: newBreadth,
            skills,
          })
          const allLearnings = [...learnings, ...newLearnings.learnings]
          const allUrls = [...visitedUrls, ...newUrls]

          stepCounter.current++
          onStep?.({
            step: stepCounter.current,
            query: serpQuery.query,
            learnings: newLearnings.learnings,
            sources,
          })

          if (newDepth > 0) {
            onProgress?.({
              stage: 'generating_queries',
              currentDepth: newDepth,
              totalDepth,
              currentBreadth: newBreadth,
              totalBreadth,
              completedQueries: serpQueries.indexOf(serpQuery) + 1,
              currentQuery: serpQuery.query,
              totalQueries: serpQueries.length,
            })

            const nextQuery = `
Previous research goal: ${serpQuery.researchGoal}
Follow-up research directions: ${newLearnings.followUpQuestions.map(q => `\n${q}`).join('')}
`.trim()

            return deepResearch({
              query: nextQuery,
              settings,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allLearnings,
              visitedUrls: allUrls,
              onProgress,
              onStep,
              onSerpQueries,
              stepCounter,
              skills,
            })
          }

          onProgress?.({
            stage: 'searching',
            currentDepth: 0,
            totalDepth,
            currentBreadth: breadth,
            totalBreadth,
            completedQueries: serpQueries.indexOf(serpQuery) + 1,
            totalQueries: serpQueries.length,
          })

          return { learnings: allLearnings, visitedUrls: allUrls }
        } catch (e: any) {
          console.error(`Error researching query "${serpQuery.query}":`, e)
          return { learnings: [], visitedUrls: [] }
        }
      }),
    ),
  )

  return {
    learnings: [...new Set(results.flatMap(r => r.learnings))],
    visitedUrls: [...new Set(results.flatMap(r => r.visitedUrls))],
  }
}

export async function runDeepResearch(
  question: string,
  settings: Settings,
  onProgress: (progress: ResearchProgress) => void,
  onStep: (step: ResearchStep) => void,
  onReportChunk: (chunk: string) => void,
  onSources: (query: string, sources: Source[]) => void,
  onSerpQueries?: (queries: string[]) => void,
  skills?: Skill[],
): Promise<{ report: string; learnings: string[]; sources: Source[] }> {
  const breadth = settings.researchBreadth || 4
  const depth = settings.researchDepth || 2

  onProgress({
    stage: 'generating_queries',
    currentDepth: depth,
    totalDepth: depth,
    currentBreadth: breadth,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
  })

  const { learnings, visitedUrls } = await deepResearch({
    query: question,
    settings,
    breadth,
    depth,
    onProgress,
    onStep,
    onSerpQueries,
    skills,
  })

  onProgress({
    stage: 'reporting',
    currentDepth: 0,
    totalDepth: depth,
    currentBreadth: 0,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
  })

  const report = await writeFinalReport({
    prompt: question,
    learnings,
    visitedUrls,
    settings,
    skills,
  })

  onReportChunk(report)

  const sources = visitedUrls.map((url: string) => ({
    title: url,
    url,
    snippet: '',
  }))

  onProgress({
    stage: 'complete',
    currentDepth: 0,
    totalDepth: depth,
    currentBreadth: 0,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
  })

  return { report, learnings, sources }
}
