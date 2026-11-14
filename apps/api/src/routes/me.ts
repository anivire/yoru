import { and, desc, eq, gt, ne } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { type AccountInfo, type SessionInfo, type ShareInfo, userSettingsSchema } from '@yoru/shared'
import { db, now } from '../db/client'
import { invites, sessions, users } from '../db/schema'
import { type AppEnv, currentSessionId, destroySession, requireAuth, toUser } from '../lib/auth'
import { randomToken } from '../lib/crypto'
import { parseBody } from '../lib/validate'

const inviter = alias(users, 'inviter')

export const meRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/share', (c) => {
    const row = db.select({ token: users.shareToken }).from(users).where(eq(users.id, c.get('user').id)).get()
    const body: ShareInfo = { token: row?.token ?? null }
    return c.json(body)
  })
  .post('/share', (c) => {
    const token = randomToken(16)
    db.update(users).set({ shareToken: token }).where(eq(users.id, c.get('user').id)).run()
    const body: ShareInfo = { token }
    return c.json(body)
  })
  .delete('/share', (c) => {
    db.update(users).set({ shareToken: null }).where(eq(users.id, c.get('user').id)).run()
    const body: ShareInfo = { token: null }
    return c.json(body)
  })
  .get('/account', (c) => {
    const user = c.get('user')
    const invite = db
      .select({ by: inviter.username, at: invites.usedAt })
      .from(invites)
      .leftJoin(inviter, eq(inviter.id, invites.createdBy))
      .where(eq(invites.usedBy, user.id))
      .get()
    const active = db
      .select({ createdAt: sessions.createdAt })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, now())))
      .orderBy(desc(sessions.createdAt))
      .all()
    const body: AccountInfo = {
      invitedBy: invite?.by ?? null,
      lastLoginAt: active[0]?.createdAt ?? null,
      activeSessions: active.length,
    }
    return c.json(body)
  })
  .get('/sessions', (c) => {
    const current = currentSessionId(c)
    const rows = db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, c.get('user').id), gt(sessions.expiresAt, now())))
      .orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt))
      .all()
    const body: SessionInfo[] = rows
      .map((s) => ({ id: s.id, current: s.id === current, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, userAgent: s.userAgent, ip: s.ip }))
      .sort((a, b) => Number(b.current) - Number(a.current))
    return c.json(body)
  })
  .delete('/sessions/:id', (c) => {
    const id = c.req.param('id')
    if (id === currentSessionId(c)) {
      destroySession(c)
      return c.json({ ok: true, signedOut: true })
    }
    db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, c.get('user').id))).run()
    return c.json({ ok: true, signedOut: false })
  })
  .delete('/sessions', (c) => {
    const current = currentSessionId(c) ?? ''
    db.delete(sessions).where(and(eq(sessions.userId, c.get('user').id), ne(sessions.id, current))).run()
    return c.json({ ok: true })
  })
  .patch('/settings', async (c) => {
  const input = await parseBody(c, userSettingsSchema)
  const user = c.get('user')
  const patch: Partial<typeof users.$inferInsert> = {}
  if (input.locale) patch.locale = input.locale
  if (input.notifySub !== undefined) patch.notifySub = input.notifySub
  if (input.notifyVoice !== undefined) patch.notifyVoice = input.notifyVoice
  if (input.notifyPremieres !== undefined) patch.notifyPremieres = input.notifyPremieres
  if (input.anime365Token !== undefined) patch.anime365Token = input.anime365Token || null
  if (Object.keys(patch).length) db.update(users).set(patch).where(eq(users.id, user.id)).run()
  return c.json(toUser(db.select().from(users).where(eq(users.id, user.id)).get()!))
})
