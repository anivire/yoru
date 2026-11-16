import type { SkipKind, SkipTime } from '@yoru/shared'
import { env } from '../env'
import { UpstreamError, cached } from '../lib/http'
import { featureEnabled } from '../lib/features'
import { sourceUrl } from '../lib/sources'

const HOUR = 60 * 60_000
const MAX_LENGTH_DIFF = 60

const TYPE_KIND: Record<string, SkipKind> = { op: 'op', 'mixed-op': 'op', ed: 'ed', 'mixed-ed': 'ed', recap: 'recap' }

interface AniSkipResult {
  interval: { startTime: number; endTime: number }
  skipType: string
  episodeLength: number
}

async function request(malId: number, episode: number, length: number): Promise<AniSkipResult[]> {
  const types = Object.keys(TYPE_KIND).map((t) => `types[]=${encodeURIComponent(t)}`).join('&')
  const url = `${sourceUrl('aniskip')}/v2/skip-times/${malId}/${episode}?${types}&episodeLength=${Math.round(length)}`
  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': env.userAgent }, signal: AbortSignal.timeout(8000) })
  } catch (error) {
    throw new UpstreamError('aniskip', 0, `AniSkip unreachable: ${(error as Error).message}`)
  }
  if (res.status === 404) return []
  if (!res.ok) throw new UpstreamError('aniskip', res.status, `AniSkip HTTP ${res.status}`)
  const body = (await res.json()) as { found?: boolean; results?: AniSkipResult[] }
  return body.found ? (body.results ?? []) : []
}

function pick(results: AniSkipResult[], length: number): SkipTime[] {
  const best = new Map<SkipKind, { result: AniSkipResult; score: number }>()
  for (const result of results) {
    const kind = TYPE_KIND[result.skipType]
    if (!kind) continue
    const diff = length > 0 ? Math.abs(result.episodeLength - length) : 0
    if (length > 0 && diff > MAX_LENGTH_DIFF) continue
    const score = diff + (result.skipType.startsWith('mixed') ? 0.5 : 0)
    const current = best.get(kind)
    if (!current || score < current.score) best.set(kind, { result, score })
  }
  return [...best.entries()]
    .map(([kind, { result }]) => ({ kind, start: result.interval.startTime, end: result.interval.endTime }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)
}

export function skipTimes(malId: number, episode: number, length: number): Promise<SkipTime[]> {
  if (!featureEnabled('skip')) return Promise.resolve([])
  const rounded = Math.round(length)
  return cached(`aniskip:${malId}:${episode}:${rounded}`, 12 * HOUR, async () => pick(await request(malId, episode, rounded), rounded))
}
