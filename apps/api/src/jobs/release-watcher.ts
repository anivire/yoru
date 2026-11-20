import { and, eq, gt, inArray, isNotNull, lt, notInArray, sql } from 'drizzle-orm'
import { CALENDAR_SOURCES, type CalendarSource, type ReleaseSource, TRANSLATION_SOURCES } from '@yoru/shared'
import { db, now } from '../db/client'
import { listEntries, notifications, providerMappings, providerReleases, socialNotifications, users } from '../db/schema'
import { env } from '../env'
import { cachePurgeExpired } from '../lib/http'
import { purgeExpiredSessions } from '../lib/auth'
import { getSetting, setSetting } from '../lib/settings'
import { featureEnabled } from '../lib/features'
import { isActive } from '../providers/chain'
import { ensureAnime, getAnimeRow, setLatestEpisode, upsertA365Summaries } from '../services/anime'
import { type A365Translation, RELEASE_TYPES, anime365, seriesTitle } from '../services/anime365'
import { anilibriaLatest } from '../services/anilibria'
import { kodikRecent } from '../services/kodik'
import { PROVIDER } from '../services/provider'
import { shikimori } from '../services/shikimori'

const PAGE = 100
const MAX_PAGES = 10
const RECENT_MS = 3 * 86_400_000
const MAIN_TYPES = ['tv', 'ova', 'ona', 'movie']
const NOTIFY_STATUSES = ['watching', 'rewatching', 'planning'] as const
const LATEST_LIMIT = 50
const KODIK_LIMIT = 100

type ReleaseKind = 'sub' | 'voice' | 'raw'

interface Release {
  provider: string
  malId: number
  episode: number
  kind: ReleaseKind
  translationId: number
  author: string | null
  releasedAt: string
}

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

function activeSources(): Set<string> {
  return new Set(TRANSLATION_SOURCES.filter((id) => isActive('video', id)))
}

export function activeCalendars(): CalendarSource[] {
  return CALENDAR_SOURCES.filter((id) => id !== 'shikimori' || featureEnabled('discover'))
}

function wantsSource(chosen: string | null, provider: string, active: Set<string>): boolean {
  return !chosen || chosen === provider || !active.has(chosen)
}

function hasLater(release: Release): boolean {
  return Boolean(
    db
      .select({ episode: providerReleases.episode })
      .from(providerReleases)
      .where(and(eq(providerReleases.malId, release.malId), eq(providerReleases.kind, release.kind), gt(providerReleases.episode, release.episode)))
      .get(),
  )
}

function notifyUsers(release: Release) {
  if (hasLater(release)) return 0
  const pref = release.kind === 'raw' ? users.notifyAired : release.kind === 'sub' ? users.notifySub : users.notifyVoice
  const targets = db
    .select({ userId: listEntries.userId, source: users.notifySource, calendar: users.airedSource })
    .from(listEntries)
    .innerJoin(users, eq(users.id, listEntries.userId))
    .where(
      and(
        eq(listEntries.malId, release.malId),
        inArray(listEntries.status, [...NOTIFY_STATUSES]),
        lt(listEntries.progress, release.episode),
        eq(pref, true),
      ),
    )
    .all()
  const wanted =
    release.kind === 'raw'
      ? targets.filter((row) => wantsSource(row.calendar, release.provider, new Set(activeCalendars())))
      : targets.filter((row) => wantsSource(row.source, release.provider, activeSources()))
  let created = 0
  for (const { userId } of wanted) {
    created += db
      .insert(notifications)
      .values({ userId, malId: release.malId, episode: release.episode, kind: release.kind, type: release.kind === 'raw' ? 'aired' : 'episode', provider: release.provider, author: release.author, createdAt: now() })
      .onConflictDoNothing()
      .run().changes
  }
  return created
}

function store(release: Release): boolean {
  return db
    .insert(providerReleases)
    .values({ provider: release.provider, malId: release.malId, episode: release.episode, kind: release.kind, translationId: release.translationId, author: release.author, releasedAt: release.releasedAt })
    .onConflictDoNothing()
    .run().changes > 0
}

