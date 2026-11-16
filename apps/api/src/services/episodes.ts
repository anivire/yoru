import { and, eq } from 'drizzle-orm'
import type { Episode } from '@yoru/shared'
import { db } from '../db/client'
import { watchProgress } from '../db/schema'
import { isActive } from '../providers/chain'
import type { AnimeRow } from './anime'
import { type JikanEpisode, type JikanEpisodeVideo, jikan } from './jikan'
import { getEntry } from './lists'
import { providerEpisodes } from './provider'

const HOUR = 3_600_000

async function jikanEpisodes(row: AnimeRow): Promise<JikanEpisode[]> {
  const ttl = row.status === 'finished' ? 7 * 24 * HOUR : 3 * HOUR
  const all: JikanEpisode[] = []
  for (let page = 1; page <= 30; page++) {
    const res = await jikan.episodes(row.malId, page, ttl)
    all.push(...res.data)
    if (!res.pagination.has_next_page) break
  }
  return all
}

async function jikanThumbs(row: AnimeRow): Promise<Map<number, string>> {
  const ttl = row.status === 'finished' ? 7 * 24 * HOUR : 6 * HOUR
  const map = new Map<number, string>()
  for (let page = 1; page <= 5; page++) {
    const res = await jikan.episodeVideos(row.malId, page, ttl)
    for (const v of res.data as JikanEpisodeVideo[]) {
      const n = Number(/\d+/.exec(v.episode ?? '')?.[0])
      const url = v.images?.jpg?.image_url
      if (n && url && !map.has(n)) map.set(n, url)
    }
    if (!res.pagination.has_next_page) break
  }
  return map
}

export async function episodeList(userId: number, row: AnimeRow): Promise<Episode[]> {
  const useJikan = isActive('metadata', 'jikan')
  const [meta, thumbs, provider] = await Promise.all([
    useJikan ? jikanEpisodes(row).catch(() => [] as JikanEpisode[]) : [],
    useJikan ? jikanThumbs(row).catch(() => new Map<number, string>()) : new Map<number, string>(),
    providerEpisodes(row.malId).catch(() => []),
  ])
  const available = new Map(provider.map((e) => [Number(e.episodeInt), e]))
  const metaByNumber = new Map(meta.map((e) => [e.mal_id, e]))
  const progress = new Map(
    db
      .select()
      .from(watchProgress)
      .where(and(eq(watchProgress.userId, userId), eq(watchProgress.malId, row.malId)))
      .all()
      .map((p) => [p.episode, p]),
  )
  const watchedUpTo = getEntry(userId, row.malId)?.progress ?? 0
  const count = Math.max(
    row.episodes ?? 0,
    meta.at(-1)?.mal_id ?? 0,
    provider.length ? Number(provider.at(-1)!.episodeInt) : 0,
    row.status === 'finished' && !row.episodes ? 1 : 0,
  )
  const result: Episode[] = []
  for (let n = 1; n <= count; n++) {
    const m = metaByNumber.get(n)
    const p = progress.get(n)
    const providerEpisode = available.get(n)
    if (!m && !providerEpisode && n > (row.latestEpisode ?? 0) && row.status !== 'finished') continue
    result.push({
      number: n,
      title: m?.title || providerEpisode?.episodeTitle || null,
      titleJapanese: m?.title_japanese ?? null,
      aired: m?.aired ?? null,
      filler: Boolean(m?.filler),
      recap: Boolean(m?.recap),
      imageUrl: thumbs.get(n) ?? null,
      available: Boolean(providerEpisode),
      watched: n <= watchedUpTo,
      position: p?.position ?? null,
      duration: p?.duration ?? null,
    })
  }
  return result
}
