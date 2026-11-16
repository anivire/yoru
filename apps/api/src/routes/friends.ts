import { and, eq, or } from 'drizzle-orm'
import { Hono } from 'hono'
import type { FriendsOverview, Relation } from '@yoru/shared'
import { db, now } from '../db/client'
import { friendships, users } from '../db/schema'
import { type AppEnv, requireAuth } from '../lib/auth'
import { notFound } from '../lib/http'
import { intParam } from '../lib/validate'
import { blockedBetween, cardsFor, hiddenUserIds, notify, relation } from '../services/social'

function pair(a: number, b: number) {
  return or(and(eq(friendships.userId, a), eq(friendships.friendId, b)), and(eq(friendships.userId, b), eq(friendships.friendId, a)))
}

function target(viewerId: number, id: number) {
  if (id === viewerId || blockedBetween(viewerId, id) || !db.select({ id: users.id }).from(users).where(eq(users.id, id)).get()) notFound('USER_NOT_FOUND')
}

export const friendRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => {
    const viewerId = c.get('user').id
    const hidden = hiddenUserIds(viewerId)
    const rows = db
      .select()
      .from(friendships)
      .where(or(eq(friendships.userId, viewerId), eq(friendships.friendId, viewerId)))
      .all()
      .filter((row) => !hidden.has(row.userId === viewerId ? row.friendId : row.userId))
    const cards = cardsFor(rows.map((row) => (row.userId === viewerId ? row.friendId : row.userId)))
    const card = (id: number) => cards.get(id)!
    const byName = (a: { username: string; displayName: string | null }, b: { username: string; displayName: string | null }) => (a.displayName ?? a.username).localeCompare(b.displayName ?? b.username)
    const body: FriendsOverview = {
      friends: rows.filter((row) => row.status === 'accepted').map((row) => card(row.userId === viewerId ? row.friendId : row.userId)).sort(byName),
      incoming: rows.filter((row) => row.status === 'pending' && row.friendId === viewerId).map((row) => card(row.userId)),
      outgoing: rows.filter((row) => row.status === 'pending' && row.userId === viewerId).map((row) => card(row.friendId)),
    }
    return c.json(body)
  })
  .post('/:id', (c) => {
    const viewerId = c.get('user').id
    const id = intParam(c, 'id')
    target(viewerId, id)
    const current = relation(viewerId, id)
    if (current === 'incoming') {
      db.update(friendships).set({ status: 'accepted', acceptedAt: now() }).where(pair(viewerId, id)).run()
      notify({ userId: id, actorId: viewerId, type: 'friend_accepted' })
    } else if (current === 'none') {
      db.insert(friendships).values({ userId: viewerId, friendId: id, status: 'pending', createdAt: now() }).run()
      notify({ userId: id, actorId: viewerId, type: 'friend_request' })
    }
    return c.json({ relation: relation(viewerId, id) satisfies Relation })
  })
  .delete('/:id', (c) => {
    const viewerId = c.get('user').id
    const id = intParam(c, 'id')
    db.delete(friendships).where(pair(viewerId, id)).run()
    return c.json({ relation: relation(viewerId, id) satisfies Relation })
  })