function isRecent(release: Release): boolean {
  const releasedAt = Date.parse(release.releasedAt)
  return !Number.isFinite(releasedAt) || Date.now() - releasedAt <= RECENT_MS
}

function record(release: Release, notify: boolean): number {
  if (!store(release) || !notify || !isRecent(release)) return 0
  return notifyUsers(release)
}

function known(provider: string, malId: number, episode: number, kind: ReleaseKind): boolean {
  return Boolean(
    db
      .select({ episode: providerReleases.episode })
      .from(providerReleases)
      .where(and(eq(providerReleases.provider, provider), eq(providerReleases.malId, malId), eq(providerReleases.episode, episode), eq(providerReleases.kind, kind)))
      .get(),
  )
}

function firstRun(provider: string): boolean {
  const key = `release_seeded_${provider}`
  if (getSetting(key)) return false
  setSetting(key, now())
  return true
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
  return firstForProvider(PROVIDER, malId)
}

function firstForProvider(provider: string, malId: number): boolean {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(providerReleases)
    .where(and(eq(providerReleases.malId, malId), eq(providerReleases.provider, provider)))
    .get()
  return (row?.n ?? 0) === 1
}

function recentYear(year: number | null | undefined): boolean {
  return (year ?? 0) >= new Date().getFullYear() - 1
}

async function notifyPremiere(release: Release) {
  if (!getAnimeRow(release.malId)) await ensureAnime(release.malId).catch(() => undefined)
  const inList = db.select({ userId: listEntries.userId }).from(listEntries).where(eq(listEntries.malId, release.malId))
  const active = activeSources()
  const targets = db
    .select({ id: users.id, source: users.premiereSource })
    .from(users)
    .where(and(eq(users.notifyPremieres, true), notInArray(users.id, inList)))
    .all()
    .filter((row) => wantsSource(row.source, release.provider, active))
  let created = 0
  for (const { id } of targets) {
    created += db
      .insert(notifications)
      .values({ userId: id, malId: release.malId, episode: 1, kind: release.kind, type: 'premiere', provider: release.provider, author: release.author, createdAt: now() })
      .onConflictDoNothing()
      .run().changes
  }
  return created
}

function rememberMapping(t: A365Translation, malId: number) {
  if (!t.series) return
  db.insert(providerMappings)
    .values({ provider: PROVIDER, malId, providerId: t.series.id, title: seriesTitle(t.series), manual: false, updatedAt: now() })
    .onConflictDoNothing()
    .run()
}

async function checkAnime365() {
  if (!isActive('video', PROVIDER)) return null
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
      const activeAt = a365Time(t.activeDateTime)
      const releasedAt = Number.isFinite(activeAt) ? new Date(activeAt).toISOString() : now()
      const release: Release = { provider: PROVIDER, malId, episode, kind, translationId: t.id, author, releasedAt }
      if (!store(release) || !isRecent(release)) continue
      created += notifyUsers(release)
      if (isPremiere(t, malId)) {
        if (t.series) upsertA365Summaries([t.series])
        created += await notifyPremiere(release)
      }
    }
  }
  return created
}

async function checkAnilibria() {
  if (!isActive('video', 'anilibria')) return null
  const seeding = firstRun('anilibria')
  let created = 0
  for (const r of await anilibriaLatest(LATEST_LIMIT)) {
    const malId = r.mal?.id ?? r.shikimori?.id
    const episode = Math.round(Number(r.latest_episode?.ordinal))
    if (!malId || !Number.isInteger(episode) || episode <= 0) continue
    const releasedAt = r.latest_episode?.updated_at ?? r.fresh_at ?? now()
    const release: Release = { provider: 'anilibria', malId, episode, kind: 'voice', translationId: r.id, author: null, releasedAt }
    if (!store(release) || seeding || !isRecent(release)) continue
    created += notifyUsers(release)
    if (episode === 1 && (r.is_ongoing || recentYear(r.year)) && firstForProvider('anilibria', malId)) created += await notifyPremiere(release)
  }
  return created
}

