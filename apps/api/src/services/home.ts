import { and, desc, eq } from 'drizzle-orm'
import type { ContinueItem, HomeData, UpcomingItem } from '@yoru/shared'
import { db } from '../db/client'
import { anime, listEntries, watchProgress } from '../db/schema'
import { cacheGet } from '../lib/http'
import { ensureAnime, nextAiringAt, toSummary } from './anime'
import type { JikanEpisodeVideo, JikanList } from './jikan'
import { allEntries } from './lists'

const ACTIVE = new Set(['watching', 'rewatching', 'paused', 'planning'])
const refreshing = new Set<number>()

function refreshInBackground(malIds: number[]) {
  for (const malId of malIds.slice(0, 15)) {
    if (refreshing.has(malId)) continue
    refreshing.add(malId)
    ensureAnime(malId)
      .catch(() => undefined)
      .finally(() => refreshing.delete(malId))
  }
}

function cachedEpisodeImage(malId: number, episode: number): string | null {
  const page = cacheGet<JikanList<JikanEpisodeVideo>>(`jikan:episode-videos:${malId}:1`)
  const video = page?.data.find((v) => Number(/\d+/.exec(v.episode ?? '')?.[0]) === episode)
  return video?.images?.jpg?.image_url ?? null
}

export function homeData(userId: number): HomeData {
  const entries = allEntries(userId)
  const byMal = new Map(entries.map((e) => [e.malId, e]))

  const progressRows = db
    .select({ progress: watchProgress, anime })
    .from(watchProgress)
    .innerJoin(anime, eq(anime.malId, watchProgress.malId))
    .where(eq(watchProgress.userId, userId))
    .orderBy(desc(watchProgress.updatedAt))
    .limit(200)
    .all()

  const continueWatching: ContinueItem[] = []
  const seen = new Set<number>()
  for (const { progress: p, anime: a } of progressRows) {
    if (seen.has(p.malId)) continue
    seen.add(p.malId)
    const entry = byMal.get(p.malId)
    if (!entry || !ACTIVE.has(entry.status)) continue
    const finished = p.duration > 0 && p.position / p.duration > 0.9
    let episode = p.episode
    let position = p.position
    if (finished) {
      episode = p.episode + 1
      position = 0
      const limit = a.episodes ?? a.latestEpisode
      if (limit && episode > limit) continue
    }
    continueWatching.push({
      anime: toSummary(a),
      episode,
      episodeTitle: null,
      episodeImageUrl: cachedEpisodeImage(a.malId, episode),
      position,
      duration: finished ? 0 : p.duration,
      updatedAt: p.updatedAt,
    })
    if (continueWatching.length >= 8) break
  }

  const upcoming: UpcomingItem[] = []
  const rows = db
    .select({ anime })
    .from(listEntries)
    .innerJoin(anime, eq(anime.malId, listEntries.malId))
    .where(and(eq(listEntries.userId, userId)))
    .all()
  for (const { anime: a } of rows) {
    const entry = byMal.get(a.malId)
    if (!entry || !ACTIVE.has(entry.status)) continue
    const at = nextAiringAt(a)
    if (!at) continue
    const next = (a.latestEpisode ?? 0) + 1
    upcoming.push({ anime: toSummary(a), episode: a.episodes && next > a.episodes ? null : next, airingAt: at.toISOString() })
  }
  upcoming.sort((x, y) => x.airingAt.localeCompare(y.airingAt))

  const watching = entries
    .filter((e) => e.status === 'watching' || e.status === 'rewatching')
    .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))

  const stale = rows
    .map((r) => r.anime)
    .filter((a) => byMal.get(a.malId) && ACTIVE.has(byMal.get(a.malId)!.status) && a.status !== 'finished')
    .filter((a) => !a.detailsFetchedAt || Date.now() - Date.parse(a.detailsFetchedAt) > 12 * 3_600_000)
    .map((a) => a.malId)
  refreshInBackground(stale)

  return { continueWatching, upcoming: upcoming.slice(0, 12), watching }
}
