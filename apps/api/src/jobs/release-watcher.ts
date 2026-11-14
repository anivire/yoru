import { and, eq, inArray, lt } from 'drizzle-orm'
import { db, now } from '../db/client'
import { listEntries, notifications, providerMappings, providerReleases, users } from '../db/schema'
import { env } from '../env'
import { cachePurgeExpired } from '../lib/http'
import { purgeExpiredSessions } from '../lib/auth'
import { getSetting, setSetting } from '../lib/settings'
import { getAnimeRow, setLatestEpisode } from '../services/anime'
import { type A365Translation, TYPE_TO_KIND, anime365, seriesTitle } from '../services/anime365'
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
        lt(listEntries.progress, episode),
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

function rememberMapping(t: A365Translation, malId: number) {
  if (!t.series) return
  db.insert(providerMappings)
    .values({ provider: PROVIDER, malId, providerId: t.series.id, title: seriesTitle(t.series), manual: false, updatedAt: now() })
    .onConflictDoNothing()
    .run()
}

export async function checkReleases() {
  let created = 0
  for (const type of Object.keys(TYPE_TO_KIND)) {
    const kind = TYPE_TO_KIND[type]!
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
      const activeAt = Date.parse((t.activeDateTime ?? '').replace(' ', 'T') + '+03:00')
      if (Number.isFinite(activeAt) && Date.now() - activeAt > RECENT_MS) continue
      created += notifyUsers(malId, episode, kind, author)
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
