import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { userSettingsSchema } from '@yoru/shared'
import { db } from '../db/client'
import { users } from '../db/schema'
import { type AppEnv, requireAuth, toUser } from '../lib/auth'
import { parseBody } from '../lib/validate'

export const meRoutes = new Hono<AppEnv>().use(requireAuth).patch('/settings', async (c) => {
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
