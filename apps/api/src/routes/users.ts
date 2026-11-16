import fs from 'node:fs'
import path from 'node:path'
import { and, eq, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { LIST_STATUSES, type ListStatus, type UserCard, type UserProfile } from '@yoru/shared'
import { db, now } from '../db/client'
import { blocks, friendships, listEntries, users } from '../db/schema'
import { env } from '../env'
import { type AppEnv, requireAuth } from '../lib/auth'
import { notFound } from '../lib/http'
import { intParam, parseBody } from '../lib/validate'
import { bannerUrl, blockedBetween, canSee, cardColumns, friendIds, hiddenUserIds, relation, summariesFor, toCard } from '../services/social'
import { feedPage } from '../services/feed'
import { tasteMatch } from '../services/interactions'
import { userStats } from '../services/stats'
import { listPage } from './list'

const SEARCH_LIMIT = 20
export const MAX_AVATAR_BYTES = 512 * 1024
const avatarDir = path.join(env.dataDir, 'avatars')

const moderateSchema = z.object({ avatar: z.boolean().optional(), bio: z.boolean().optional(), displayName: z.boolean().optional() })

type OwnerRow = typeof users.$inferSelect

export function avatarPath(userId: number) {
  return path.join(avatarDir, String(userId))
}

export function imageType(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => Buffer.from(bytes.subarray(from, to)).toString('ascii')
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

export function saveAvatar(userId: number, bytes: Uint8Array) {
  fs.mkdirSync(avatarDir, { recursive: true })
  fs.writeFileSync(avatarPath(userId), bytes)
  db.update(users).set({ avatarVersion: Date.now() }).where(eq(users.id, userId)).run()
}

export function removeAvatar(userId: number) {
  fs.rmSync(avatarPath(userId), { force: true })
  db.update(users).set({ avatarVersion: null }).where(eq(users.id, userId)).run()
}

function ownerByName(viewerId: number, username: string): OwnerRow {
  const owner = db.select().from(users).where(eq(users.username, username)).get()
  if (!owner) notFound('USER_NOT_FOUND')
  const blockedViewer = db.select({ id: blocks.id }).from(blocks).where(and(eq(blocks.userId, owner.id), eq(blocks.blockedId, viewerId))).get()
  if (blockedViewer) notFound('USER_NOT_FOUND')
  return owner
}

function restricted(viewerId: number, owner: OwnerRow) {
  return !canSee(viewerId, owner.id, owner.profileVisibility)
}

function statusCounts(userId: number): Record<ListStatus, number> {
  const counts = Object.fromEntries(LIST_STATUSES.map((s) => [s, 0])) as Record<ListStatus, number>
  const rows = db.select({ status: listEntries.status, count: sql<number>`count(*)` }).from(listEntries).where(eq(listEntries.userId, userId)).groupBy(listEntries.status).all()
  for (const row of rows) counts[row.status] = row.count
  return counts
}

export const userRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => {
    const viewer = c.get('user')
    const q = (c.req.query('q') ?? '').trim().toLocaleLowerCase()
    if (!q) return c.json([] satisfies UserCard[])
    const hidden = hiddenUserIds(viewer.id)
    const matches = db
      .select(cardColumns)
      .from(users)
      .all()
      .filter((row) => row.id !== viewer.id && !hidden.has(row.id) && (row.username.toLocaleLowerCase().includes(q) || row.displayName?.toLocaleLowerCase().includes(q)))
      .slice(0, SEARCH_LIMIT)
      .map(toCard)
    return c.json(matches satisfies UserCard[])
  })
  .get('/:id{[0-9]+}/avatar', (c) => {
    const file = avatarPath(intParam(c, 'id'))
    if (!fs.existsSync(file)) notFound('AVATAR_NOT_FOUND')
    const bytes = fs.readFileSync(file)
    c.header('Content-Type', imageType(bytes) ?? 'application/octet-stream')
    c.header('Cache-Control', 'private, max-age=31536000, immutable')
    return c.body(bytes)
  })
  .post('/:id{[0-9]+}/block', (c) => {
    const viewer = c.get('user')
    const id = intParam(c, 'id')
    if (id === viewer.id || !db.select({ id: users.id }).from(users).where(eq(users.id, id)).get()) notFound('USER_NOT_FOUND')
    db.transaction((tx) => {
      tx.insert(blocks).values({ userId: viewer.id, blockedId: id, createdAt: now() }).onConflictDoNothing().run()
      tx.delete(friendships)
        .where(or(and(eq(friendships.userId, viewer.id), eq(friendships.friendId, id)), and(eq(friendships.userId, id), eq(friendships.friendId, viewer.id))))
        .run()
    })
    return c.json({ ok: true })
  })
  .delete('/:id{[0-9]+}/block', (c) => {
    db.delete(blocks).where(and(eq(blocks.userId, c.get('user').id), eq(blocks.blockedId, intParam(c, 'id')))).run()
    return c.json({ ok: true })
  })
  .post('/:id{[0-9]+}/moderate', async (c) => {
    if (c.get('user').role !== 'admin') notFound('USER_NOT_FOUND')
    const id = intParam(c, 'id')
    const input = await parseBody(c, moderateSchema)
    if (input.avatar) removeAvatar(id)
    if (input.bio || input.displayName) {
      db.update(users)
        .set({ ...(input.bio ? { bio: null } : {}), ...(input.displayName ? { displayName: null } : {}) })
        .where(eq(users.id, id))
        .run()
    }
    return c.json({ ok: true })
  })
  .get('/:username', (c) => {
    const viewer = c.get('user')
    const owner = ownerByName(viewer.id, c.req.param('username'))
    const hidden = restricted(viewer.id, owner)
    const canSeeList = !hidden && canSee(viewer.id, owner.id, owner.listVisibility)
    const canSeeStats = !hidden && canSee(viewer.id, owner.id, owner.statsVisibility)
    const body: UserProfile = {
      user: toCard(owner),
      bio: hidden ? null : owner.bio,
      createdAt: owner.createdAt,
      relation: relation(viewer.id, owner.id),
      blocked: blockedBetween(viewer.id, owner.id),
      restricted: hidden,
      canSeeList,
      canSeeStats,
      friends: hidden ? 0 : friendIds(owner.id).length,
      statuses: canSeeList || canSeeStats ? statusCounts(owner.id) : null,
      banner: hidden ? null : bannerUrl(owner.bannerMalId),
      favorites: hidden ? [] : summariesFor(owner.favorites),
    }
    return c.json(body)
  })
  .get('/:username/list', (c) => {
    const viewer = c.get('user')
    const owner = ownerByName(viewer.id, c.req.param('username'))
    if (restricted(viewer.id, owner) || !canSee(viewer.id, owner.id, owner.listVisibility)) notFound('LIST_HIDDEN')
    const page = listPage(owner.id, (key) => c.req.query(key))
    return c.json({ ...page, items: page.items.map((e) => ({ ...e, notes: null })) })
  })
  .get('/:username/stats', (c) => {
    const viewer = c.get('user')
    const owner = ownerByName(viewer.id, c.req.param('username'))
    if (restricted(viewer.id, owner) || !canSee(viewer.id, owner.id, owner.statsVisibility)) notFound('STATS_HIDDEN')
    return c.json(userStats(owner.id, c.req.query('tz')))
  })
  .get('/:username/feed', (c) => {
    const viewer = c.get('user')
    const owner = ownerByName(viewer.id, c.req.param('username'))
    if (restricted(viewer.id, owner)) return c.json({ items: [], nextBefore: null })
    return c.json(feedPage(viewer.id, { before: c.req.query('before') || null, limit: Number(c.req.query('limit')) || 60, scope: { userId: owner.id } }))
  })
  .get('/:username/match', (c) => {
    const viewer = c.get('user')
    const owner = ownerByName(viewer.id, c.req.param('username'))
    if (owner.id === viewer.id || restricted(viewer.id, owner) || !canSee(viewer.id, owner.id, owner.listVisibility)) notFound('LIST_HIDDEN')
    return c.json(tasteMatch(viewer.id, owner.id))
  })
  .get('/:username/friends', (c) => {
    const viewer = c.get('user')
    const owner = ownerByName(viewer.id, c.req.param('username'))
    if (restricted(viewer.id, owner)) return c.json([] satisfies UserCard[])
    const hidden = hiddenUserIds(viewer.id)
    const ids = friendIds(owner.id).filter((id) => !hidden.has(id))
    const rows = ids.length ? db.select(cardColumns).from(users).all().filter((row) => ids.includes(row.id)) : []
    return c.json(rows.map(toCard) satisfies UserCard[])
  })
