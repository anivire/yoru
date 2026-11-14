import type { ListStatus, RecentItem, ScheduleItem } from '@yoru/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { cached } from '../lib/http'
import { anime, listEntries } from '../db/schema'
import type { AnimeSummary } from '@yoru/shared'
import { ensureAnime, getAnimeRow, toSummary, upsertA365Summaries } from './anime'
import { TYPE_TO_KIND, anime365 } from './anime365'
import { currentSeason, shikiSummaries, shikimori } from './shikimori'

const filling = new Set<number>()

function fillMissing(items: AnimeSummary[]): AnimeSummary[] {
  for (const item of items.filter((i) => !i.imageUrl).slice(0, 12)) {
    if (filling.has(item.malId)) continue
    filling.add(item.malId)
    ensureAnime(item.malId)
      .catch(() => undefined)
      .finally(() => filling.delete(item.malId))
  }
  return items
}

function a365Date(value: string | undefined): string {
  if (!value) return new Date().toISOString()
  return new Date(`${value.replace(' ', 'T')}+03:00`).toISOString()
}

const DAY = 86_400_000
const WEEK = 7 * DAY
const WEEKLY_KINDS = new Set(['tv', 'ona', 'tv_special'])
const MAX_RANGE = 70 * DAY

export async function schedule(userId: number, fromIso?: string, toIso?: string): Promise<ScheduleItem[]> {
  const now = Date.now()
  let from = Date.parse(fromIso ?? '') || now - 7 * DAY
  let to = Date.parse(toIso ?? '') || now + 28 * DAY
  if (to < from) [from, to] = [to, from]
  if (to - from > MAX_RANGE) to = from + MAX_RANGE
  const entries = await shikimori.calendar()
  const statuses = new Map(
    db
      .select({ malId: listEntries.malId, status: listEntries.status })
      .from(listEntries)
      .where(and(eq(listEntries.userId, userId)))
      .all()
      .map((e) => [e.malId, e.status as ListStatus]),
  )
  const summaries = fillMissing(shikiSummaries(entries.map((e) => e.anime)))
  const available = new Map(
    entries.length
      ? db
          .select({ malId: anime.malId, latest: anime.latestEpisode })
          .from(anime)
          .where(inArray(anime.malId, entries.map((e) => e.anime.id)))
          .all()
          .map((r) => [r.malId, r.latest ?? 0])
      : [],
  )
  const items: ScheduleItem[] = []
  entries.forEach((e, i) => {
    const summary = summaries[i]!
    const base = Date.parse(e.next_episode_at)
    if (!Number.isFinite(base)) return
    const total = e.anime.episodes || 0
    const weekly = WEEKLY_KINDS.has(e.anime.kind ?? '')
    const push = (episode: number, at: number, estimated: boolean) => {
      if (at < from || at > to || episode < 1) return
      items.push({
        anime: summary,
        episode,
        airingAt: new Date(at).toISOString(),
        listStatus: statuses.get(e.anime.id) ?? null,
        aired: at <= now,
        available: (available.get(e.anime.id) ?? 0) >= episode,
        estimated,
      })
    }
    push(e.next_episode, base, false)
    if (!weekly) return
    for (let k = 1; e.next_episode - k >= 1 && base - k * WEEK >= from; k++) push(e.next_episode - k, base - k * WEEK, true)
    for (let k = 1; (!total || e.next_episode + k <= total) && base + k * WEEK <= to; k++) push(e.next_episode + k, base + k * WEEK, true)
  })
  return items.sort((x, y) => x.airingAt.localeCompare(y.airingAt))
}

export function recentReleases(): Promise<RecentItem[]> {
  return cached('discover:recent', 5 * 60_000, loadRecent)
}

async function loadRecent(): Promise<RecentItem[]> {
  const rows = (
    await Promise.all(['subRu', 'voiceRu'].map((type) => anime365.recent(type, 0, 50).catch(() => [])))
  ).flat()
  rows.sort((a, b) => (b.activeDateTime ?? '').localeCompare(a.activeDateTime ?? ''))
  const seen = new Set<number>()
  const result: RecentItem[] = []
  for (const row of rows) {
    const series = row.series
    const malId = series?.myAnimeListId
    if (!series || !malId || series.isHentai || seen.has(malId)) continue
    const episode = Number(row.episode?.episodeInt)
    if (!Number.isInteger(episode) || episode <= 0) continue
    seen.add(malId)
    upsertA365Summaries([series])
    const anime = getAnimeRow(malId)
    if (!anime) continue
    result.push({ anime: toSummary(anime), episode, at: a365Date(row.activeDateTime), kind: TYPE_TO_KIND[row.type] ?? 'sub' })
    if (result.length >= 24) break
  }
  return result
}

const COLLECTIONS = {
  hero: { season: 'current', order: 'popularity', limit: 10 },
  top: { order: 'ranked', limit: 24 },
  anons: { status: 'anons', order: 'popularity', limit: 24 },
} as const

export type Collection = keyof typeof COLLECTIONS

export function isCollection(value: string): value is Collection {
  return value in COLLECTIONS
}

export async function collection(name: Collection): Promise<AnimeSummary[]> {
  const { season, ...params } = { season: undefined, ...COLLECTIONS[name] }
  const rows = await shikimori.animes({ ...params, ...(season ? { season: currentSeason() } : {}) })
  return fillMissing(shikiSummaries(rows))
}

export async function trending(genre: number | null) {
  const rows = await shikimori.animes({ season: currentSeason(), order: 'popularity', ...(genre ? { genre } : {}) })
  return fillMissing(shikiSummaries(rows))
}
