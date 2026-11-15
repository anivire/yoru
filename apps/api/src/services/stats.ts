import { LIST_STATUSES, type ListStatus, type StatsBucket, type UserStats } from '@yoru/shared'
import { and, eq, gte } from 'drizzle-orm'
import { db } from '../db/client'
import { activity, anime, listEntries } from '../db/schema'

const TOP = 10
const SEASONS = ['winter', 'spring', 'summer', 'fall']
const MONTHS = 12
const TYPE_MINUTES: Record<string, number> = { tv: 24, movie: 100, ova: 30, ona: 15, special: 12, tv_special: 45, music: 4, cm: 1, pv: 2 }

export function episodeMinutes(duration: string | null, type: string | null): number {
  if (duration) {
    const hours = /(\d+)\s*h/i.exec(duration)
    const minutes = /(\d+)\s*min/i.exec(duration)
    const seconds = /(\d+)\s*sec/i.exec(duration)
    const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0) + (seconds ? Number(seconds[1]) / 60 : 0)
    if (total > 0) return total
  }
  return TYPE_MINUTES[type?.toLowerCase() ?? ''] ?? 24
}

function mean(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null
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

function monthKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(date).slice(0, 7)
}

interface Tally {
  count: number
  minutes: number
  scores: number[]
}

function tally(map: Map<string, Tally>, name: string, minutes: number, score: number | null) {
  const item = map.get(name) ?? { count: 0, minutes: 0, scores: [] }
  item.count++
  item.minutes += minutes
  if (score) item.scores.push(score)
  map.set(name, item)
}

function buckets(map: Map<string, Tally>, limit = TOP): StatsBucket[] {
  return [...map.entries()]
    .map(([name, t]) => ({ name, count: t.count, minutes: Math.round(t.minutes), meanScore: mean(t.scores) }))
    .sort((a, b) => b.count - a.count || b.minutes - a.minutes || a.name.localeCompare(b.name))
    .slice(0, limit)
}

function recentMonths(userId: number, zone: string): UserStats['months'] {
  const timeZone = validZone(zone)
  const nowDate = new Date()
  const keys: string[] = []
  for (let i = MONTHS - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - i, 15)), timeZone))
  }
  const since = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - MONTHS, 1)).toISOString()
  const counts = new Map(keys.map((k) => [k, 0]))
  const rows = db
    .select({ createdAt: activity.createdAt })
    .from(activity)
    .where(and(eq(activity.userId, userId), gte(activity.createdAt, since)))
    .all()
  for (const row of rows) {
    const key = monthKey(new Date(row.createdAt), timeZone)
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1)
  }
  return keys.map((month) => ({ month, episodes: counts.get(month) ?? 0 }))
}

export function userStats(userId: number, zone?: string): UserStats {
  const rows = db
    .select({ entry: listEntries, anime })
    .from(listEntries)
    .innerJoin(anime, eq(anime.malId, listEntries.malId))
    .where(eq(listEntries.userId, userId))
    .all()

  const statuses = Object.fromEntries(LIST_STATUSES.map((s) => [s, 0])) as Record<ListStatus, number>
  const scoreCounts = new Map<number, number>()
  const genres = new Map<string, Tally>()
  const studios = new Map<string, Tally>()
  const types = new Map<string, Tally>()
  const years = new Map<number, number>()
  const seasons = new Map<string, number>(SEASONS.map((s) => [s, 0]))
  const allScores: number[] = []
  let titles = 0
  let episodes = 0
  let minutes = 0
  let rewatches = 0

  for (const { entry, anime: a } of rows) {
    statuses[entry.status]++
    if (entry.status === 'planning') continue
    titles++
    const total = a.episodes ?? entry.progress
    const watched = (entry.status === 'completed' ? Math.max(entry.progress, total) : entry.progress) + entry.rewatches * total
    const watchedMinutes = watched * episodeMinutes(a.duration, a.type)
    episodes += watched
    minutes += watchedMinutes
    rewatches += entry.rewatches
    const score = entry.score ? Math.round(entry.score) : null
    if (score) {
      allScores.push(entry.score!)
      scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1)
    }
    for (const g of a.genres) tally(genres, g, watchedMinutes, entry.score)
    for (const s of a.studios) tally(studios, s, watchedMinutes, entry.score)
    if (a.type) tally(types, a.type, watchedMinutes, entry.score)
    if (a.year) years.set(a.year, (years.get(a.year) ?? 0) + 1)
    if (a.season && seasons.has(a.season)) seasons.set(a.season, seasons.get(a.season)! + 1)
  }

  const yearList = [...years.keys()].sort((a, b) => a - b)
  const yearRange = yearList.length ? Array.from({ length: yearList.at(-1)! - yearList[0]! + 1 }, (_, i) => yearList[0]! + i) : []

  return {
    totals: {
      titles,
      completed: statuses.completed,
      episodes,
      minutes: Math.round(minutes),
      meanScore: mean(allScores),
      scored: allScores.length,
      rewatches,
    },
    statuses,
    scores: Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: scoreCounts.get(i + 1) ?? 0 })),
    genres: buckets(genres),
    studios: buckets(studios),
    types: buckets(types, 8),
    years: yearRange.map((year) => ({ year, count: years.get(year) ?? 0 })),
    seasons: SEASONS.map((season) => ({ season, count: seasons.get(season) ?? 0 })),
    months: recentMonths(userId, zone ?? 'UTC'),
  }
}
