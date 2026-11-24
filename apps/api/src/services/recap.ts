import type { RecapData, RecapTitle } from '@yoru/shared'
import { and, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { activity, anime, animeNotes, comments, feedEvents, listEntries, providerReleases, reactions, recommendations } from '../db/schema'
import { type AnimeRow, toSummary } from './anime'
import { cardsFor, friendIds } from './social'
import { episodeMinutes, validZone } from './stats'

const MIN_EPISODES = 10
const TOP = 5
const GENRES = 5
const FRIENDS = 3
const MIN_COMMON = 3
const MIN_SCORED = 3
const FIND_GAP = 1
const DAY = 86_400_000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const READY_DAY = 28

export function recapReady(year: number, date = new Date()): boolean {
  const current = date.getUTCFullYear()
  return year < current || (year === current && date.getUTCMonth() === 11 && date.getUTCDate() >= READY_DAY)
}

function activityYears(userId: number): number[] {
  const year = sql<string>`substr(${activity.createdAt}, 1, 4)`
  return db
    .select({ year, count: sql<number>`count(*)` })
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.source, 'watch')))
    .groupBy(year)
    .all()
    .filter((r) => r.count >= MIN_EPISODES)
    .map((r) => Number(r.year))
    .sort((a, b) => b - a)
}

function longestStreak(days: string[]): { days: number; end: string } | null {
  let best: { days: number; end: string } | null = null
  let run = 0
  let previous = 0
  for (const day of [...days].sort()) {
    const time = Date.parse(`${day}T00:00:00Z`)
    run = time - previous === DAY ? run + 1 : 1
    previous = time
    if (!best || run > best.days) best = { days: run, end: day }
  }
  return best
}

function topKey<K>(counts: Map<K, number>): [K, number] | null {
  let best: [K, number] | null = null
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry
  return best
}

function yearEvents(userId: number, year: number, format: Intl.DateTimeFormat) {
  return db
    .select({ malId: activity.malId, episode: activity.episode, createdAt: activity.createdAt })
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.source, 'watch'), gte(activity.createdAt, `${year - 1}-12-30`), lt(activity.createdAt, `${year + 1}-01-02`)))
    .orderBy(activity.createdAt)
    .all()
    .map((row) => {
      const p = Object.fromEntries(format.formatToParts(new Date(row.createdAt)).map((part) => [part.type, part.value]))
      return { ...row, year: Number(p.year), month: Number(p.month), date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: WEEKDAYS.indexOf(p.weekday ?? '') }
    })
    .filter((e) => e.year === year)
}

function animeRows(ids: number[]): Map<number, AnimeRow> {
  return new Map(ids.length ? db.select().from(anime).where(inArray(anime.malId, ids)).all().map((a) => [a.malId, a]) : [])
}

function tally(events: { malId: number }[], rows: Map<number, AnimeRow>) {
  let minutes = 0
  const genres = new Map<string, number>()
  for (const e of events) {
    const a = rows.get(e.malId)
    minutes += episodeMinutes(a?.duration ?? null, a?.type ?? null)
    for (const g of a?.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + 1)
  }
  return { minutes, genres }
}

