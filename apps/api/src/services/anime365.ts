import type { Genre, StreamKind, StreamSource } from '@yoru/shared'
import { env } from '../env'
import { UpstreamError, cached } from '../lib/http'
import { sourceUrl } from '../lib/sources'

export interface A365Titles {
  romaji?: string
  en?: string
  ru?: string
  ja?: string
}

export interface A365Series {
  id: number
  myAnimeListId?: number
  anilistId?: number
  isAiring?: number
  isHentai?: number
  numberOfEpisodes?: number
  myAnimeListScore?: number
  season?: string
  year?: number
  type?: string
  typeTitle?: string
  titles?: A365Titles
  posterUrl?: string
  descriptions?: { source: string; value: string }[]
  genres?: { id: number; title: string }[]
  episodes?: A365Episode[]
  links?: { title: string; url: string }[]
}

export interface A365Episode {
  id: number
  episodeInt: number | string
  episodeType?: string
  episodeTitle?: string
  firstUploadedDateTime?: string
  isActive?: number
  seriesId?: number
}

export interface A365Translation {
  id: number
  type: string
  typeKind?: string
  priority?: number
  qualityType?: string
  title?: string
  authorsSummary?: string
  activeDateTime?: string
  isActive?: number
  height?: number
  seriesId?: number
  episodeId?: number
  episode?: A365Episode
  series?: A365Series
}

interface A365Embed {
  stream?: { height: number; urls?: string[] }[]
  download?: { height: number; url?: string }[]
  subtitlesUrl?: string
  subtitlesVttUrl?: string
}

export const KIND_TO_TYPE: Record<StreamKind, string> = { sub: 'subRu', voice: 'voiceRu' }
export const TYPE_TO_KIND: Record<string, StreamKind> = { subRu: 'sub', voiceRu: 'voice' }
const MAIN_EPISODE_TYPES = ['tv', 'ova', 'ona', 'movie']
const SERIES_FIELDS = 'id,myAnimeListId,anilistId,isAiring,isHentai,numberOfEpisodes,myAnimeListScore,season,year,type,typeTitle,titles,posterUrl,genres'
const HOUR = 3_600_000

async function api<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const url = `${sourceUrl('anime365')}/api${path}${query.size ? `?${query}` : ''}`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': env.userAgent },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    throw new UpstreamError('anime365', 0, `Anime365 unreachable: ${(error as Error).message}`)
  }
  if (!res.ok) throw new UpstreamError('anime365', res.status, `Anime365 HTTP ${res.status} (${path})`)
  const body = (await res.json()) as { data?: T; error?: { code?: number; message?: string } }
  if (body.error) throw new UpstreamError('anime365', body.error.code ?? 500, `Anime365: ${body.error.message ?? 'error'}`)
  return body.data as T
}

const isHttps = (url: unknown): url is string => typeof url === 'string' && /^https:\/\//.test(url)

export function absoluteA365Url(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  if (url.startsWith('//')) return 'https:' + url
  return sourceUrl('anime365') + (url.startsWith('/') ? '' : '/') + url
}

export function seriesTitle(s: A365Series): string {
  return s.titles?.romaji || s.titles?.en || s.titles?.ru || s.titles?.ja || `#${s.id}`
}

export function mainEpisodes(rows: A365Episode[]): A365Episode[] {
  const numbered = rows.filter((e) => e.isActive !== 0 && Number.isInteger(Number(e.episodeInt)) && Number(e.episodeInt) > 0)
  const main = numbered.filter((e) => MAIN_EPISODE_TYPES.includes(e.episodeType ?? ''))
  const byNumber = new Map<number, A365Episode>()
  for (const e of (main.length ? main : numbered).sort((a, b) => a.id - b.id)) {
    const n = Number(e.episodeInt)
    if (!byNumber.has(n)) byNumber.set(n, e)
  }
  return [...byNumber.values()].sort((a, b) => Number(a.episodeInt) - Number(b.episodeInt))
}

export const anime365 = {
  async seriesByMal(malId: number): Promise<A365Series | null> {
    return cached(`a365:by-mal:${malId}`, 24 * HOUR, async () => {
      const rows = await api<A365Series[]>('/series', { myAnimeListId: malId, fields: SERIES_FIELDS })
      return rows.find((s) => s.myAnimeListId === malId) ?? null
    })
  },

  search(query: string): Promise<A365Series[]> {
    return cached(`a365:search:${query.toLowerCase()}`, HOUR, () =>
      api<A365Series[]>('/series', { query, limit: 20, isActive: 1, fields: SERIES_FIELDS }),
    )
  },

  list(params: Record<string, string | number>): Promise<A365Series[]> {
    const query = { isActive: 1, fields: SERIES_FIELDS, ...params }
    const key = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
    return cached(`a365:list:${key}`, HOUR,() => api<A365Series[]>('/series', query))
  },

  genres(): Promise<Genre[]> {
    return cached('a365:genres', 24 * HOUR, async () => {
      const rows = await api<A365Series[]>('/series', { limit: 500, isActive: 1, fields: 'genres' })
      const counts = new Map<number, Genre>()
      for (const s of rows) {
        for (const g of s.genres ?? []) {
          const entry = counts.get(g.id) ?? { id: g.id, name: g.title, count: 0 }
          entry.count++
          counts.set(g.id, entry)
        }
      }
      return [...counts.values()].sort((a, b) => b.count - a.count)
    })
  },

  series(id: number): Promise<A365Series> {
    return cached(`a365:series:${id}`, 6 * HOUR, () => api<A365Series>(`/series/${id}`))
  },

  async episodes(seriesId: number, fresh = false): Promise<A365Episode[]> {
    const load = async () =>
      mainEpisodes(await api<A365Episode[]>('/episodes', { seriesId, isActive: 1, limit: 2000 }))
    return fresh ? load() : cached(`a365:episodes:${seriesId}`, 20 * 60_000, load)
  },

  async translations(episodeId: number, kind: StreamKind, limit = 20): Promise<A365Translation[]> {
    const rows = await cached(`a365:translations:${episodeId}`, 20 * 60_000, () =>
      api<A365Translation[]>('/translations', { episodeId, isActive: 1, limit: 100 }),
    )
    return rows
      .filter((t) => t.type === KIND_TO_TYPE[kind])
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))
      .slice(0, limit)
  },

  recent(type: string, offset: number, limit: number): Promise<A365Translation[]> {
    return api<A365Translation[]>('/translations', { type, isActive: 1, limit, offset })
  },

  async embed(translationId: number, token: string): Promise<{ sources: StreamSource[]; subtitlesUrl: string | null }> {
    const embed = await api<A365Embed>(`/translations/embed/${translationId}`, { access_token: token })
    const options = [
      ...(embed.stream ?? []).map((o) => ({ height: o.height, url: o.urls?.find(isHttps) })),
      ...(embed.download ?? []).map((o) => ({ height: o.height, url: o.url })),
    ]
      .filter((o): o is { height: number; url: string } => isHttps(o.url))
      .sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0))
    const seen = new Set<number>()
    const sources: StreamSource[] = []
    for (const o of options) {
      const height = Number(o.height) || 0
      if (seen.has(height)) continue
      seen.add(height)
      sources.push({ url: o.url, height, type: /\.m3u8($|[?#])/i.test(o.url) ? 'm3u8' : 'mp4' })
    }
    const subtitlesUrl = embed.subtitlesUrl ? absoluteA365Url(embed.subtitlesUrl).replace(/\?willcache$/, '') : null
    return { sources, subtitlesUrl }
  },
}
