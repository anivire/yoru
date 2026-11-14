import type { ActivityData } from '@yoru/shared'
import { and, eq, gte } from 'drizzle-orm'
import { db, now } from '../db/client'
import { activity, listEntries } from '../db/schema'
import { getSetting, setSetting } from '../lib/settings'

const MAX_EPISODES_PER_SAVE = 30
const MAX_EPISODES_PER_ENTRY = 3000
const ACTIVE = new Set(['watching', 'rewatching', 'paused'])
const DAY = 86_400_000

export function logEpisodes(userId: number, malId: number, episodes: number[]) {
  if (!episodes.length) return
  const today = now().slice(0, 10)
  const existing = new Set(
    db
      .select({ episode: activity.episode, createdAt: activity.createdAt })
      .from(activity)
      .where(and(eq(activity.userId, userId), eq(activity.malId, malId), gte(activity.createdAt, today)))
      .all()
      .map((r) => r.episode),
  )
  const fresh = episodes.filter((e) => e > 0 && !existing.has(e)).slice(-MAX_EPISODES_PER_SAVE)
  if (!fresh.length) return
  const createdAt = now()
  db.insert(activity)
    .values(fresh.map((episode) => ({ userId, malId, episode, createdAt })))
    .run()
}

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function validZone(zone: string | undefined): string {
  if (!zone) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone })
    return zone
  } catch {
    return 'UTC'
  }
}

function dateOnly(value: string | null | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value.length === 10 ? `${value}T12:00:00.000Z` : value)
  return Number.isFinite(time) ? Date.UTC(new Date(time).getUTCFullYear(), new Date(time).getUTCMonth(), new Date(time).getUTCDate(), 12) : null
}

export function syncListActivity(userId: number): number {
  const entries = db.select().from(listEntries).where(eq(listEntries.userId, userId)).all()
  const watched = new Set(
    db
      .select({ malId: activity.malId, episode: activity.episode })
      .from(activity)
      .where(and(eq(activity.userId, userId), eq(activity.source, 'watch')))
      .all()
      .map((r) => `${r.malId}:${r.episode}`),
  )
  const today = dateOnly(now())!
  const rows: { userId: number; malId: number; episode: number; source: 'list'; createdAt: string }[] = []
  for (const entry of entries) {
    const episodes = Math.min(entry.progress, MAX_EPISODES_PER_ENTRY)
    if (episodes <= 0) continue
    const started = dateOnly(entry.startedAt)
    const completed = dateOnly(entry.completedAt)
    let from = started ?? completed
    let to = completed ?? (ACTIVE.has(entry.status) ? Math.min(dateOnly(entry.updatedAt) ?? today, today) : started)
    if (from === null || to === null) continue
    if (to < from) [from, to] = [to, from]
    const days = Math.round((to - from) / DAY) + 1
    for (let i = 0; i < episodes; i++) {
      const episode = i + 1
      if (watched.has(`${entry.malId}:${episode}`)) continue
      const offset = episodes === 1 ? days - 1 : Math.floor((i * days) / episodes)
      rows.push({ userId, malId: entry.malId, episode, source: 'list', createdAt: new Date(from + offset * DAY).toISOString() })
    }
  }
  db.transaction(() => {
    db.delete(activity).where(and(eq(activity.userId, userId), eq(activity.source, 'list'))).run()
    for (let i = 0; i < rows.length; i += 500) db.insert(activity).values(rows.slice(i, i + 500)).run()
  })
  setSetting(`activity.synced.${userId}`, now())
  return rows.length
}

export function activityData(userId: number, zone?: string): ActivityData {
  if (!getSetting(`activity.synced.${userId}`)) syncListActivity(userId)
  const timeZone = validZone(zone)
  const since = new Date(Date.now() - 372 * DAY).toISOString()
  const rows = db
    .select({ createdAt: activity.createdAt })
    .from(activity)
    .where(and(eq(activity.userId, userId), gte(activity.createdAt, since)))
    .all()
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = dayKey(new Date(row.createdAt), timeZone)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const today = new Date()
  let current = 0
  let longest = 0
  let run = 0
  for (let i = 371; i >= 0; i--) {
    const key = dayKey(new Date(today.getTime() - i * DAY), timeZone)
    run = counts.get(key) ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  for (let i = counts.get(dayKey(today, timeZone)) ? 0 : 1; ; i++) {
    if (!counts.get(dayKey(new Date(today.getTime() - i * DAY), timeZone))) break
    current++
  }
  return {
    days: [...counts.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    total: rows.length,
    currentStreak: current,
    longestStreak: longest,
    today: dayKey(today, timeZone),
  }
}
