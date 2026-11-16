import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Comment, CommentTarget, FriendEntry, FriendTitles, FriendWatching, Reaction, ReactionCount, TasteMatch } from '@yoru/shared'
import { db, now } from '../db/client'
import { anime, animeNotes, comments, feedEvents, listEntries, reactions, recommendations, users } from '../db/schema'
import { notFound } from '../lib/http'
import { toSummary } from './anime'
import { blockedBetween, cardColumns, friendIds, hiddenUserIds, notify, toCard } from './social'

type EventRow = typeof feedEvents.$inferSelect
type NoteRow = typeof animeNotes.$inferSelect

interface Viewer {
  id: number
  role: 'admin' | 'user'
}

export function eventTarget(event: Pick<EventRow, 'id' | 'type' | 'data'>): { target: CommentTarget; id: number } {
  const noteId = (event.data as { noteId?: number }).noteId
  return event.type === 'note' && typeof noteId === 'number' ? { target: 'note', id: noteId } : { target: 'event', id: event.id }
}

function canSeeEvent(viewerId: number, event: EventRow) {
  if (event.userId === viewerId) return true
  if (blockedBetween(viewerId, event.userId) || !friendIds(viewerId).includes(event.userId)) return false
  return Boolean(db.select({ id: users.id }).from(users).where(and(eq(users.id, event.userId), eq(users.shareActivity, true))).get())
}

function canSeeNote(viewerId: number, note: NoteRow) {
  return note.userId === viewerId || (!note.private && !blockedBetween(viewerId, note.userId))
}

function visibleEvent(viewerId: number, id: number): EventRow {
  const event = db.select().from(feedEvents).where(eq(feedEvents.id, id)).get()
  if (!event || !canSeeEvent(viewerId, event)) notFound('EVENT_NOT_FOUND')
  return event
}

function targetOwner(viewerId: number, target: CommentTarget, id: number): { ownerId: number; malId: number } {
  if (target === 'event') {
    const event = visibleEvent(viewerId, id)
    return { ownerId: event.userId, malId: event.malId }
  }
  const note = db.select().from(animeNotes).where(eq(animeNotes.id, id)).get()
  if (!note || !canSeeNote(viewerId, note)) notFound('NOTE_NOT_FOUND')
  return { ownerId: note.userId, malId: note.malId }
}

export function reactionSummary(viewerId: number, eventIds: number[]) {
  const summary = new Map<number, { reactions: ReactionCount[]; mine: Reaction | null }>()
  if (!eventIds.length) return summary
  const hidden = hiddenUserIds(viewerId)
  const rows = db.select().from(reactions).where(inArray(reactions.eventId, eventIds)).orderBy(asc(reactions.createdAt)).all()
  for (const row of rows) {
    if (hidden.has(row.userId)) continue
    const entry = summary.get(row.eventId) ?? { reactions: [], mine: null }
    const emoji = row.emoji as Reaction
    const count = entry.reactions.find((r) => r.emoji === emoji)
    if (count) count.count++
    else entry.reactions.push({ emoji, count: 1 })
    if (row.userId === viewerId) entry.mine = emoji
    summary.set(row.eventId, entry)
  }
  return summary
}

export function commentCounts(targets: { target: CommentTarget; id: number }[]) {
  const counts = new Map<string, number>()
  for (const target of ['event', 'note'] as const) {
    const ids = targets.filter((t) => t.target === target).map((t) => t.id)
    if (!ids.length) continue
    const rows = db
      .select({ id: comments.targetId, count: sql<number>`count(*)` })
      .from(comments)
      .where(and(eq(comments.targetType, target), inArray(comments.targetId, ids)))
      .groupBy(comments.targetId)
      .all()
    for (const row of rows) counts.set(`${target}:${row.id}`, row.count)
  }
  return counts
}

