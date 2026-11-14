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
    role: row.role,
    locale: row.locale,
    notifySub: row.notifySub,
    notifyVoice: row.notifyVoice,
    hasOwnAnime365Token: Boolean(row.anime365Token),
    createdAt: row.createdAt,
  }
}

export function createSession(c: Context, userId: number) {
  const token = randomToken()
  const expires = new Date(Date.now() + env.sessionDays * 86_400_000)
  db.insert(sessions).values({ id: sha256(token), userId, expiresAt: expires.toISOString(), createdAt: now() }).run()
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
  const row = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, now())))
    .get()
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
