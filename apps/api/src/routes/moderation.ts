import { desc, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { Hono } from 'hono'
import type { ModerationComment, ModerationNote, ModerationProfile } from '@yoru/shared'
import { db } from '../db/client'
import { animeNotes, comments, feedEvents, users } from '../db/schema'
import type { AppEnv } from '../lib/auth'
import { intParam } from '../lib/validate'
import { deleteNote } from '../services/feed'
import { cardColumns, summariesFor, toCard } from '../services/social'

const LIMIT = 100

export const moderationRoutes = new Hono<AppEnv>()
  .get('/comments', (c) => {
    const rows = db.select({ comment: comments, user: cardColumns }).from(comments).innerJoin(users, eq(users.id, comments.userId)).orderBy(desc(comments.createdAt)).limit(LIMIT).all()
    const eventIds = rows.filter((r) => r.comment.targetType === 'event').map((r) => r.comment.targetId)
    const noteIds = rows.filter((r) => r.comment.targetType === 'note').map((r) => r.comment.targetId)
    const eventAnime = new Map(eventIds.length ? db.select({ id: feedEvents.id, malId: feedEvents.malId }).from(feedEvents).where(inArray(feedEvents.id, eventIds)).all().map((r) => [r.id, r.malId]) : [])
    const noteAnime = new Map(noteIds.length ? db.select({ id: animeNotes.id, malId: animeNotes.malId }).from(animeNotes).where(inArray(animeNotes.id, noteIds)).all().map((r) => [r.id, r.malId]) : [])
    const malIdOf = (r: (typeof rows)[number]) => (r.comment.targetType === 'event' ? eventAnime : noteAnime).get(r.comment.targetId) ?? null
    const anime = new Map(summariesFor([...new Set(rows.map(malIdOf).filter((id): id is number => id !== null))]).map((a) => [a.malId, a]))
    const body: ModerationComment[] = rows.map((r) => {
      const malId = malIdOf(r)
      return { id: r.comment.id, user: toCard(r.user), text: r.comment.text, createdAt: r.comment.createdAt, anime: malId ? (anime.get(malId) ?? null) : null }
    })
    return c.json(body)
  })
  .delete('/comments/:id', (c) => {
    db.delete(comments).where(eq(comments.id, intParam(c, 'id'))).run()
    return c.json({ ok: true })
  })
  .get('/notes', (c) => {
    const rows = db.select({ note: animeNotes, user: cardColumns }).from(animeNotes).innerJoin(users, eq(users.id, animeNotes.userId)).where(eq(animeNotes.private, false)).orderBy(desc(animeNotes.createdAt)).limit(LIMIT).all()
    const anime = new Map(summariesFor([...new Set(rows.map((r) => r.note.malId))]).map((a) => [a.malId, a]))
    const body: ModerationNote[] = rows.map((r) => ({ id: r.note.id, user: toCard(r.user), text: r.note.text, createdAt: r.note.createdAt, anime: anime.get(r.note.malId) ?? null }))
    return c.json(body)
  })
  .delete('/notes/:id', (c) => {
    deleteNote(c.get('user').id, intParam(c, 'id'), true)
    return c.json({ ok: true })
  })
  .get('/profiles', (c) => {
    const rows = db
      .select({ ...cardColumns, bio: users.bio, createdAt: users.createdAt })
      .from(users)
      .where(or(isNotNull(users.avatarVersion), isNotNull(users.bio), isNotNull(users.displayName)))
      .orderBy(desc(users.createdAt))
      .all()
    const body: ModerationProfile[] = rows.map((r) => ({ user: toCard(r), bio: r.bio, createdAt: r.createdAt }))
    return c.json(body)
  })
