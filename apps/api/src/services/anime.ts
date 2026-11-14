import { eq, inArray } from 'drizzle-orm'
import type { AnimeDetails, AnimeSummary } from '@yoru/shared'
import { db, now } from '../db/client'
import { anime } from '../db/schema'
import { UpstreamError } from '../lib/http'
import { metadataSource } from '../lib/settings'
import { nextBroadcast } from '../lib/time'
import { type A365Series, absoluteA365Url, anime365 } from './anime365'
import { type JikanAnime, jikan, jikanImage, normalizeStatus, normalizeType } from './jikan'

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
    latestEpisode: row.latestEpisode,
    nextAiringAt: nextAiringAt(row)?.toISOString() ?? null,
  }
}

function fromJikan(j: JikanAnime): AnimeInsert {
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
    trailerUrl: j.trailer?.url ?? (j.trailer?.youtube_id ? `https://www.youtube.com/watch?v=${j.trailer.youtube_id}` : null),
    updatedAt: now(),
  }
}

function fromA365(s: A365Series, malId: number): AnimeInsert {
  const [seasonName] = (s.season ?? '').toLowerCase().split(' ')
  return {
    malId,
    title: s.titles?.romaji || s.titles?.en || s.titles?.ru || `#${malId}`,
    titleEnglish: s.titles?.en ?? null,
    titleJapanese: s.titles?.ja ?? null,
    synonyms: s.titles?.ru ? [s.titles.ru] : [],
    imageUrl: s.posterUrl ? absoluteA365Url(s.posterUrl) : null,
    type: normalizeType(s.type),
    episodes: s.numberOfEpisodes || null,
    status: s.isAiring ? 'airing' : 'finished',
    airing: Boolean(s.isAiring),
    year: s.year ?? null,
    season: (seasonName && SEASONS[seasonName]) || null,
    score: s.myAnimeListScore && s.myAnimeListScore > 0 ? s.myAnimeListScore : null,
    genres: (s.genres ?? []).map((g) => g.title),
    synopsis: s.descriptions?.[0]?.value ?? null,
    updatedAt: now(),
  }
}

export function upsertAnime(data: AnimeInsert, opts: { details?: boolean; onlyIfMissing?: boolean } = {}) {
  const values = opts.details ? { ...data, detailsFetchedAt: now() } : data
  const { malId: _malId, ...set } = values
  const query = db.insert(anime).values(values)
  if (opts.onlyIfMissing) query.onConflictDoNothing().run()
  else query.onConflictDoUpdate({ target: anime.malId, set }).run()
}

export function upsertJikanSummaries(items: JikanAnime[]): AnimeSummary[] {
  const existing = new Map(
    items.length
      ? db.select().from(anime).where(inArray(anime.malId, items.map((i) => i.mal_id))).all().map((r) => [r.malId, r])
      : [],
  )
  return items.map((item) => {
    const data = fromJikan(item)
    const row = existing.get(item.mal_id)
    if (!row) upsertAnime(data)
    else if (!row.detailsFetchedAt) upsertAnime({ ...data, latestEpisode: row.latestEpisode })
    return toSummary({ ...(row ?? ({} as AnimeRow)), ...data, latestEpisode: row?.latestEpisode ?? null } as AnimeRow)
  })
}

export function getAnimeRow(malId: number): AnimeRow | undefined {
  return db.select().from(anime).where(eq(anime.malId, malId)).get()
}

function maxAge(row: AnimeRow): number {
  return row.status === 'finished' ? 7 * 24 * HOUR : 6 * HOUR
}

export async function ensureAnime(malId: number, opts: { force?: boolean } = {}): Promise<AnimeRow> {
  const row = getAnimeRow(malId)
  const fresh = row?.detailsFetchedAt && Date.now() - Date.parse(row.detailsFetchedAt) < maxAge(row)
  if (row && fresh && !opts.force) return row
  if (metadataSource() === 'anime365') {
    try {
      upsertAnime(await fetchFromA365(malId), { details: true })
    } catch (error) {
      if (row) return row
      throw error
    }
    return getAnimeRow(malId)!
  }
  try {
    const data = await jikan.anime(malId)
    upsertAnime(fromJikan(data), { details: true })
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404 && !row) throw error
    if (row) return row
    const data = await fetchFromA365(malId).catch(() => null)
    if (!data) throw error
    upsertAnime(data)
  }
  return getAnimeRow(malId)!
}

async function fetchFromA365(malId: number): Promise<AnimeInsert> {
  const series = await anime365.seriesByMal(malId)
  if (!series) throw new UpstreamError('anime365', 404, 'Not found on Anime365')
  const full = await anime365.series(series.id).catch(() => series)
  return fromA365(full, malId)
}

export function searchFallback(query: string): Promise<AnimeSummary[]> {
  return anime365.search(query).then(upsertA365Summaries)
}

export function upsertA365Summaries(rows: A365Series[]): AnimeSummary[] {
  const result: AnimeSummary[] = []
  for (const s of rows) {
    if (!s.myAnimeListId || s.isHentai) continue
    const data = fromA365(s, s.myAnimeListId)
    upsertAnime(data, { onlyIfMissing: true })
    result.push(toSummary(getAnimeRow(s.myAnimeListId)!))
  }
  return result
}

export function setLatestEpisode(malId: number, episode: number) {
  const row = getAnimeRow(malId)
  if (!row || (row.latestEpisode ?? 0) >= episode) return
  db.update(anime).set({ latestEpisode: episode }).where(eq(anime.malId, malId)).run()
}
