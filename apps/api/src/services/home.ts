import { and, desc, eq, inArray, max, ne } from 'drizzle-orm'
import type { ContinueItem, HomeData, UpcomingItem } from '@yoru/shared'
import { db } from '../db/client'
import { activity, anime, listEntries, providerReleases, watchProgress } from '../db/schema'
import { featureEnabled } from '../lib/features'
import { cacheGet } from '../lib/http'
import { queueAnimeRefresh } from '../jobs/anime-backfill'
import { nextAiringAt, toSummary } from './anime'
import type { JikanEpisodeVideo, JikanList } from './jikan'
import { airedEpisode } from './aired'
import { allEntries } from './lists'
import { cachedBanner, shikimori, warmBanners } from './shikimori'

const ACTIVE = new Set(['watching', 'rewatching', 'paused', 'planning'])
function cachedEpisodeImage(malId: number, episode: number): string | null {
  const page = cacheGet<JikanList<JikanEpisodeVideo>>(`jikan:episode-videos:${malId}:1`)
  const video = page?.data.find((v) => Number(/\d+/.exec(v.episode ?? '')?.[0]) === episode)
  return video?.images?.jpg?.image_url ?? null
}

export async function homeData(userId: number): Promise<HomeData> {
  const calendar = new Map((featureEnabled('discover') ? await shikimori.calendar().catch(() => []) : []).map((e) => [e.anime.id, e]))
  const entries = allEntries(userId)
  const byMal = new Map(entries.map((e) => [e.malId, e]))
  const available = new Map(
    entries.length
      ? db
          .select({ malId: anime.malId, latest: anime.latestEpisode })
          .from(anime)
          .where(inArray(anime.malId, entries.map((e) => e.malId)))
          .all()
          .map((r) => [r.malId, r.latest ?? 0])
      : [],
  )

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
    let episode = finished ? p.episode + 1 : p.episode
    let position = finished ? 0 : p.position
    let duration = finished ? 0 : p.duration
    if (entry.progress + 1 > episode) {
      episode = entry.progress + 1
      position = 0
      duration = 0
    }
    const limit = a.status === 'finished' ? a.episodes : (airedEpisode(a.malId, a.latestEpisode) ?? a.episodes)
    if (limit && episode > limit) continue
    const pendingTranslation = a.status !== 'finished' && (a.latestEpisode ?? 0) < episode
    continueWatching.push({
      anime: toSummary(a),
      episode,
      episodeTitle: null,
      episodeImageUrl: cachedEpisodeImage(a.malId, episode),
      position,
      duration,
      updatedAt: p.updatedAt,
      fresh: false,
      pending: pendingTranslation,
    })
  }

  for (const e of entries) {
    if (seen.has(e.malId) || (e.status !== 'watching' && e.status !== 'rewatching')) continue
    const episode = e.progress + 1
    const finished = e.anime.status === 'finished'
    const limit = finished ? e.anime.episodes : (airedEpisode(e.malId, e.latestEpisode) ?? e.latestEpisode ?? e.anime.episodes)
    if (!limit || episode > limit) continue
    seen.add(e.malId)
    const pending = !finished && (available.get(e.malId) ?? 0) < episode
    continueWatching.push({
      anime: e.anime,
      episode,
      episodeTitle: null,
      episodeImageUrl: cachedEpisodeImage(e.malId, episode),
      position: 0,
      duration: 0,
      updatedAt: e.updatedAt,
      fresh: false,
      pending,
    })
  }

  const released = new Map<string, string>()
  if (continueWatching.length) {
    const rows = db
      .select({ malId: providerReleases.malId, episode: providerReleases.episode, releasedAt: providerReleases.releasedAt })
      .from(providerReleases)
      .where(and(inArray(providerReleases.malId, continueWatching.map((c) => c.anime.malId)), ne(providerReleases.kind, 'raw')))
      .all()
    for (const r of rows) {
      const key = `${r.malId}:${r.episode}`
      const prev = released.get(key)
      if (!prev || r.releasedAt < prev) released.set(key, r.releasedAt)
    }
  }
  for (const item of continueWatching) {
    const at = released.get(`${item.anime.malId}:${item.episode}`)
    if (at && at > item.updatedAt && item.position === 0) {
      item.fresh = true
      item.updatedAt = at
    }
  }
  continueWatching.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  continueWatching.splice(12)

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
    const scheduled = calendar.get(a.malId)
    if (scheduled && Date.parse(scheduled.next_episode_at) > Date.now()) {
      upcoming.push({ anime: toSummary(a), episode: scheduled.next_episode, airingAt: new Date(scheduled.next_episode_at).toISOString(), bannerUrl: null })
      continue
    }
    const at = nextAiringAt(a)
    if (!at) continue
    const next = (a.latestEpisode ?? 0) + 1
    upcoming.push({ anime: toSummary(a), episode: a.episodes && next > a.episodes ? null : next, airingAt: at.toISOString(), bannerUrl: null })
  }
  upcoming.sort((x, y) => x.airingAt.localeCompare(y.airingAt))
  const soon = upcoming.slice(0, 12)
  warmBanners(soon.map((u) => u.anime.malId))
  for (const item of soon) item.bannerUrl = cachedBanner(item.anime.malId) ?? null

  const lastWatched = new Map<number, string>()
  for (const { progress: p } of progressRows) {
    if ((lastWatched.get(p.malId) ?? '') < p.updatedAt) lastWatched.set(p.malId, p.updatedAt)
  }
  for (const row of db
    .select({ malId: activity.malId, at: max(activity.createdAt) })
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.source, 'watch')))
    .groupBy(activity.malId)
    .all()) {
    if (row.at && (lastWatched.get(row.malId) ?? '') < row.at) lastWatched.set(row.malId, row.at)
  }
  const watching = entries
    .filter((e) => e.status === 'watching' || e.status === 'rewatching')
    .sort((x, y) => (lastWatched.get(y.malId) ?? '').localeCompare(lastWatched.get(x.malId) ?? '') || y.updatedAt.localeCompare(x.updatedAt))

  const stale = rows
    .map((r) => r.anime)
    .filter((a) => byMal.get(a.malId) && ACTIVE.has(byMal.get(a.malId)!.status) && a.status !== 'finished')
    .filter((a) => !a.detailsFetchedAt || Date.now() - Date.parse(a.detailsFetchedAt) > 12 * 3_600_000)
    .map((a) => a.malId)
  queueAnimeRefresh(stale, { outdated: true })

  return { continueWatching, upcoming: soon, watching }
}
