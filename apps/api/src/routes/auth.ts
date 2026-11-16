import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { changePasswordSchema, loginSchema, registerSchema } from '@yoru/shared'
import { db, now } from '../db/client'
import { invites, sessions, users } from '../db/schema'
import {
  type AppEnv,
  checkLoginRate,
  createSession,
  destroySession,
  requireAuth,
  resetLoginRate,
  sessionUser,
  toUser,
} from '../lib/auth'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { parseBody } from '../lib/validate'
import { notify } from '../services/social'

function findInvite(code: string) {
  return db
    .select()
    .from(invites)
    .where(and(eq(invites.code, code), isNull(invites.usedAt), or(isNull(invites.expiresAt), gt(invites.expiresAt, now()))))
    .get()
}

export const authRoutes = new Hono<AppEnv>()
  .get('/me', (c) => {
    const user = sessionUser(c)
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' })
    return c.json(toUser(user))
  })
  .post('/login', async (c) => {
    const { username, password } = await parseBody(c, loginSchema)
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const key = `${ip}:${username.toLowerCase()}`
    checkLoginRate(key)
    const user = db.select().from(users).where(eq(users.username, username)).get()
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HTTPException(401, { message: 'INVALID_CREDENTIALS' })
    }
    resetLoginRate(key)
    createSession(c, user.id)
    return c.json(toUser(user))
  })
  .post('/logout', (c) => {
    destroySession(c)
    return c.json({ ok: true })
  })
  .get('/invite/:code', (c) => {
    const invite = findInvite(c.req.param('code'))
    const inviter = invite?.createdBy ? db.select({ username: users.username, displayName: users.displayName }).from(users).where(eq(users.id, invite.createdBy)).get() : undefined
    return c.json({ valid: Boolean(invite), role: invite?.role ?? null, inviter: inviter ?? null })
  })
  .post('/register', async (c) => {
    const input = await parseBody(c, registerSchema)
    const invite = findInvite(input.code)
    if (!invite) throw new HTTPException(400, { message: 'INVITE_INVALID' })
    const taken = db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).get()
    if (taken) throw new HTTPException(409, { message: 'USERNAME_TAKEN' })
    const passwordHash = await hashPassword(input.password)
    const user = db.transaction((tx) => {
      const created = tx
        .insert(users)
        .values({ username: input.username, passwordHash, role: invite.role, createdAt: now() })
        .returning()
        .get()
      tx.update(invites).set({ usedAt: now(), usedBy: created.id }).where(eq(invites.id, invite.id)).run()
      return created
    })
    if (invite.createdBy) notify({ userId: invite.createdBy, actorId: user.id, type: 'invite_accepted' })
    createSession(c, user.id)
    return c.json(toUser(user))
  })
  .post('/password', requireAuth, async (c) => {
    const input = await parseBody(c, changePasswordSchema)
    const user = c.get('user')
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new HTTPException(400, { message: 'INVALID_PASSWORD' })
    }
    db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, user.id)).run()
    db.delete(sessions).where(eq(sessions.userId, user.id)).run()
    createSession(c, user.id)
    return c.json({ ok: true })
  })
