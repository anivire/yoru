import { and, desc, eq, gt } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { type AccountInfo, userSettingsSchema } from '@yoru/shared'
import { db, now } from '../db/client'
import { invites, sessions, users } from '../db/schema'
import { type AppEnv, requireAuth, toUser } from '../lib/auth'
import { parseBody } from '../lib/validate'

const inviter = alias(users, 'inviter')

export const meRoutes = new Hono<AppEnv>()
  .use(requireAuth)
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
  .patch('/settings', async (c) => {
  const input = await parseBody(c, userSettingsSchema)
  const user = c.get('user')
  const patch: Partial<typeof users.$inferInsert> = {}
  if (input.locale) patch.locale = input.locale
  if (input.notifySub !== undefined) patch.notifySub = input.notifySub
  if (input.notifyVoice !== undefined) patch.notifyVoice = input.notifyVoice
  if (input.anime365Token !== undefined) patch.anime365Token = input.anime365Token || null
  if (Object.keys(patch).length) db.update(users).set(patch).where(eq(users.id, user.id)).run()
  return c.json(toUser(db.select().from(users).where(eq(users.id, user.id)).get()!))
})
