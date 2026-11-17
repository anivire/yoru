import { eq, inArray } from 'drizzle-orm'
import type { AnimeDetails, AnimeSummary } from '@yoru/shared'
import { db, now } from '../db/client'
import { anime } from '../db/schema'
import { UpstreamError } from '../lib/http'
import { activeProviders, primaryMetadata } from '../providers/chain'
import { nextBroadcast } from '../lib/time'
import { airedEpisode } from './aired'
import { type A365Series, absoluteA365Url, anime365 } from './anime365'
import { type JikanAnime, jikanImage, normalizeStatus, normalizeType } from './jikan'

export type AnimeRow = typeof anime.$inferSelect
type AnimeInsert = typeof anime.$inferInsert

const HOUR = 3_600_000
const SEASONS: Record<string, string> = { зима: 'winter', весна: 'spring', лето: 'summer', осень: 'fall' }

export function toSummary(row: AnimeRow): AnimeSummary {
  return {
    malId: row.malId,
    title: row.title,
    titleEnglish: row.titleEnglish,
    titleJapanese: row.titleJapanese,
    titleRussian: row.titleRussian || null,
    imageUrl: row.imageUrl,
    type: row.type,
    episodes: row.episodes,
    status: row.status,
    airing: row.airing,
    year: row.year,
    season: row.season,
    score: row.score,
    genres: row.genres,
  }
}

export function nextAiringAt(row: AnimeRow): Date | null {
  if (row.status !== 'airing' && row.status !== 'upcoming') return null
  return nextBroadcast(row.broadcastDay, row.broadcastTime, row.broadcastTimezone, row.status === 'upcoming' ? row.airedFrom : null)
}

export function toDetails(row: AnimeRow): AnimeDetails {
  return {
    ...toSummary(row),
    synopsis: row.synopsis,
    synonyms: row.synonyms,
    studios: row.studios,
    duration: row.duration,
    rating: row.rating,
    airedFrom: row.airedFrom,
    airedTo: row.airedTo,
    broadcast: { day: row.broadcastDay, time: row.broadcastTime, timezone: row.broadcastTimezone },
    trailerUrl: row.trailerUrl,
    latestEpisode: airedEpisode(row.malId, row.latestEpisode),
    nextAiringAt: nextAiringAt(row)?.toISOString() ?? null,
  }
}

export function fromJikan(j: JikanAnime): AnimeInsert {
  return {
    malId: j.mal_id,
    title: j.title,
    titleEnglish: j.title_english ?? null,
    titleJapanese: j.title_japanese ?? null,
    synonyms: j.title_synonyms ?? [],
    imageUrl: jikanImage(j),
    type: normalizeType(j.type),
    episodes: j.episodes ?? null,
    status: normalizeStatus(j.status),
    airing: Boolean(j.airing),
    year: j.year ?? (j.aired?.from ? new Date(j.aired.from).getUTCFullYear() : null),
    season: j.season ?? null,
    score: j.score ?? null,
    genres: [...(j.genres ?? []), ...(j.themes ?? []), ...(j.demographics ?? [])].map((g) => g.name),
    studios: (j.studios ?? []).map((s) => s.name),
    synopsis: j.synopsis ?? null,
    duration: j.duration ?? null,
    rating: j.rating ?? null,
    airedFrom: j.aired?.from ?? null,
    airedTo: j.aired?.to ?? null,
    broadcastDay: j.broadcast?.day ?? null,
    broadcastTime: j.broadcast?.time ?? null,
    broadcastTimezone: j.broadcast?.timezone ?? null,
    trailerUrl: j.trailer?.url ?? (j.trailer?.youtube_id ? `https://www.youtube.com/watch?v=${j.trailer.youtube_id}` : null) ?? j.trailer?.embed_url ?? null,
    updatedAt: now(),
  }
}

const SEASON_START_MONTH: Record<string, number> = { зима: 0, весна: 3, лето: 6, осень: 9 }

function a365Status(s: A365Series): string {
  if (s.isAiring) return 'airing'
  const [seasonName, seasonYear] = (s.season ?? '').toLowerCase().split(' ')
  const month = seasonName ? SEASON_START_MONTH[seasonName] : undefined
  const year = Number(seasonYear) || s.year
  if (month !== undefined && year && Date.UTC(year, month, 1) > Date.now()) return 'upcoming'
  if (s.episodes && !s.episodes.length) return 'upcoming'
  return 'finished'
}

