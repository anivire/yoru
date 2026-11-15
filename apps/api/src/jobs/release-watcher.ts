import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db, now } from '../db/client'
import { listEntries, notifications, providerMappings, providerReleases, users } from '../db/schema'
import { env } from '../env'
import { cachePurgeExpired } from '../lib/http'
import { purgeExpiredSessions } from '../lib/auth'
import { getSetting, setSetting } from '../lib/settings'
import { getAnimeRow, setLatestEpisode, upsertA365Summaries } from '../services/anime'
import { type A365Translation, RELEASE_TYPES, anime365, seriesTitle } from '../services/anime365'
import { PROVIDER } from '../services/provider'

const PAGE = 100
const MAX_PAGES = 10
const RECENT_MS = 3 * 86_400_000
const MAIN_TYPES = ['tv', 'ova', 'ona', 'movie']
const NOTIFY_STATUSES = ['watching', 'rewatching', 'planning'] as const

async function fetchNew(type: string): Promise<A365Translation[]> {
  const cursorKey = `release_cursor_${type}`
  const cursor = Number(getSetting(cursorKey) ?? 0)
  const fresh: A365Translation[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await anime365.recent(type, page * PAGE, PAGE)
    if (!rows.length) break
    if (!cursor) {
      setSetting(cursorKey, String(Math.max(...rows.map((r) => r.id))))
      return []
    }
    const newer = rows.filter((r) => r.id > cursor)
    fresh.push(...newer)
    if (newer.length < rows.length) break
  }
  if (fresh.length) setSetting(cursorKey, String(Math.max(...fresh.map((r) => r.id))))
  return fresh.sort((a, b) => a.id - b.id)
}

function notifyUsers(malId: number, episode: number, kind: 'sub' | 'voice', author: string | null) {
  const pref = kind === 'sub' ? users.notifySub : users.notifyVoice
  const targets = db
    .select({ userId: listEntries.userId })
    .from(listEntries)
    .innerJoin(users, eq(users.id, listEntries.userId))
    .where(
      and(
        eq(listEntries.malId, malId),
        inArray(listEntries.status, [...NOTIFY_STATUSES]),
        eq(pref, true),
      ),
    )
    .all()
  for (const { userId } of targets) {
    db.insert(notifications)
      .values({ userId, malId, episode, kind, author, createdAt: now() })
      .onConflictDoNothing()
      .run()
  }
  return targets.length
}

function a365Time(value: string | undefined): number {
  return Date.parse((value ?? '').replace(' ', 'T') + '+03:00')
}

function isPremiere(t: A365Translation, malId: number): boolean {
  const ep = t.episode
  if (!ep || Number(ep.episodeInt) !== 1 || !t.series || t.series.isHentai) return false
  const recentTitle = t.series.isAiring === 1 || (t.series.year ?? 0) >= new Date().getFullYear() - 1
  if (!recentTitle) return false
  const firstUpload = a365Time(ep.firstUploadedDateTime)
  if (!Number.isFinite(firstUpload) || Date.now() - firstUpload > RECENT_MS) return false
  const releases = db
    .select({ n: sql<number>`count(*)` })
    .from(providerReleases)
    .where(and(eq(providerReleases.malId, malId), eq(providerReleases.provider, PROVIDER)))
    .get()
  return (releases?.n ?? 0) === 1
}

function notifyPremiere(t: A365Translation, malId: number, kind: 'sub' | 'voice', author: string | null) {
  if (t.series) upsertA365Summaries([t.series])
  const inList = db.select({ userId: listEntries.userId }).from(listEntries).where(eq(listEntries.malId, malId))
  const targets = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.notifyPremieres, true), notInArray(users.id, inList)))
    .all()
  for (const { id } of targets) {
    db.insert(notifications)
      .values({ userId: id, malId, episode: 1, kind, type: 'premiere', author, createdAt: now() })
      .onConflictDoNothing()
      .run()
  }
  return targets.length
}

function rememberMapping(t: A365Translation, malId: number) {
  if (!t.series) return
  db.insert(providerMappings)
    .values({ provider: PROVIDER, malId, providerId: t.series.id, title: seriesTitle(t.series), manual: false, updatedAt: now() })
    .onConflictDoNothing()
    .run()
}

export async function checkReleases() {
  let created = 0
  for (const type of RELEASE_TYPES) {
    const kind = type === 'voiceRu' ? 'voice' : 'sub'
    const rows = await fetchNew(type)
    for (const t of rows) {
      const malId = t.series?.myAnimeListId
      const episode = Number(t.episode?.episodeInt)
      if (!malId || !Number.isInteger(episode) || episode <= 0) continue
      if (!MAIN_TYPES.includes(t.episode?.episodeType ?? '')) continue
      rememberMapping(t, malId)
      if (getAnimeRow(malId)) setLatestEpisode(malId, episode)
      const author = t.authorsSummary || null
      const inserted = db
        .insert(providerReleases)
        .values({ provider: PROVIDER, malId, episode, kind, translationId: t.id, author, releasedAt: t.activeDateTime ?? now() })
        .onConflictDoNothing()
        .run()
      if (!inserted.changes) continue
      const activeAt = a365Time(t.activeDateTime)
      if (Number.isFinite(activeAt) && Date.now() - activeAt > RECENT_MS) continue
      created += notifyUsers(malId, episode, kind, author)
      if (isPremiere(t, malId)) created += notifyPremiere(t, malId, kind, author)
    }
  }
  return created
}

let timer: NodeJS.Timeout | null = null
let running = false

async function tick() {
  if (running) return
  running = true
  try {
    const created = await checkReleases()
    if (created) console.log(`[releases] ${created} notification(s) created`)
    cachePurgeExpired()
    purgeExpiredSessions()
  } catch (error) {
    console.warn('[releases] check failed:', (error as Error).message)
  } finally {
    running = false
  }
}

export function startReleaseWatcher() {
  if (timer) return
  setTimeout(tick, 5_000)
  timer = setInterval(tick, env.releasePollMinutes * 60_000)
}
