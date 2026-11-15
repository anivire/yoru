import type { AnimeSummary, Genre } from '@yoru/shared'
import { inArray } from 'drizzle-orm'
import { db, now } from '../db/client'
import { anime } from '../db/schema'
import { env } from '../env'
import { UpstreamError, cacheGet, cached, sleep } from '../lib/http'
import { sourceEnabled, sourceUrl } from '../lib/sources'
import { type AnimeRow, toSummary, upsertAnime } from './anime'

const HOUR = 3_600_000
const MIN_INTERVAL_MS = 250

export interface ShikiAnime {
  id: number
  name: string
  russian?: string | null
  image?: { original?: string; preview?: string }
  kind?: string | null
  score?: string | null
  status?: string | null
  episodes?: number
  episodes_aired?: number
  aired_on?: string | null
  released_on?: string | null
}

export interface ShikiCalendarEntry {
  next_episode: number
  next_episode_at: string
  anime: ShikiAnime
}

interface ShikiGenre {
  id: number
  name: string
  russian: string
  kind: string
  entry_type: string
}

function disabled<T>(): Promise<T> {
  return Promise.reject(new UpstreamError('shikimori', 503, 'Shikimori is disabled'))
}

let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

async function request<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  let res: Response
  try {
    res = await fetch(`${sourceUrl('shikimori')}/api${path}${query.size ? `?${query}` : ''}`, {
      headers: { Accept: 'application/json', 'User-Agent': env.userAgent },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    throw new UpstreamError('shikimori', 0, `Shikimori unreachable: ${(error as Error).message}`)
  }
  if (!res.ok) throw new UpstreamError('shikimori', res.status, `Shikimori HTTP ${res.status} (${path})`)
  return (await res.json()) as T
}

function enqueue<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const run = queue.then(() => request<T>(path, params))
  queue = run.catch(() => undefined)
  return run
}

export function shikiUrl(path: string | null | undefined): string | null {
  if (!path || path.includes('/missing_')) return null
  return /^https?:\/\//.test(path) ? path : sourceUrl('shikimori') + path
}

const STATUS: Record<string, string> = { anons: 'upcoming', ongoing: 'airing', released: 'finished' }
const SEASONS = ['winter', 'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall']

export function currentSeason(date = new Date()): string {
  return `${SEASONS[date.getMonth()]}_${date.getFullYear()}`
}

function fromShiki(a: ShikiAnime) {
  const aired = a.aired_on ? new Date(a.aired_on) : null
  const score = Number.parseFloat(a.score ?? '')
  return {
    malId: a.id,
    title: a.name,
    titleRussian: a.russian || null,
    synonyms: a.russian ? [a.russian] : [],
    imageUrl: shikiUrl(a.image?.original),
    type: a.kind ?? null,
    episodes: a.episodes || null,
    status: (a.status && STATUS[a.status]) || null,
    airing: a.status === 'ongoing',
    year: aired ? aired.getUTCFullYear() : null,
    season: aired ? SEASONS[aired.getUTCMonth()]! : null,
    score: score > 0 ? score : null,
    genres: [],
    updatedAt: now(),
  }
}

export function shikiSummaries(items: ShikiAnime[]): AnimeSummary[] {
  if (!items.length) return []
  const ids = items.map((i) => i.id)
  const existing = new Map(db.select().from(anime).where(inArray(anime.malId, ids)).all().map((r) => [r.malId, r]))
  return items.map((item) => {
    const row = existing.get(item.id)
    if (row) {
      const image = row.imageUrl ?? shikiUrl(item.image?.original)
      const titleRussian = row.titleRussian || item.russian || row.titleRussian
      if ((image && !row.imageUrl) || titleRussian !== row.titleRussian) upsertAnime({ ...row, imageUrl: image, titleRussian })
      return toSummary({ ...row, imageUrl: image, titleRussian })
    }
    const data = fromShiki(item)
    upsertAnime(data, { onlyIfMissing: true })
    return toSummary({ ...data, titleEnglish: null, titleJapanese: null, latestEpisode: null } as unknown as AnimeRow)
  })
}

function screenshotsKey(id: number) {
  return `shiki:screenshots:${id}`
}

export function cachedBanner(id: number): string | null | undefined {
  if (!sourceEnabled('shikimori')) return null
  const value = cacheGet<string[]>(screenshotsKey(id))
  return value === null ? undefined : (value[0] ?? null)
}

const warming = new Set<number>()

export function warmBanners(ids: number[]) {
  for (const id of ids) {
    if (warming.has(id) || cachedBanner(id) !== undefined) continue
    warming.add(id)
    shikimori
      .screenshots(id)
      .catch(() => undefined)
      .finally(() => warming.delete(id))
  }
}

export const shikimori = {
  calendar(): Promise<ShikiCalendarEntry[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return cached('shiki:calendar', HOUR, () => enqueue<ShikiCalendarEntry[]>('/calendar', { censored: 'true' }))
  },

  byIds(ids: number[]): Promise<ShikiAnime[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return enqueue<ShikiAnime[]>('/animes', { ids: ids.join(','), limit: ids.length, censored: 'false' })
  },

  animes(params: Record<string, string | number>): Promise<ShikiAnime[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    const query = { censored: 'true', limit: 24, ...params }
    const key = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
    return cached(`shiki:animes:${key}`, 3 * HOUR, () => enqueue<ShikiAnime[]>('/animes', query))
  },

  async screenshots(id: number): Promise<string[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return cached(screenshotsKey(id), 7 * 24 * HOUR, async () => {
      const rows = await enqueue<{ original?: string }[]>(`/animes/${id}/screenshots`)
      return rows.map((r) => shikiUrl(r.original)).filter((u): u is string => Boolean(u))
    })
  },

  genres(locale: 'ru' | 'en'): Promise<Genre[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return cached('shiki:genres', 24 * HOUR, () => enqueue<ShikiGenre[]>('/genres')).then((rows) =>
      rows
        .filter((g) => g.entry_type === 'Anime' && g.kind === 'genre')
        .map((g) => ({ id: g.id, name: locale === 'ru' ? g.russian : g.name, count: 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    )
  },
}
