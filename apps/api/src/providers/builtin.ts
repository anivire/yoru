import { UpstreamError } from '../lib/http'
import { sourceEnabled } from '../lib/sources'
import { fetchFromA365, fromJikan, upsertA365Summaries, upsertJikanSummaries } from '../services/anime'
import { anime365 } from '../services/anime365'
import { fillMissing } from '../services/discover'
import { jikan } from '../services/jikan'
import { shikiSummaries, shikimori } from '../services/shikimori'
import type { MetadataProvider, SearchProvider, SearchQuery } from './types'

const PAGE_SIZE = 24
const CYRILLIC = /[а-яё]/i
const SHIKI_STATUS: Record<string, string> = { airing: 'ongoing', complete: 'released', upcoming: 'anons' }

function notFoundAsNull<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch((error: unknown) => {
    if (error instanceof UpstreamError && error.status === 404) return null
    throw error
  })
}

function hasFilters(query: SearchQuery): boolean {
  return Boolean(query.type || query.status || query.genres.length || Object.keys(query.params).length)
}

const jikanMetadata: MetadataProvider = {
  id: 'jikan',
  name: 'MyAnimeList (Jikan)',
  builtin: true,
  available: () => sourceEnabled('jikan'),
  anime: (malId) => notFoundAsNull(jikan.anime(malId).then(fromJikan)),
}

const anime365Metadata: MetadataProvider = {
  id: 'anime365',
  name: 'Anime365',
  builtin: true,
  available: () => sourceEnabled('anime365'),
  anime: (malId) => notFoundAsNull(fetchFromA365(malId)),
}

const jikanSearch: SearchProvider = {
  id: 'jikan',
  name: 'MyAnimeList (Jikan)',
  builtin: true,
  features: ['sort', 'upcoming', 'genres'],
  available: () => sourceEnabled('jikan'),
  accepts: (query) => !CYRILLIC.test(query.q),
  async search(query) {
    const res = !query.q && !hasFilters(query)
      ? await jikan.seasonNow(query.page)
      : await jikan.search(
          new URLSearchParams({
            page: String(query.page),
            limit: String(PAGE_SIZE),
            sfw: 'true',
            ...(query.q ? { q: query.q } : {}),
            ...(query.type ? { type: query.type } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.genres.length ? { genres: query.genres.join(',') } : {}),
            ...query.params,
          }),
        )
    return { items: upsertJikanSummaries(res.data), hasNextPage: res.pagination.has_next_page, total: res.pagination.items?.total ?? null }
  },
  genres: async () => (await jikan.genres()).map((g) => ({ id: g.mal_id, name: g.name, count: g.count })),
}

const anime365Search: SearchProvider = {
  id: 'anime365',
  name: 'Anime365',
  builtin: true,
  features: ['genres'],
  available: () => sourceEnabled('anime365'),
  accepts: () => true,
  async search(query) {
    if (query.status === 'upcoming') return { items: [], hasNextPage: false, total: 0 }
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: (query.page - 1) * PAGE_SIZE }
    if (query.q) params.query = query.q
    else if (query.genres.length) params.chips = `genre@=${query.genres.join(',')}`
    if (query.type) params.type = query.type
    if (query.status === 'airing' || (!query.q && !hasFilters(query))) params.isAiring = 1
    if (query.status === 'complete') params.isAiring = 0
    const rows = await anime365.list(params)
    const matching = query.q && query.genres.length ? rows.filter((s) => query.genres.every((g) => s.genres?.some((x) => x.id === g))) : rows
    return { items: upsertA365Summaries(matching), hasNextPage: rows.length === PAGE_SIZE, total: null }
  },
  genres: () => anime365.genres(),
}

const shikimoriSearch: SearchProvider = {
  id: 'shikimori',
  name: 'Shikimori',
  builtin: true,
  features: ['upcoming'],
  available: () => sourceEnabled('shikimori'),
  accepts: (query) => Boolean(query.q) && !query.genres.length,
  async search(query) {
    const params: Record<string, string | number> = { search: query.q, page: query.page, limit: PAGE_SIZE }
    if (query.type) params.kind = query.type
    const status = query.status ? SHIKI_STATUS[query.status] : undefined
    if (status) params.status = status
    const rows = await shikimori.animes(params)
    return { items: fillMissing(shikiSummaries(rows)), hasNextPage: rows.length === PAGE_SIZE, total: null }
  },
}

export const builtinMetadata: MetadataProvider[] = [jikanMetadata, anime365Metadata]
export const builtinSearch: SearchProvider[] = [jikanSearch, shikimoriSearch, anime365Search]