function fromA365(s: A365Series, malId: number): AnimeInsert {
  const [seasonName] = (s.season ?? '').toLowerCase().split(' ')
  return {
    malId,
    title: s.titles?.romaji || s.titles?.en || s.titles?.ru || `#${malId}`,
    titleEnglish: s.titles?.en ?? null,
    titleJapanese: s.titles?.ja ?? null,
    titleRussian: s.titles?.ru || null,
    synonyms: s.titles?.ru ? [s.titles.ru] : [],
    imageUrl: s.posterUrl ? absoluteA365Url(s.posterUrl) : null,
    type: normalizeType(s.type),
    episodes: s.numberOfEpisodes || null,
    status: a365Status(s),
    airing: Boolean(s.isAiring),
    year: s.year ?? null,
    season: (seasonName && SEASONS[seasonName]) || null,
    score: s.myAnimeListScore && s.myAnimeListScore > 0 ? s.myAnimeListScore : null,
    genres: (s.genres ?? []).map((g) => g.title),
    synopsis: s.descriptions?.[0]?.value ?? null,
    updatedAt: now(),
  }
}

export function upsertAnime(data: AnimeInsert, opts: { details?: boolean; onlyIfMissing?: boolean; source?: string } = {}) {
  const values = opts.details ? { ...data, detailsFetchedAt: now(), ...(opts.source ? { source: opts.source } : {}) } : data
  const { malId: _malId, ...set } = values
  const query = db.insert(anime).values(values)
  if (opts.onlyIfMissing) query.onConflictDoNothing().run()
  else query.onConflictDoUpdate({ target: anime.malId, set }).run()
}

export function needsCard(row: AnimeRow | undefined, primary: string | null): boolean {
  if (!row?.detailsFetchedAt) return true
  return Boolean(primary && row.source && row.source !== primary)
}

export function storedSummaries(items: AnimeInsert[], from: string): AnimeSummary[] {
  const primary = primaryMetadata()?.id
  const seen = new Set<number>()
  const unique = items.filter((item): item is AnimeInsert & { malId: number } => typeof item.malId === 'number' && !seen.has(item.malId) && Boolean(seen.add(item.malId)))
  for (const item of unique) upsertAnime(item, primary === from ? { details: true, source: from } : { onlyIfMissing: true })
  const rows = new Map(unique.length ? db.select().from(anime).where(inArray(anime.malId, unique.map((i) => i.malId))).all().map((r) => [r.malId, r]) : [])
  return unique.flatMap((item) => {
    const row = rows.get(item.malId)
    return row ? [toSummary(row)] : []
  })
}

export function airedEpisodes(row: AnimeRow): number | null {
  if (row.status === 'finished') return row.episodes
  if (row.status === 'upcoming') return 0
  return airedEpisode(row.malId, row.latestEpisode)
}

export function getAnimeRow(malId: number): AnimeRow | undefined {
  return db.select().from(anime).where(eq(anime.malId, malId)).get()
}

function maxAge(row: AnimeRow): number {
  return row.status === 'finished' ? 7 * 24 * HOUR : 6 * HOUR
}

export async function ensureAnime(malId: number, opts: { force?: boolean } = {}): Promise<AnimeRow> {
  const row = getAnimeRow(malId)
  const providers = activeProviders('metadata')
  const fresh = row && !needsCard(row, providers[0]?.id ?? null) && Date.now() - Date.parse(row.detailsFetchedAt!) < maxAge(row)
  if (row && fresh && !opts.force) return row
  let lastError: unknown = null
  for (const [index, provider] of providers.entries()) {
    let data: AnimeInsert | null
    try {
      data = await provider.anime(malId)
    } catch (error) {
      lastError = error
      if (row?.detailsFetchedAt) return row
      continue
    }
    if (!data) continue
    upsertAnime({ ...data, malId }, { details: index === 0, source: provider.id })
    return getAnimeRow(malId)!
  }
  if (row) return row
  throw lastError ?? new UpstreamError('metadata', 404, 'Anime not found')
}

export async function fetchFromA365(malId: number): Promise<AnimeInsert> {
  const series = await anime365.seriesByMal(malId)
  if (!series) throw new UpstreamError('anime365', 404, 'Not found on Anime365')
  const full = await anime365.series(series.id).catch(() => series)
  return fromA365(full, malId)
}

export function upsertA365Summaries(rows: A365Series[]): AnimeSummary[] {
  return storedSummaries(
    rows.filter((s) => s.myAnimeListId && !s.isHentai).map((s) => fromA365(s, s.myAnimeListId!)),
    'anime365',
  )
}

export function setLatestEpisode(malId: number, episode: number) {
  const row = getAnimeRow(malId)
  if (!row || (row.latestEpisode ?? 0) >= episode || (row.episodes && episode > row.episodes)) return
  db.update(anime).set({ latestEpisode: episode }).where(eq(anime.malId, malId)).run()
}
