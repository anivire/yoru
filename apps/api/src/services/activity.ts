import type { ActivityData } from '@yoru/shared'
import { and, eq, gte } from 'drizzle-orm'
import { db, now } from '../db/client'
import { activity } from '../db/schema'

const MAX_EPISODES_PER_SAVE = 30
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

export function activityData(userId: number, zone?: string): ActivityData {
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