export function setReaction(viewerId: number, eventId: number, emoji: Reaction | null) {
  const event = visibleEvent(viewerId, eventId)
  const existing = db.select().from(reactions).where(and(eq(reactions.userId, viewerId), eq(reactions.eventId, eventId))).get()
  if (!emoji) {
    if (existing) db.delete(reactions).where(eq(reactions.id, existing.id)).run()
    return
  }
  if (existing) db.update(reactions).set({ emoji, createdAt: now() }).where(eq(reactions.id, existing.id)).run()
  else db.insert(reactions).values({ userId: viewerId, eventId, emoji, createdAt: now() }).run()
  if (!existing) notify({ userId: event.userId, actorId: viewerId, type: 'reaction', malId: event.malId, refId: eventId, text: emoji })
}

function toComment(viewer: Viewer, ownerId: number, row: typeof comments.$inferSelect, user: Parameters<typeof toCard>[0]): Comment {
  return {
    id: row.id,
    user: toCard(user),
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canEdit: row.userId === viewer.id,
    canDelete: row.userId === viewer.id || ownerId === viewer.id || viewer.role === 'admin',
  }
}

export function listComments(viewer: Viewer, target: CommentTarget, id: number): Comment[] {
  const { ownerId } = targetOwner(viewer.id, target, id)
  const hidden = hiddenUserIds(viewer.id)
  return db
    .select({ comment: comments, user: cardColumns })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(and(eq(comments.targetType, target), eq(comments.targetId, id)))
    .orderBy(asc(comments.createdAt))
    .all()
    .filter((row) => !hidden.has(row.comment.userId))
    .map((row) => toComment(viewer, ownerId, row.comment, row.user))
}

export function addComment(viewer: Viewer, target: CommentTarget, id: number, text: string): Comment {
  const { ownerId, malId } = targetOwner(viewer.id, target, id)
  const at = now()
  const row = db.insert(comments).values({ userId: viewer.id, targetType: target, targetId: id, text, createdAt: at, updatedAt: at }).returning().get()
  notify({ userId: ownerId, actorId: viewer.id, type: 'comment', malId, refId: row.id, text })
  const user = db.select(cardColumns).from(users).where(eq(users.id, viewer.id)).get()!
  return toComment(viewer, ownerId, row, user)
}

function ownedComment(viewer: Viewer, id: number) {
  const row = db.select().from(comments).where(eq(comments.id, id)).get()
  if (!row) notFound('COMMENT_NOT_FOUND')
  const { ownerId } = targetOwner(viewer.id, row.targetType, row.targetId)
  return { row, ownerId }
}

export function editComment(viewer: Viewer, id: number, text: string): Comment {
  const { row, ownerId } = ownedComment(viewer, id)
  if (row.userId !== viewer.id) notFound('COMMENT_NOT_FOUND')
  db.update(comments).set({ text, updatedAt: now() }).where(eq(comments.id, id)).run()
  const user = db.select(cardColumns).from(users).where(eq(users.id, viewer.id)).get()!
  return toComment(viewer, ownerId, { ...row, text, updatedAt: now() }, user)
}

export function deleteComment(viewer: Viewer, id: number) {
  const { row, ownerId } = ownedComment(viewer, id)
  if (row.userId !== viewer.id && ownerId !== viewer.id && viewer.role !== 'admin') notFound('COMMENT_NOT_FOUND')
  db.delete(comments).where(eq(comments.id, id)).run()
}

export function deleteTargetComments(target: CommentTarget, ids: number[]) {
  if (ids.length) db.delete(comments).where(and(eq(comments.targetType, target), inArray(comments.targetId, ids))).run()
}

const MATCH_MIN_RATED = 3
const SUGGESTION_SCORE = 8
const SUGGESTION_LIMIT = 12