async function checkKodik() {
  if (!isActive('video', 'kodik')) return null
  const seeding = firstRun('kodik')
  let created = 0
  for (const r of await kodikRecent(KODIK_LIMIT)) {
    const malId = Number(r.shikimori_id)
    const episode = Number(r.last_episode)
    if (!Number.isInteger(malId) || malId <= 0 || !Number.isInteger(episode) || episode <= 0) continue
    const kind = r.translation.type === 'subtitles' ? 'sub' : 'voice'
    const release: Release = { provider: 'kodik', malId, episode, kind, translationId: r.translation.id, author: r.translation.title || null, releasedAt: r.updated_at }
    if (!store(release) || seeding || !isRecent(release)) continue
    created += notifyUsers(release)
    if (episode === 1 && recentYear(r.year) && firstForProvider('kodik', malId)) created += await notifyPremiere(release)
  }
  return created
}

async function checkSchedule() {
  if (!featureEnabled('discover')) return null
  const seeding = firstRun('shikimori')
  let created = 0
  for (const e of await shikimori.calendar()) {
    const airedAt = Date.parse(e.next_episode_at)
    const justAired = airedAt <= Date.now()
    const episode = justAired ? e.next_episode : e.next_episode - 1
    if (!Number.isInteger(episode) || episode <= 0) continue
    const releasedAt = justAired ? new Date(airedAt).toISOString() : now()
    const tracked = justAired || known('shikimori', e.anime.id, episode - 1, 'raw')
    created += record({ provider: 'shikimori', malId: e.anime.id, episode, kind: 'raw', translationId: 0, author: null, releasedAt }, !seeding && tracked)
  }
  return created
}

export interface ReleaseCheck {
  checkedAt: string
  error: string | null
}

const CHECKS_KEY = 'release_checks'
const LAST_RUN_KEY = 'release_last_run'

export function releaseChecks(): Partial<Record<ReleaseSource, ReleaseCheck>> {
  try {
    return JSON.parse(getSetting(CHECKS_KEY) ?? '{}') as Partial<Record<ReleaseSource, ReleaseCheck>>
  } catch {
    return {}
  }
}

export function lastReleaseRun(): string | null {
  return getSetting(LAST_RUN_KEY)
}

export async function checkReleases() {
  let created = 0
  const checks = releaseChecks()
  for (const [id, check] of [['anime365', checkAnime365], ['anilibria', checkAnilibria], ['kodik', checkKodik], ['shikimori', checkSchedule]] as const) {
    try {
      const count = await check()
      if (count === null) continue
      created += count
      checks[id] = { checkedAt: now(), error: null }
    } catch (error) {
      const message = (error as Error).message
      checks[id] = { checkedAt: now(), error: message }
      console.warn(`[releases] ${id} check failed:`, message)
    }
  }
  setSetting(CHECKS_KEY, JSON.stringify(checks))
  setSetting(LAST_RUN_KEY, now())
  return created
}

const CLEANUP_KEY = 'cleanup_at'
const CLEANUP_EVERY_MS = 86_400_000
const KEEP_READ_MS = 90 * 86_400_000
const KEEP_RELEASES_MS = 365 * 86_400_000

function cleanup() {
  const last = Date.parse(getSetting(CLEANUP_KEY) ?? '')
  if (Number.isFinite(last) && Date.now() - last < CLEANUP_EVERY_MS) return
  const readBefore = new Date(Date.now() - KEEP_READ_MS).toISOString()
  db.delete(notifications).where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, readBefore))).run()
  db.delete(socialNotifications).where(and(isNotNull(socialNotifications.readAt), lt(socialNotifications.createdAt, readBefore))).run()
  db.delete(providerReleases).where(lt(providerReleases.releasedAt, new Date(Date.now() - KEEP_RELEASES_MS).toISOString())).run()
  setSetting(CLEANUP_KEY, now())
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
    cleanup()
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
