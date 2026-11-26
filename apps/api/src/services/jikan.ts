import { cached, sleep, upstream, UpstreamError } from '../lib/http'
import { sourceUrl } from '../lib/sources'

export interface JikanImageSet {
  image_url?: string | null
  large_image_url?: string | null
}

export interface JikanAnime {
  mal_id: number
  images?: { jpg?: JikanImageSet; webp?: JikanImageSet }
  trailer?: { url?: string | null; embed_url?: string | null; youtube_id?: string | null }
  title: string
  title_english?: string | null
  title_japanese?: string | null
  title_synonyms?: string[]
  type?: string | null
  episodes?: number | null
  status?: string | null
  airing?: boolean
  aired?: { from?: string | null; to?: string | null }
  duration?: string | null
  rating?: string | null
  score?: number | null
  synopsis?: string | null
  season?: string | null
  year?: number | null
  broadcast?: { day?: string | null; time?: string | null; timezone?: string | null }
  studios?: { name: string }[]
  genres?: { name: string }[]
  themes?: { name: string }[]
  demographics?: { name: string }[]
}

export interface JikanPagination {
  last_visible_page?: number
  has_next_page: boolean
  current_page?: number
  items?: { count: number; total: number; per_page: number }
}

export interface JikanList<T> {
  data: T[]
  pagination: JikanPagination
}

export interface JikanEpisode {
  mal_id: number
  title?: string | null
  title_japanese?: string | null
  aired?: string | null
  filler?: boolean
  recap?: boolean
}

export interface JikanEpisodeVideo {
  mal_id: number
  title?: string | null
  episode?: string | null
  images?: { jpg?: { image_url?: string | null } }
}

export interface JikanGenre {
  mal_id: number
  name: string
  count: number
}

const MIN_INTERVAL_MS = 400
const MAX_PER_MINUTE = 55

let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0
const recent: number[] = []

async function throttle() {
  const t = Date.now()
  while (recent.length && recent[0]! < t - 60_000) recent.shift()
  if (recent.length >= MAX_PER_MINUTE) await sleep(recent[0]! + 60_000 - t)
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
  recent.push(lastRequestAt)
}

let downUntil = 0

async function request<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (Date.now() < downUntil) throw new UpstreamError('jikan', 0, 'Jikan is unreachable')
    await throttle()
    let res: Response
    try {
      res = await upstream('jikan', 'Jikan', sourceUrl('jikan') + path, { timeoutMs: 10_000 })
    } catch (error) {
      downUntil = Date.now() + 120_000
      throw error
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 3) throw new UpstreamError('jikan', res.status, `Jikan HTTP ${res.status}`)
      await sleep(1500 * (attempt + 1))
      continue
    }
    if (res.status === 404) throw new UpstreamError('jikan', 404, 'Not found on MyAnimeList')
    if (!res.ok) throw new UpstreamError('jikan', res.status, `Jikan HTTP ${res.status}`)
    return (await res.json()) as T
  }
  throw new UpstreamError('jikan', 0, 'Jikan request failed')
}

function enqueue<T>(path: string): Promise<T> {
  const run = queue.then(() => request<T>(path))
  queue = run.catch(() => undefined)
  return run
}

const HOUR = 3_600_000
const FULL_PAGE_TTL = 7 * 24 * HOUR

export const jikan = {
  anime(malId: number) {
    return enqueue<{ data: JikanAnime }>(`/anime/${malId}`).then((r) => r.data)
  },
  search(params: URLSearchParams) {
    return cached(`jikan:search:${params}`, HOUR, () => enqueue<JikanList<JikanAnime>>(`/anime?${params}`))
  },
  seasonNow(page: number) {
    return cached(`jikan:season-now:${page}`, 6 * HOUR, () =>
      enqueue<JikanList<JikanAnime>>(`/seasons/now?page=${page}&limit=24&sfw=true`),
    )
  },
  episodes(malId: number, page: number, ttl: number) {
    return cached(`jikan:episodes:${malId}:${page}`, (r) => (r.pagination.has_next_page ? FULL_PAGE_TTL : ttl), () =>
      enqueue<JikanList<JikanEpisode>>(`/anime/${malId}/episodes?page=${page}`),
    )
  },
  episodeVideos(malId: number, page: number, ttl: number) {
    return cached(`jikan:episode-videos:${malId}:${page}`, (r) => (r.pagination.has_next_page ? FULL_PAGE_TTL : ttl), () =>
      enqueue<JikanList<JikanEpisodeVideo>>(`/anime/${malId}/videos/episodes?page=${page}`),
    )
  },
  genres() {
    return cached('jikan:genres', 7 * 24 * HOUR, () =>
      enqueue<{ data: JikanGenre[] }>('/genres/anime?filter=genres').then((r) => r.data),
    )
  },
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(sourceUrl('jikan') + '/anime/1', { signal: AbortSignal.timeout(8000) })
      return res.ok
    } catch {
      return false
    }
  },
}

export function jikanImage(a: Pick<JikanAnime, 'images'>): string | null {
  return a.images?.webp?.large_image_url || a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null
}

export function normalizeType(type: string | null | undefined): string | null {
  if (!type) return null
  return type.trim().toLowerCase().replace(/\s+/g, '_')
}

export function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) return null
  const s = status.toLowerCase()
  if (s.includes('currently')) return 'airing'
  if (s.includes('finished')) return 'finished'
  if (s.includes('not yet')) return 'upcoming'
  return s
}
