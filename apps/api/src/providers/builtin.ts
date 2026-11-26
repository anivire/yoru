import { UpstreamError } from '../lib/http'
import { sourceEnabled } from '../lib/sources'
import { now } from '../db/client'
import { fetchFromA365, fromJikan, storedSummaries, upsertA365Summaries } from '../services/anime'
import { type AniListFullMedia, anilist } from '../services/anilist'
import { type KitsuEntry, kitsu } from '../services/kitsu'
import { anime365 } from '../services/anime365'
import { jikan } from '../services/jikan'
import { shikiSummaries, shikimori } from '../services/shikimori'
import type { AnimeData, MetadataProvider, SearchProvider, SearchQuery } from './types'

const PAGE_SIZE = 24
const CYRILLIC = /[а-яё]/i
const SHIKI_STATUS: Record<string, string> = { airing: 'ongoing', complete: 'released', upcoming: 'anons' }

function notFoundAsNull<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch((error: unknown) => {
    if (error instanceof UpstreamError && error.status === 404) return null
    throw error
  })
}

const ANILIST_FORMATS: Record<string, string[]> = { tv: ['TV', 'TV_SHORT'], movie: ['MOVIE'], ova: ['OVA'], ona: ['ONA'], special: ['SPECIAL'], music: ['MUSIC'] }
const ANILIST_TYPE: Record<string, string> = { TV: 'tv', TV_SHORT: 'tv', MOVIE: 'movie', OVA: 'ova', ONA: 'ona', SPECIAL: 'special', MUSIC: 'music' }
const ANILIST_STATUS: Record<string, string> = { RELEASING: 'airing', HIATUS: 'airing', FINISHED: 'finished', CANCELLED: 'finished', NOT_YET_RELEASED: 'upcoming' }
const ANILIST_FILTER_STATUS: Record<string, string> = { airing: 'RELEASING', complete: 'FINISHED', upcoming: 'NOT_YET_RELEASED' }
const KITSU_TYPE: Record<string, string> = { TV: 'tv', movie: 'movie', OVA: 'ova', ONA: 'ona', special: 'special', music: 'music' }
const KITSU_FILTER_TYPE: Record<string, string> = { tv: 'TV', movie: 'movie', ova: 'OVA', ona: 'ONA', special: 'special', music: 'music' }
const KITSU_STATUS: Record<string, string> = { current: 'airing', finished: 'finished', upcoming: 'upcoming', unreleased: 'upcoming', tba: 'upcoming' }
const KITSU_FILTER_STATUS: Record<string, string> = { airing: 'current', complete: 'finished', upcoming: 'upcoming' }
const SEASON_OF_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter']

type KeyedAnime = AnimeData & { malId: number }

function isoDate(date: { year: number | null; month: number | null; day: number | null } | null): string | null {
  if (!date?.year) return null
  return `${date.year}-${String(date.month ?? 1).padStart(2, '0')}-${String(date.day ?? 1).padStart(2, '0')}`
}

