import type { AnimeNote, FeedItem, FeedPage, ListStatus, NoteInput, UserCard } from '@yoru/shared'
import { and, asc, desc, eq, gte, inArray, lt, or } from 'drizzle-orm'
import { db, now } from '../db/client'
import { activity, anime, animeNotes, feedEvents, listEntries, users } from '../db/schema'
import { getSetting, setSetting } from '../lib/settings'
import { notFound } from '../lib/http'
import { toSummary } from './anime'
import { commentCounts, deleteTargetComments, eventTarget, reactionSummary } from './interactions'
import { cardColumns, friendIds, hiddenUserIds, toCard } from './social'

const EPISODE_MERGE_MS = 6 * 60 * 60_000
const MAX_PAGE = 300

type FeedType = (typeof feedEvents.$inferSelect)['type']

function record(userId: number, malId: number, type: FeedType, data: Record<string, unknown> = {}) {
  db.insert(feedEvents).values({ userId, malId, type, data, createdAt: now() }).run()
}

export interface EntryChange {
  before: { status: ListStatus; progress: number; score: number | null } | null
  after: { status: ListStatus; progress: number; score: number | null }
}

export function recordEntryChange(userId: number, malId: number, { before, after }: EntryChange) {
  if (!before) record(userId, malId, 'added', { status: after.status })
  else if (before.status !== after.status) record(userId, malId, 'status', { from: before.status, to: after.status })
  if (after.score !== null && after.score !== (before?.score ?? null)) record(userId, malId, 'score', { score: after.score })
  const from = (before?.progress ?? 0) + 1
  if (after.progress >= from) recordEpisodes(userId, malId, from, after.progress)
}

function recordEpisodes(userId: number, malId: number, from: number, to: number) {
  const since = new Date(Date.now() - EPISODE_MERGE_MS).toISOString()
  const last = db
    .select()
    .from(feedEvents)
    .where(and(eq(feedEvents.userId, userId), eq(feedEvents.malId, malId), eq(feedEvents.type, 'episodes'), gte(feedEvents.createdAt, since)))
    .orderBy(desc(feedEvents.id))
    .get()
  const range = last?.data as { from?: number; to?: number } | undefined
  if (last && range?.from !== undefined && range.to !== undefined && from <= range.to + 1 && to >= range.from) {
    db.update(feedEvents)
      .set({ data: { from: Math.min(range.from, from), to: Math.max(range.to, to) }, createdAt: now() })
      .where(eq(feedEvents.id, last.id))
      .run()
    return
  }
  record(userId, malId, 'episodes', { from, to })
}

type NoteRow = typeof animeNotes.$inferSelect

function toNote(row: NoteRow, user: UserCard, comments = 0): AnimeNote {
  return {
    id: row.id,
    malId: row.malId,
    episode: row.episode,
    text: row.text,
    private: row.private,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user,
    comments,
  }
}

function visibleTo(viewerId: number) {
  return or(eq(animeNotes.userId, viewerId), eq(animeNotes.private, false))
}

function noteWithUser(id: number): AnimeNote {
  const row = db.select({ note: animeNotes, user: cardColumns }).from(animeNotes).innerJoin(users, eq(users.id, animeNotes.userId)).where(eq(animeNotes.id, id)).get()
  if (!row) notFound('NOTE_NOT_FOUND')
  return toNote(row.note, toCard(row.user))
}

export function animeNotesFor(viewerId: number, malId: number): AnimeNote[] {
  const hidden = hiddenUserIds(viewerId)
  const rows = db
    .select({ note: animeNotes, user: cardColumns })
    .from(animeNotes)
    .innerJoin(users, eq(users.id, animeNotes.userId))
    .where(and(eq(animeNotes.malId, malId), visibleTo(viewerId)))
    .orderBy(desc(animeNotes.createdAt))
    .all()
    .filter((r) => !hidden.has(r.note.userId))
  const counts = commentCounts(rows.map((r) => ({ target: 'note' as const, id: r.note.id })))
  return rows.map((r) => toNote(r.note, toCard(r.user), counts.get(`note:${r.note.id}`) ?? 0))
}

export function createNote(userId: number, malId: number, input: NoteInput): AnimeNote {
  const at = now()
  const row = db
    .insert(animeNotes)
    .values({ userId, malId, episode: input.episode ?? null, text: input.text, private: input.private ?? true, createdAt: at, updatedAt: at })
    .returning()
    .get()
  record(userId, malId, 'note', { noteId: row.id })
  return noteWithUser(row.id)
}

