import { and, eq, inArray, or, sql } from 'drizzle-orm'
import type { AnimeSummary, AvatarCrop, PersonCard, Relation, UserCard, Visibility } from '@yoru/shared'
import { db, now } from '../db/client'
import { anime, blocks, friendships, listEntries, socialNotifications, users } from '../db/schema'
import { toSummary } from './anime'

type CardRow = { id: number; username: string; displayName: string | null; avatarVersion: number | null; avatarCrop: AvatarCrop | null }

export const cardColumns = { id: users.id, username: users.username, displayName: users.displayName, avatarVersion: users.avatarVersion, avatarCrop: users.avatarCrop }

export function avatarUrl(id: number, version: number | null) {
  return version ? `/api/users/${id}/avatar?v=${version}` : null
}

export function toCard(row: CardRow): UserCard {
  return { id: row.id, username: row.username, displayName: row.displayName, avatarUrl: avatarUrl(row.id, row.avatarVersion), avatarCrop: row.avatarVersion ? row.avatarCrop : null }
}

export function cardsFor(ids: number[]): Map<number, UserCard> {
  if (!ids.length) return new Map()
  const rows = db.select(cardColumns).from(users).where(inArray(users.id, [...new Set(ids)])).all()
  return new Map(rows.map((row) => [row.id, toCard(row)]))
}

export function blockedBetween(a: number, b: number) {
  return Boolean(
    db
      .select({ id: blocks.id })
      .from(blocks)
      .where(or(and(eq(blocks.userId, a), eq(blocks.blockedId, b)), and(eq(blocks.userId, b), eq(blocks.blockedId, a))))
      .get(),
  )
}

export function hiddenUserIds(viewerId: number): Set<number> {
  const rows = db
    .select({ userId: blocks.userId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.userId, viewerId), eq(blocks.blockedId, viewerId)))
    .all()
  return new Set(rows.map((row) => (row.userId === viewerId ? row.blockedId : row.userId)))
}

export function friendIds(userId: number): number[] {
  return db
    .select({ userId: friendships.userId, friendId: friendships.friendId })
    .from(friendships)
    .where(and(eq(friendships.status, 'accepted'), or(eq(friendships.userId, userId), eq(friendships.friendId, userId))))
    .all()
    .map((row) => (row.userId === userId ? row.friendId : row.userId))
}

export function relation(viewerId: number, otherId: number): Relation {
  if (viewerId === otherId) return 'self'
  const row = db
    .select({ userId: friendships.userId, status: friendships.status })
    .from(friendships)
    .where(or(and(eq(friendships.userId, viewerId), eq(friendships.friendId, otherId)), and(eq(friendships.userId, otherId), eq(friendships.friendId, viewerId))))
    .get()
  if (!row) return 'none'
  if (row.status === 'accepted') return 'friend'
  return row.userId === viewerId ? 'outgoing' : 'incoming'
}

export function canSee(viewerId: number, ownerId: number, visibility: Visibility) {
  if (viewerId === ownerId) return true
  if (visibility === 'private' || blockedBetween(viewerId, ownerId)) return false
  return visibility === 'everyone' || relation(viewerId, ownerId) === 'friend'
}

const NOTIFY_FLAGS = {
  friend_request: users.notifyFriends,
  friend_accepted: users.notifyFriends,
  comment: users.notifyComments,
  reaction: users.notifyReactions,
  recommendation: users.notifyRecommendations,
  room_invite: users.notifyRooms,
  invite_accepted: users.notifyFriends,
} as const

export function notify(input: { userId: number; actorId: number; type: (typeof socialNotifications.$inferInsert)['type']; malId?: number | null; refId?: number | null; text?: string | null }) {
  if (input.userId === input.actorId || blockedBetween(input.userId, input.actorId)) return
  const wanted = db.select({ on: NOTIFY_FLAGS[input.type] }).from(users).where(eq(users.id, input.userId)).get()
  if (!wanted?.on) return
  db.insert(socialNotifications)
    .values({ userId: input.userId, actorId: input.actorId, type: input.type, malId: input.malId ?? null, refId: input.refId ?? null, text: input.text ?? null, createdAt: now() })
    .run()
}

export function summariesFor(ids: number[]): AnimeSummary[] {
  if (!ids.length) return []
  const rows = new Map(db.select().from(anime).where(inArray(anime.malId, ids)).all().map((row) => [row.malId, row]))
  return ids.flatMap((id) => {
    const row = rows.get(id)
    return row ? [toSummary(row)] : []
  })
}

export function bannerUrl(malId: number | null) {
  if (!malId) return null
  return db.select({ imageUrl: anime.imageUrl }).from(anime).where(eq(anime.malId, malId)).get()?.imageUrl ?? null
}

export function personCards(viewerId: number, ids: number[]): PersonCard[] {
  if (!ids.length) return []
  const unique = [...new Set(ids)]
  const rows = new Map(db.select().from(users).where(inArray(users.id, unique)).all().map((row) => [row.id, row]))
  const titles = new Map(
    db
      .select({ userId: listEntries.userId, count: sql<number>`count(*)` })
      .from(listEntries)
      .where(inArray(listEntries.userId, unique))
      .groupBy(listEntries.userId)
      .all()
      .map((row) => [row.userId, row.count]),
  )
  const relations = new Map<number, Relation>(
    db
      .select({ userId: friendships.userId, friendId: friendships.friendId, status: friendships.status })
      .from(friendships)
      .where(or(and(eq(friendships.userId, viewerId), inArray(friendships.friendId, unique)), and(eq(friendships.friendId, viewerId), inArray(friendships.userId, unique))))
      .all()
      .map((row) => (row.userId === viewerId ? [row.friendId, row.status === 'accepted' ? 'friend' : 'outgoing'] : [row.userId, row.status === 'accepted' ? 'friend' : 'incoming'])),
  )
  const banners = new Map(
    db
      .select({ malId: anime.malId, imageUrl: anime.imageUrl })
      .from(anime)
      .where(inArray(anime.malId, [...rows.values()].map((row) => row.bannerMalId).filter((id): id is number => id !== null)))
      .all()
      .map((row) => [row.malId, row.imageUrl]),
  )
  return ids.flatMap((id) => {
    const row = rows.get(id)
    if (!row) return []
    const profile = canSee(viewerId, id, row.profileVisibility)
    return [
      {
        ...toCard(row),
        relation: id === viewerId ? 'self' : (relations.get(id) ?? 'none'),
        banner: profile && row.bannerMalId ? (banners.get(row.bannerMalId) ?? null) : null,
        bio: profile ? row.bio : null,
        titles: profile && canSee(viewerId, id, row.listVisibility) ? (titles.get(id) ?? 0) : null,
        friends: profile && canSee(viewerId, id, row.friendsVisibility) ? friendIds(id).length : null,
      },
    ]
  })
}