export function tasteMatch(viewerId: number, ownerId: number): TasteMatch {
  const mine = new Map(db.select({ malId: listEntries.malId, score: listEntries.score }).from(listEntries).where(eq(listEntries.userId, viewerId)).all().map((r) => [r.malId, r.score]))
  const theirs = db.select({ entry: listEntries, anime }).from(listEntries).innerJoin(anime, eq(anime.malId, listEntries.malId)).where(eq(listEntries.userId, ownerId)).all()
  let shared = 0
  let rated = 0
  let difference = 0
  for (const { entry } of theirs) {
    if (!mine.has(entry.malId)) continue
    shared++
    const score = mine.get(entry.malId)
    if (score && entry.score) {
      rated++
      difference += Math.abs(score - entry.score)
    }
  }
  const suggestions = theirs
    .filter(({ entry }) => !mine.has(entry.malId) && (entry.score ?? 0) >= SUGGESTION_SCORE)
    .sort((a, b) => (b.entry.score ?? 0) - (a.entry.score ?? 0))
    .slice(0, SUGGESTION_LIMIT)
    .map(({ anime: row }) => toSummary(row))
  return { percent: rated >= MATCH_MIN_RATED ? Math.round(100 * (1 - difference / rated / 9)) : null, shared, rated, suggestions }
}

export function friendEntries(viewerId: number, malId: number): FriendEntry[] {
  const ids = friendIds(viewerId).filter((id) => !blockedBetween(viewerId, id))
  if (!ids.length) return []
  return db
    .select({ entry: listEntries, user: cardColumns, visibility: users.listVisibility })
    .from(listEntries)
    .innerJoin(users, eq(users.id, listEntries.userId))
    .where(and(eq(listEntries.malId, malId), inArray(listEntries.userId, ids)))
    .all()
    .filter((row) => row.visibility !== 'private')
    .map((row) => ({ user: toCard(row.user), status: row.entry.status, progress: row.entry.progress, score: row.entry.score }))
}

function visibleFriendIds(viewerId: number) {
  const ids = friendIds(viewerId).filter((id) => !blockedBetween(viewerId, id))
  if (!ids.length) return []
  return db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), sql`${users.listVisibility} != 'private'`)).all().map((r) => r.id)
}

export function friendTitles(viewerId: number): FriendTitles {
  const ids = visibleFriendIds(viewerId)
  if (!ids.length) return {}
  const rows = db
    .select({ malId: listEntries.malId, user: cardColumns })
    .from(listEntries)
    .innerJoin(users, eq(users.id, listEntries.userId))
    .where(and(inArray(listEntries.userId, ids), sql`${listEntries.status} != 'planning'`))
    .all()
  const titles: FriendTitles = {}
  for (const row of rows) (titles[row.malId] ??= []).push(toCard(row.user))
  return titles
}

const WATCHING_LIMIT = 20

export function friendsWatching(viewerId: number): FriendWatching[] {
  const ids = visibleFriendIds(viewerId)
  if (!ids.length) return []
  return db
    .select({ entry: listEntries, user: cardColumns, anime })
    .from(listEntries)
    .innerJoin(users, eq(users.id, listEntries.userId))
    .innerJoin(anime, eq(anime.malId, listEntries.malId))
    .where(and(inArray(listEntries.userId, ids), inArray(listEntries.status, ['watching', 'rewatching'])))
    .orderBy(desc(listEntries.updatedAt))
    .limit(WATCHING_LIMIT)
    .all()
    .map((row) => ({ user: toCard(row.user), anime: toSummary(row.anime), status: row.entry.status, progress: row.entry.progress, updatedAt: row.entry.updatedAt }))
}

export function inviteToRoom(viewerId: number, roomId: string, malId: number, ids: number[]) {
  const friends = new Set(friendIds(viewerId))
  let sent = 0
  for (const id of new Set(ids)) {
    if (!friends.has(id) || blockedBetween(viewerId, id)) continue
    notify({ userId: id, actorId: viewerId, type: 'room_invite', malId, text: roomId })
    sent++
  }
  return sent
}

export function recommend(viewerId: number, malId: number, ids: number[], message: string | null) {
  const friends = new Set(friendIds(viewerId))
  const at = now()
  let sent = 0
  for (const id of new Set(ids)) {
    if (!friends.has(id) || blockedBetween(viewerId, id)) continue
    db.insert(recommendations).values({ userId: viewerId, friendId: id, malId, message, createdAt: at }).run()
    notify({ userId: id, actorId: viewerId, type: 'recommendation', malId, text: message })
    sent++
  }
  return sent
}