function ownNote(userId: number, id: number, moderator = false): NoteRow {
  const row = db.select().from(animeNotes).where(eq(animeNotes.id, id)).get()
  if (!row || (row.userId !== userId && !moderator)) notFound('NOTE_NOT_FOUND')
  return row
}

export function updateNote(userId: number, id: number, input: NoteInput): AnimeNote {
  ownNote(userId, id)
  db.update(animeNotes)
    .set({ text: input.text, ...(input.episode !== undefined ? { episode: input.episode } : {}), ...(input.private !== undefined ? { private: input.private } : {}), updatedAt: now() })
    .where(eq(animeNotes.id, id))
    .run()
  return noteWithUser(id)
}

export function deleteNote(userId: number, id: number, moderator = false) {
  const row = ownNote(userId, id, moderator)
  db.delete(animeNotes).where(eq(animeNotes.id, id)).run()
  deleteTargetComments('note', [id])
  const events = db.select({ id: feedEvents.id, data: feedEvents.data }).from(feedEvents).where(and(eq(feedEvents.userId, row.userId), eq(feedEvents.malId, row.malId), eq(feedEvents.type, 'note'))).all()
  const stale = events.filter((e) => (e.data as { noteId?: number }).noteId === id).map((e) => e.id)
  if (stale.length) db.delete(feedEvents).where(inArray(feedEvents.id, stale)).run()
}

function parseCursor(value: string | null) {
  if (!value) return null
  const split = value.lastIndexOf('|')
  const id = Number(value.slice(split + 1))
  const createdAt = value.slice(0, split)
  return split > 0 && Number.isInteger(id) && createdAt ? { createdAt, id } : null
}

export type FeedScope = 'me' | 'friends' | { userId: number }

function feedAuthors(viewerId: number, scope: FeedScope): number[] {
  if (scope === 'me') return [viewerId]
  const hidden = hiddenUserIds(viewerId)
  const candidates = scope === 'friends' ? friendIds(viewerId) : [scope.userId]
  if (!candidates.length) return []
  const sharing = new Set(db.select({ id: users.id }).from(users).where(and(inArray(users.id, candidates), eq(users.shareActivity, true))).all().map((r) => r.id))
  return candidates.filter((id) => id === viewerId || (sharing.has(id) && !hidden.has(id)))
}

export function feedPage(viewerId: number, options: { before: string | null; limit: number; scope?: FeedScope }): FeedPage {
  const limit = Math.min(MAX_PAGE, Math.max(1, options.limit))
  const cursor = parseCursor(options.before)
  const authors = feedAuthors(viewerId, options.scope ?? 'me')
  if (!authors.length) return { items: [], nextBefore: null }
  const conditions = [
    inArray(feedEvents.userId, authors),
    cursor ? or(lt(feedEvents.createdAt, cursor.createdAt), and(eq(feedEvents.createdAt, cursor.createdAt), lt(feedEvents.id, cursor.id))) : undefined,
  ].filter((c) => c !== undefined)
  const rows = db
    .select({ event: feedEvents, user: cardColumns, anime })
    .from(feedEvents)
    .innerJoin(users, eq(users.id, feedEvents.userId))
    .innerJoin(anime, eq(anime.malId, feedEvents.malId))
    .where(and(...conditions))
    .orderBy(desc(feedEvents.createdAt), desc(feedEvents.id))
    .limit(limit + 1)
    .all()
  const page = rows.slice(0, limit)
  const noteIds = page.filter((r) => r.event.type === 'note').map((r) => (r.event.data as { noteId?: number }).noteId).filter((id): id is number => typeof id === 'number')
  const notes = new Map(
    noteIds.length
      ? db
          .select()
          .from(animeNotes)
          .where(and(inArray(animeNotes.id, noteIds), visibleTo(viewerId)))
          .all()
          .map((n) => [n.id, n])
      : [],
  )
  const reactionsByEvent = reactionSummary(viewerId, page.map((r) => r.event.id))
  const counts = commentCounts(page.map((r) => eventTarget(r.event)))
  const items: FeedItem[] = []
  for (const { event, user: userRow, anime: row } of page) {
    const user = toCard(userRow)
    const target = eventTarget(event)
    const reacted = reactionsByEvent.get(event.id)
    const base = {
      id: event.id,
      createdAt: event.createdAt,
      user,
      anime: toSummary(row),
      reactions: reacted?.reactions ?? [],
      myReaction: reacted?.mine ?? null,
      comments: counts.get(`${target.target}:${target.id}`) ?? 0,
    }
    const data = event.data as Record<string, unknown>
    if (event.type === 'added') items.push({ ...base, type: 'added', status: data.status as ListStatus })
    else if (event.type === 'status') items.push({ ...base, type: 'status', from: data.from as ListStatus, to: data.to as ListStatus })
    else if (event.type === 'score') items.push({ ...base, type: 'score', score: Number(data.score) })
    else if (event.type === 'episodes') items.push({ ...base, type: 'episodes', from: Number(data.from), to: Number(data.to) })
    else {
      const note = notes.get(Number(data.noteId))
      if (note) items.push({ ...base, type: 'note', note: toNote(note, user, base.comments) })
    }
  }
  const last = page[page.length - 1]?.event
  return { items, nextBefore: rows.length > limit && last ? `${last.createdAt}|${last.id}` : null }
}