function tidyText(text: string): string {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function fromAniList(m: AniListFullMedia): KeyedAnime | null {
  if (!m.idMal) return null
  const title = m.title.romaji || m.title.english || m.title.native
  if (!title) return null
  const status = (m.status && ANILIST_STATUS[m.status]) || null
  return {
    malId: m.idMal,
    title,
    titleEnglish: m.title.english,
    titleJapanese: m.title.native,
    synonyms: m.synonyms ?? [],
    imageUrl: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
    type: (m.format && ANILIST_TYPE[m.format]) || null,
    episodes: m.episodes,
    status,
    airing: status === 'airing',
    year: m.seasonYear ?? m.startDate?.year ?? null,
    season: m.season ? m.season.toLowerCase() : null,
    score: m.averageScore ? m.averageScore / 10 : null,
    genres: m.genres ?? [],
    studios: m.studios?.nodes.map((n) => n.name) ?? [],
    synopsis: m.description ? tidyText(m.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')) : null,
    duration: m.duration ? `${m.duration} min` : null,
    airedFrom: isoDate(m.startDate),
    airedTo: isoDate(m.endDate),
    trailerUrl: m.trailer?.site === 'youtube' && m.trailer.id ? `https://www.youtube.com/watch?v=${m.trailer.id}` : null,
    updatedAt: now(),
  }
}

function fromKitsu(entry: KitsuEntry): KeyedAnime | null {
  if (!entry.malId) return null
  const a = entry.anime.attributes
  const title = a.titles?.en_jp || a.canonicalTitle || a.titles?.en
  if (!title) return null
  const status = (a.status && KITSU_STATUS[a.status]) || null
  const start = a.startDate ? new Date(a.startDate) : null
  const score = Number.parseFloat(a.averageRating ?? '')
  return {
    malId: entry.malId,
    title,
    titleEnglish: a.titles?.en ?? null,
    titleJapanese: a.titles?.ja_jp ?? null,
    synonyms: a.abbreviatedTitles ?? [],
    imageUrl: a.posterImage?.original ?? a.posterImage?.large ?? null,
    type: (a.subtype && KITSU_TYPE[a.subtype]) || null,
    episodes: a.episodeCount,
    status,
    airing: status === 'airing',
    year: start ? start.getUTCFullYear() : null,
    season: start ? SEASON_OF_MONTH[start.getUTCMonth()]! : null,
    score: score > 0 ? Math.round(score) / 10 : null,
    genres: entry.genres,
    studios: [],
    synopsis: a.synopsis,
    duration: a.episodeLength ? `${a.episodeLength} min` : null,
    rating: a.ageRating,
    airedFrom: a.startDate,
    airedTo: a.endDate,
    trailerUrl: a.youtubeVideoId ? `https://www.youtube.com/watch?v=${a.youtubeVideoId}` : null,
    updatedAt: now(),
  }
}

function keyed(items: (KeyedAnime | null)[]): KeyedAnime[] {
  return items.filter((item): item is KeyedAnime => item !== null)
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

const anilistMetadata: MetadataProvider = {
  id: 'anilist',
  name: 'AniList',
  builtin: true,
  available: () => sourceEnabled('anilist'),
  anime: async (malId) => {
    const media = await anilist.anime(malId)
    return media ? fromAniList(media) : null
  },
  many: async (malIds, opts) => keyed((await anilist.many(malIds, opts)).map(fromAniList)),
}

const kitsuMetadata: MetadataProvider = {
  id: 'kitsu',
  name: 'Kitsu',
  builtin: true,
  available: () => sourceEnabled('kitsu'),
  anime: async (malId) => {
    const entry = await kitsu.anime(malId)
    return entry ? fromKitsu(entry) : null
  },
}

const anilistSearch: SearchProvider = {
  id: 'anilist',
  name: 'AniList',
  builtin: true,
  features: ['upcoming'],
  available: () => sourceEnabled('anilist'),
  accepts: (query) => !CYRILLIC.test(query.q),
  async search(query) {
    const res = await anilist.search({
      q: query.q,
      page: query.page,
      format: query.type ? (ANILIST_FORMATS[query.type] ?? null) : null,
      status: query.status ? (ANILIST_FILTER_STATUS[query.status] ?? null) : null,
    })
    return { items: storedSummaries(keyed(res.media.map(fromAniList)), 'anilist'), hasNextPage: res.hasNextPage, total: null }
  },
}

const kitsuSearch: SearchProvider = {
  id: 'kitsu',
  name: 'Kitsu',
  builtin: true,
  features: ['upcoming'],
  available: () => sourceEnabled('kitsu'),
  accepts: (query) => !CYRILLIC.test(query.q),
  async search(query) {
    const res = await kitsu.search({
      q: query.q,
      page: query.page,
      subtype: query.type ? (KITSU_FILTER_TYPE[query.type] ?? null) : null,
      status: query.status ? (KITSU_FILTER_STATUS[query.status] ?? null) : null,
    })
    return { items: storedSummaries(keyed(res.entries.map(fromKitsu)), 'kitsu'), hasNextPage: res.hasNextPage, total: null }
  },
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
    return { items: storedSummaries(res.data.map(fromJikan), 'jikan'), hasNextPage: res.pagination.has_next_page, total: res.pagination.items?.total ?? null }
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
    return { items: shikiSummaries(rows), hasNextPage: rows.length === PAGE_SIZE, total: null }
  },
}

export const builtinMetadata: MetadataProvider[] = [jikanMetadata, anilistMetadata, kitsuMetadata, anime365Metadata]
export const builtinSearch: SearchProvider[] = [jikanSearch, anilistSearch, shikimoriSearch, kitsuSearch, anime365Search]
