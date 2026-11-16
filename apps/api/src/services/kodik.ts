import { env } from '../env'
import { UpstreamError, cached } from '../lib/http'
import { kodikToken, sourceEnabled, sourceUrl } from '../lib/sources'

export interface KodikResult {
  id: string
  type: string
  link: string
  title: string | null
  quality: string | null
  last_season?: number | null
  translation: { id: number; title: string; type: 'voice' | 'subtitles' }
  seasons?: Record<string, { link: string; episodes?: Record<string, string> }>
}

export function kodikAvailable(): boolean {
  return sourceEnabled('kodik') && Boolean(kodikToken())
}

async function request<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const token = kodikToken()
  if (!sourceEnabled('kodik') || !token) throw new UpstreamError('kodik', 503, 'Kodik is disabled or has no token')
  const query = new URLSearchParams({ token, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  let res: Response
  try {
    res = await fetch(`${sourceUrl('kodik')}${path}?${query}`, {
      headers: { Accept: 'application/json', 'User-Agent': env.userAgent },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    throw new UpstreamError('kodik', 0, `Kodik unreachable: ${(error as Error).message}`)
  }
  if (!res.ok) throw new UpstreamError('kodik', res.status, `Kodik HTTP ${res.status}`)
  return (await res.json()) as T
}

function season(result: KodikResult) {
  const seasons = result.seasons ?? {}
  const key = result.last_season && seasons[String(result.last_season)] ? String(result.last_season) : Object.keys(seasons).find((k) => k !== '0')
  return key ? seasons[key] : undefined
}

export function kodikEpisodes(result: KodikResult): number[] {
  const current = season(result)
  if (!current) return result.seasons ? [] : [1]
  return Object.keys(current.episodes ?? {})
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
}

export function kodikEmbed(result: KodikResult, episode: number): string | null {
  const current = season(result)
  const link = current ? current.episodes?.[String(episode)] : episode === 1 ? result.link : undefined
  if (!link) return null
  return link.startsWith('//') ? `https:${link}` : link
}

export const kodik = {
  byMal(malId: number): Promise<KodikResult[]> {
    return cached(`kodik:mal:${malId}`, 30 * 60_000, async () => {
      const body = await request<{ results?: KodikResult[] }>('/search', { shikimori_id: malId, with_episodes: 'true', limit: 100 })
      return body.results ?? []
    })
  },
}

export interface KodikListItem {
  shikimori_id?: string | null
  year?: number | null
  last_episode?: number | null
  updated_at: string
  translation: { id: number; title: string; type: 'voice' | 'subtitles' }
}

export function kodikRecent(limit: number): Promise<KodikListItem[]> {
  return request<{ results?: KodikListItem[] }>('/list', { types: 'anime-serial', sort: 'updated_at', order: 'desc', limit }).then((body) => body.results ?? [])
}