const BACKFILL_KEY = 'feed.backfill.v1'

type NewEvent = typeof feedEvents.$inferInsert

function dayTime(value: string | null): string | null {
  if (!value) return null
  const time = Date.parse(value.length === 10 ? `${value}T12:00:00.000Z` : value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function historicalEvents(userId: number): NewEvent[] {
  const events: NewEvent[] = []
  const push = (malId: number, type: NewEvent['type'], createdAt: string | null, data: Record<string, unknown>) => {
    if (createdAt) events.push({ userId, malId, type, data, createdAt })
  }
  for (const entry of db.select().from(listEntries).where(eq(listEntries.userId, userId)).all()) {
    const started = dayTime(entry.startedAt)
    const completed = dayTime(entry.completedAt)
    const created = dayTime(entry.createdAt)
    const updated = dayTime(entry.updatedAt)
    if (entry.status === 'planning') {
      push(entry.malId, 'added', created, { status: 'planning' })
      continue
    }
    const addedAt = [started, completed, created].filter((v): v is string => Boolean(v)).sort()[0] ?? null
    push(entry.malId, 'added', addedAt, { status: completed && !started ? 'completed' : 'watching' })
    if (completed && started) push(entry.malId, 'status', completed, { from: 'watching', to: 'completed' })
    if (entry.status === 'dropped' || entry.status === 'paused' || entry.status === 'rewatching') push(entry.malId, 'status', updated, { from: completed ? 'completed' : 'watching', to: entry.status })
    if (entry.score) push(entry.malId, 'score', completed ?? updated, { score: entry.score })
  }
  const watched = db
    .select({ malId: activity.malId, episode: activity.episode, createdAt: activity.createdAt })
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.source, 'watch')))
    .orderBy(asc(activity.createdAt))
    .all()
  const open = new Map<number, { from: number; to: number; at: string; startedAt: number }>()
  const flush = (malId: number) => {
    const run = open.get(malId)
    if (run) push(malId, 'episodes', run.at, { from: run.from, to: run.to })
    open.delete(malId)
  }
  for (const row of watched) {
    const time = Date.parse(row.createdAt)
    const run = open.get(row.malId)
    if (run && time - run.startedAt <= EPISODE_MERGE_MS && row.episode >= run.from - 1 && row.episode <= run.to + 1) {
      run.from = Math.min(run.from, row.episode)
      run.to = Math.max(run.to, row.episode)
      run.at = row.createdAt
      continue
    }
    flush(row.malId)
    open.set(row.malId, { from: row.episode, to: row.episode, at: row.createdAt, startedAt: time })
  }
  for (const malId of [...open.keys()]) flush(malId)
  return events
}

export function backfillFeed(userId: number): number {
  const first = db.select({ createdAt: feedEvents.createdAt }).from(feedEvents).where(eq(feedEvents.userId, userId)).orderBy(asc(feedEvents.createdAt)).get()
  const known = new Set(db.select({ malId: anime.malId }).from(anime).all().map((r) => r.malId))
  const events = historicalEvents(userId).filter((e) => known.has(e.malId) && (!first || e.createdAt < first.createdAt))
  events.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (let i = 0; i < events.length; i += 500) db.insert(feedEvents).values(events.slice(i, i + 500)).run()
  return events.length
}

export function backfillAllFeeds() {
  if (getSetting(BACKFILL_KEY)) return
  let total = 0
  for (const { id } of db.select({ id: users.id }).from(users).all()) total += backfillFeed(id)
  setSetting(BACKFILL_KEY, now())
  if (total) console.log(`[yoru] feed backfilled with ${total} past events`)
}