export function recap(userId: number, viewerId: number, requested: number | null, zone?: string): RecapData | null {
  const all = activityYears(userId)
  const ready = all.filter((y) => recapReady(y))
  const year = requested ?? ready[0]
  const years = viewerId === userId ? all : ready
  if (!year || !years.includes(year)) return null

  const timeZone = validZone(zone)
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' })
  const events = yearEvents(userId, year, format)
  const ids = [...new Set(events.map((e) => e.malId))]
  const rows = animeRows(ids)
  const { minutes, genres } = tally(events, rows)
  const months = Array<number>(12).fill(0)
  const perTitle = new Map<number, number>()
  const perDay = new Map<string, number>()
  const weekdays = new Map<number, number>()
  const hours = Array<number>(24).fill(0)
  for (const e of events) {
    months[e.month - 1]!++
    perTitle.set(e.malId, (perTitle.get(e.malId) ?? 0) + 1)
    perDay.set(e.date, (perDay.get(e.date) ?? 0) + 1)
    weekdays.set(e.weekday, (weekdays.get(e.weekday) ?? 0) + 1)
    hours[e.hour]!++
  }

  const entries = new Map(ids.length ? db.select().from(listEntries).where(and(eq(listEntries.userId, userId), inArray(listEntries.malId, ids))).all().map((e) => [e.malId, e]) : [])
  const top: RecapTitle[] = ids
    .filter((id) => rows.has(id))
    .map((id) => ({ anime: toSummary(rows.get(id)!), score: entries.get(id)?.score ?? null, episodes: perTitle.get(id) ?? 0 }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.episodes - a.episodes)
    .slice(0, TOP)

  const completed = [...entries.values()].filter((e) => e.status !== 'planning' && e.completedAt?.startsWith(String(year))).length
  const share = (from: number, to: number) => hours.slice(from, to).reduce((a, b) => a + b, 0) / events.length
  const marathon = topKey(perDay)
  const topGenre = (counts: Map<string, number>) => topKey(counts)?.[0] ?? null

  const before = yearEvents(userId, year - 1, format)
  const previous = before.length >= MIN_EPISODES ? { ...tally(before, animeRows([...new Set(before.map((e) => e.malId))])), episodes: before.length } : null

  const first = events[0]
  const last = events.at(-1)

  return {
    year,
    years,
    inProgress: year === Number(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(new Date())),
    episodes: events.length,
    minutes: Math.round(minutes),
    titles: ids.length,
    completed,
    months,
    top,
    genres: [...genres.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, GENRES)
      .map(([name, count]) => ({ name, share: count / events.length })),
    habits: {
      nightShare: share(22, 24) + share(0, 5),
      morningShare: share(5, 12),
      peakHour: hours.indexOf(Math.max(...hours)),
      weekday: topKey(weekdays)?.[0] ?? null,
      marathon: marathon && marathon[1] > 1 ? { episodes: marathon[1], date: marathon[0] } : null,
      streak: longestStreak([...perDay.keys()]),
    },
    friends: viewerId === userId ? recapFriends(userId, ids, entries) : [],
    previous: previous ? { year: year - 1, episodes: previous.episodes, minutes: Math.round(previous.minutes), genre: topGenre(previous.genres) } : null,
    bookends: first && last && rows.has(first.malId) && rows.has(last.malId) ? { first: { anime: toSummary(rows.get(first.malId)!), date: first.date }, last: { anime: toSummary(rows.get(last.malId)!), date: last.date } } : null,
    critic: recapCritic(ids, rows, entries),
    eras: recapEras(ids, rows, year),
    fresh: recapFresh(events, rows),
    community: recapCommunity(userId, viewerId, year),
  }
}

function recapCritic(ids: number[], rows: Map<number, AnimeRow>, entries: Map<number, { score: number | null }>): RecapData['critic'] {
  const scored = ids.flatMap((id) => {
    const mine = entries.get(id)?.score
    const community = rows.get(id)?.score
    return mine && community ? [{ id, mine, community }] : []
  })
  if (scored.length < MIN_SCORED) return null
  const diff = scored.reduce((sum, s) => sum + s.mine - s.community, 0) / scored.length
  const best = scored.reduce((a, b) => (b.mine - b.community > a.mine - a.community ? b : a))
  return {
    diff: Math.round(diff * 10) / 10,
    count: scored.length,
    find: best.mine - best.community >= FIND_GAP ? { anime: toSummary(rows.get(best.id)!), score: best.mine, community: best.community } : null,
  }
}

function recapEras(ids: number[], rows: Map<number, AnimeRow>, year: number): RecapData['eras'] {
  const dated = ids.flatMap((id) => {
    const row = rows.get(id)
    return row?.year ? [row] : []
  })
  if (!dated.length) return null
  const oldest = dated.reduce((a, b) => (b.year! < a.year! ? b : a))
  return {
    oldest: { anime: toSummary(oldest) },
    averageYear: Math.round(dated.reduce((sum, row) => sum + row.year!, 0) / dated.length),
    freshShare: dated.filter((row) => row.year! >= year - 1).length / dated.length,
  }
}

function recapFresh(events: { malId: number; episode: number; createdAt: string }[], rows: Map<number, AnimeRow>): RecapData['fresh'] {
  const ids = [...new Set(events.map((e) => e.malId))]
  if (!ids.length) return null
  const released = new Map<string, number>()
  for (const r of db.select({ malId: providerReleases.malId, episode: providerReleases.episode, releasedAt: providerReleases.releasedAt }).from(providerReleases).where(inArray(providerReleases.malId, ids)).all()) {
    const key = `${r.malId}:${r.episode}`
    const at = Date.parse(r.releasedAt)
    if (Number.isFinite(at) && at < (released.get(key) ?? Infinity)) released.set(key, at)
  }
  let episodes = 0
  let fastest: { malId: number; episode: number; delay: number } | null = null
  for (const e of events) {
    const at = released.get(`${e.malId}:${e.episode}`)
    const delay = at === undefined ? -1 : Date.parse(e.createdAt) - at
    if (delay < 0 || delay > DAY) continue
    episodes++
    if (!fastest || delay < fastest.delay) fastest = { malId: e.malId, episode: e.episode, delay }
  }
  if (!episodes || !fastest || !rows.has(fastest.malId)) return null
  return { episodes, fastest: { anime: toSummary(rows.get(fastest.malId)!), episode: fastest.episode, minutes: Math.max(1, Math.round(fastest.delay / 60_000)) } }
}

function recapCommunity(userId: number, viewerId: number, year: number): RecapData['community'] {
  const from = `${year}-01-01`
  const to = `${year + 1}-01-01`
  const count = (query: { get: () => { count: number } | undefined }) => query.get()?.count ?? 0
  const result = {
    comments: count(db.select({ count: sql<number>`count(*)` }).from(comments).where(and(eq(comments.userId, userId), gte(comments.createdAt, from), lt(comments.createdAt, to)))),
    notes: count(
      db
        .select({ count: sql<number>`count(*)` })
        .from(animeNotes)
        .where(and(eq(animeNotes.userId, userId), gte(animeNotes.createdAt, from), lt(animeNotes.createdAt, to), viewerId === userId ? undefined : eq(animeNotes.private, false))),
    ),
    reactions: count(
      db
        .select({ count: sql<number>`count(*)` })
        .from(reactions)
        .innerJoin(feedEvents, eq(feedEvents.id, reactions.eventId))
        .where(and(eq(feedEvents.userId, userId), ne(reactions.userId, userId), gte(reactions.createdAt, from), lt(reactions.createdAt, to))),
    ),
    recommendations: count(db.select({ count: sql<number>`count(*)` }).from(recommendations).where(and(eq(recommendations.userId, userId), gte(recommendations.createdAt, from), lt(recommendations.createdAt, to)))),
  }
  return Object.values(result).some(Boolean) ? result : null
}

function recapFriends(userId: number, ids: number[], own: Map<number, { score: number | null }>): RecapData['friends'] {
  const friends = friendIds(userId)
  if (!friends.length || !ids.length) return []
  const rows = db
    .select({ userId: listEntries.userId, malId: listEntries.malId, score: listEntries.score })
    .from(listEntries)
    .where(and(inArray(listEntries.userId, friends), inArray(listEntries.malId, ids), ne(listEntries.status, 'planning')))
    .all()
  const byFriend = new Map<number, { common: number; diffs: number[] }>()
  for (const row of rows) {
    const item = byFriend.get(row.userId) ?? { common: 0, diffs: [] }
    item.common++
    const mine = own.get(row.malId)?.score
    if (mine && row.score) item.diffs.push(Math.abs(mine - row.score))
    byFriend.set(row.userId, item)
  }
  const ranked = [...byFriend.entries()]
    .filter(([, f]) => f.common >= MIN_COMMON)
    .map(([id, f]) => ({ id, common: f.common, match: f.diffs.length >= MIN_COMMON ? Math.max(0, Math.round(100 - (f.diffs.reduce((a, b) => a + b, 0) / f.diffs.length) * 10)) : null }))
    .sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || b.common - a.common)
    .slice(0, FRIENDS)
  const cards = cardsFor(ranked.map((f) => f.id))
  return ranked.flatMap((f) => {
    const user = cards.get(f.id)
    return user ? [{ user, match: f.match, common: f.common }] : []
  })
}
