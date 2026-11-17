import { and, eq, sql } from 'drizzle-orm'
import {
  LIST_STATUSES,
  type ListCounts,
  type ListEntry,
  type ListEntryInput,
  type ListEntryWithAnime,
  type ListStatus,
} from '@yoru/shared'
import { db, now } from '../db/client'
import { anime, listEntries } from '../db/schema'
import { toSummary } from './anime'
import { logEpisodes } from './activity'
import { airedEpisode } from './aired'
import { recordEntryChange } from './feed'

type EntryRow = typeof listEntries.$inferSelect

export function toEntry(row: EntryRow): ListEntry {
  return {
    malId: row.malId,
    status: row.status,
    progress: row.progress,
    score: row.score,
    rewatches: row.rewatches,
    notes: row.notes,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
  }
}

export function getEntry(userId: number, malId: number): EntryRow | undefined {
  return db
    .select()
    .from(listEntries)
    .where(and(eq(listEntries.userId, userId), eq(listEntries.malId, malId)))
    .get()
}

export function allEntries(userId: number, status?: ListStatus): ListEntryWithAnime[] {
  return db
    .select({ entry: listEntries, anime })
    .from(listEntries)
    .innerJoin(anime, eq(anime.malId, listEntries.malId))
    .where(status ? and(eq(listEntries.userId, userId), eq(listEntries.status, status)) : eq(listEntries.userId, userId))
    .all()
    .map(({ entry, anime: a }) => ({ ...toEntry(entry), anime: toSummary(a), latestEpisode: airedEpisode(a.malId, a.latestEpisode) }))
}

export function listFacets(userId: number): { years: number[]; types: string[] } {
  const rows = db
    .selectDistinct({ year: anime.year, type: anime.type })
    .from(listEntries)
    .innerJoin(anime, eq(anime.malId, listEntries.malId))
    .where(eq(listEntries.userId, userId))
    .all()
  return {
    years: [...new Set(rows.map((r) => r.year).filter((y): y is number => Boolean(y)))].sort((a, b) => b - a),
    types: [...new Set(rows.map((r) => r.type).filter((v): v is string => Boolean(v)))],
  }
}

export function listCounts(userId: number): ListCounts {
  const rows = db
    .select({ status: listEntries.status, count: sql<number>`count(*)` })
    .from(listEntries)
    .where(eq(listEntries.userId, userId))
    .groupBy(listEntries.status)
    .all()
  const byStatus = Object.fromEntries(LIST_STATUSES.map((s) => [s, 0])) as Record<ListStatus, number>
  let all = 0
  for (const r of rows) {
    byStatus[r.status] = r.count
    all += r.count
  }
  return { all, byStatus }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function saveEntry(userId: number, malId: number, input: ListEntryInput, total: number | null, aired: number | null = null): ListEntry {
  const existing = getEntry(userId, malId)
  let progress = input.progress ?? existing?.progress ?? 0
  if (total && progress > total) progress = total
  if (aired !== null && progress > aired) progress = Math.max(aired, existing?.progress ?? 0)
  let status = input.status
  if (input.progress !== undefined && total && progress >= total && (status === 'watching' || status === 'rewatching')) {
    status = 'completed'
  }
  if (status === 'completed' && total && input.progress === undefined) progress = total
  const startedAt =
    input.startedAt !== undefined ? input.startedAt : existing?.startedAt ?? (status === 'watching' ? today() : null)
  const completedAt =
    input.completedAt !== undefined
      ? input.completedAt
      : status === 'completed'
        ? existing?.completedAt ?? today()
        : existing?.completedAt ?? null
  const rewatches =
    input.rewatches ?? (existing && existing.status === 'rewatching' && status === 'completed' ? existing.rewatches + 1 : existing?.rewatches ?? 0)
  if (input.progress !== undefined && progress > (existing?.progress ?? 0)) {
    const from = (existing?.progress ?? 0) + 1
    logEpisodes(userId, malId, Array.from({ length: progress - from + 1 }, (_, i) => from + i))
  }
  const values = {
    userId,
    malId,
    status,
    progress,
    score: input.score !== undefined ? input.score : existing?.score ?? null,
    rewatches,
    notes: input.notes !== undefined ? input.notes : existing?.notes ?? null,
    startedAt,
    completedAt,
    updatedAt: now(),
  }
  db.insert(listEntries)
    .values({ ...values, createdAt: now() })
    .onConflictDoUpdate({ target: [listEntries.userId, listEntries.malId], set: values })
    .run()
  recordEntryChange(userId, malId, {
    before: existing ? { status: existing.status, progress: existing.progress, score: existing.score } : null,
    after: { status: values.status, progress: values.progress, score: values.score },
  })
  return toEntry(getEntry(userId, malId)!)
}

export function deleteEntry(userId: number, malId: number) {
  db.delete(listEntries).where(and(eq(listEntries.userId, userId), eq(listEntries.malId, malId))).run()
}

export function markWatched(userId: number, malId: number, episode: number, total: number | null) {
  const entry = getEntry(userId, malId)
  if (entry && entry.progress >= episode && entry.status !== 'planning') return
  const status: ListStatus = entry?.status === 'rewatching' ? 'rewatching' : 'watching'
  saveEntry(userId, malId, { status, progress: Math.max(episode, entry?.progress ?? 0) }, total)
}

export interface ListFilters {
  status?: ListStatus
  q?: string
  type?: string
  genre?: string
  year?: number
  sort?: ListSort
  order?: 'asc' | 'desc'
}

type ListSort = 'updated' | 'title' | 'score' | 'progress' | 'year' | 'added'

const SORT_KEYS: Record<ListSort, (e: ListEntryWithAnime) => string | number | null> = {
  updated: (e) => e.updatedAt,
  added: (e) => e.startedAt,
  title: (e) => e.anime.title,
  score: (e) => e.score,
  progress: (e) => e.progress,
  year: (e) => e.anime.year,
}

export function naturalOrder(sort: ListSort): 'asc' | 'desc' {
  return sort === 'title' ? 'asc' : 'desc'
}

export function filterEntries(items: ListEntryWithAnime[], f: ListFilters): ListEntryWithAnime[] {
  const q = f.q?.trim().toLowerCase()
  const result = items.filter((e) => {
    if (f.status && e.status !== f.status) return false
    if (f.type && e.anime.type !== f.type) return false
    if (f.year && e.anime.year !== f.year) return false
    if (f.genre && !e.anime.genres.includes(f.genre)) return false
    if (q) {
      const hay = [e.anime.title, e.anime.titleEnglish, e.anime.titleJapanese, e.anime.titleRussian].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const by = f.sort ?? 'score'
  const key = SORT_KEYS[by]
  const dir = (f.order ?? naturalOrder(by)) === 'asc' ? 1 : -1
  return result.sort((a, b) => {
    const x = key(a)
    const y = key(b)
    if (x === null || y === null) return x === y ? b.updatedAt.localeCompare(a.updatedAt) : x === null ? 1 : -1
    const diff = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)
    return diff * dir || b.updatedAt.localeCompare(a.updatedAt)
  })
}
