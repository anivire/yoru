import { and, eq, gt, lt } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { User } from '@yoru/shared'
import { db, now } from '../db/client'
import { sessions, users } from '../db/schema'
import { env, secureCookies } from '../env'
import { randomToken, sha256 } from './crypto'
import { getSetting } from './settings'
import { sourceEnabled } from './sources'

export const SESSION_COOKIE = 'yoru_session'

export type UserRow = typeof users.$inferSelect

export type AppEnv = {
  Variables: {
    user: UserRow
  }
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarVersion ? `/api/users/${row.id}/avatar?v=${row.avatarVersion}` : null,
    avatarCrop: row.avatarVersion ? row.avatarCrop : null,
    role: row.role,
    locale: row.locale,
    notifySub: row.notifySub,
    notifyVoice: row.notifyVoice,
    notifyPremieres: row.notifyPremieres,
    notifyFriends: row.notifyFriends,
    notifyComments: row.notifyComments,
    notifyReactions: row.notifyReactions,
    notifyRecommendations: row.notifyRecommendations,
    notifyRooms: row.notifyRooms,
    hasOwnAnime365Token: Boolean(row.anime365Token),
    hasSharedAnime365Token: Boolean(getSetting('anime365_token') || env.anime365Token),
    russianTitles: sourceEnabled('shikimori') || !sourceEnabled('jikan'),
    createdAt: row.createdAt,
  }
}

export function clientIp(c: Context): string | null {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || null
}

export function currentSessionId(c: Context): string | null {
  const token = getCookie(c, SESSION_COOKIE)
  return token ? sha256(token) : null
}

const SEEN_EVERY_MS = 5 * 60_000

export function createSession(c: Context, userId: number) {
  const token = randomToken()
  const expires = new Date(Date.now() + env.sessionDays * 86_400_000)
  const at = now()
  db.insert(sessions)
    .values({ id: sha256(token), userId, expiresAt: expires.toISOString(), createdAt: at, lastSeenAt: at, userAgent: c.req.header('user-agent')?.slice(0, 400) ?? null, ip: clientIp(c) })
    .run()
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies,
    path: '/',
    expires,
  })
}

export function destroySession(c: Context) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) db.delete(sessions).where(eq(sessions.id, sha256(token))).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export function purgeExpiredSessions() {
  db.delete(sessions).where(lt(sessions.expiresAt, now())).run()
}

export function sessionUser(c: Context): UserRow | null {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const id = sha256(token)
  const row = db
    .select({ user: users, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now())))
    .get()
  if (row && (!row.lastSeenAt || Date.now() - Date.parse(row.lastSeenAt) > SEEN_EVERY_MS)) {
    db.update(sessions).set({ lastSeenAt: now(), ip: clientIp(c) }).where(eq(sessions.id, id)).run()
  }
  return row?.user ?? null
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = sessionUser(c)
  if (!user) throw new HTTPException(401, { message: 'Unauthorized' })
  c.set('user', user)
  await next()
})

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user').role !== 'admin') throw new HTTPException(403, { message: 'Forbidden' })
  await next()
})

const attempts = new Map<string, { count: number; resetAt: number }>()

export function checkLoginRate(key: string) {
  const entry = attempts.get(key)
  const t = Date.now()
  if (!entry || entry.resetAt < t) {
    attempts.set(key, { count: 1, resetAt: t + 15 * 60_000 })
    return
  }
  entry.count += 1
  if (entry.count > 10) throw new HTTPException(429, { message: 'Too many attempts, try again later' })
}

export function resetLoginRate(key: string) {
  attempts.delete(key)
}
