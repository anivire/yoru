import { desc, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { type AdminSettings, type AdminUser, type Invite, IMPORT_PROVIDERS, adminSettingsSchema, inviteInputSchema } from '@yoru/shared'
import { db, now } from '../db/client'
import { invites, listEntries, users } from '../db/schema'
import { env } from '../env'
import { type AppEnv, requireAdmin, requireAuth } from '../lib/auth'
import { randomToken } from '../lib/crypto'
import { getSetting, metadataSource, setSetting } from '../lib/settings'
import { intParam, parseBody } from '../lib/validate'
import { providerEnabled } from '../services/importers'
import { jikan } from '../services/jikan'

const usedByUser = alias(users, 'used_by_user')

function listInvites(): Invite[] {
  return db
    .select({ invite: invites, usedBy: usedByUser.username })
    .from(invites)
    .leftJoin(usedByUser, eq(usedByUser.id, invites.usedBy))
    .orderBy(desc(invites.createdAt))
    .all()
    .map(({ invite, usedBy }) => ({
      id: invite.id,
      code: invite.code,
      note: invite.note,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
      usedBy,
    }))
}

let jikanStatus: { value: boolean; at: number } | null = null
let jikanCheck: Promise<void> | null = null

function refreshJikanStatus() {
  if (jikanCheck) return
  jikanCheck = jikan
    .ping()
    .then((value) => {
      jikanStatus = { value, at: Date.now() }
    })
    .finally(() => {
      jikanCheck = null
    })
}

export const adminRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireAdmin)
  .get('/invites', (c) => c.json(listInvites()))
  .post('/invites', async (c) => {
    const input = await parseBody(c, inviteInputSchema)
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null
    db.insert(invites)
      .values({ code: randomToken(12), note: input.note ?? null, createdBy: c.get('user').id, createdAt: now(), expiresAt })
      .run()
    return c.json(listInvites())
  })
  .delete('/invites/:id', (c) => {
    db.delete(invites).where(eq(invites.id, intParam(c, 'id'))).run()
    return c.json(listInvites())
  })
  .get('/users', (c) => {
    const rows: AdminUser[] = db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
        entries: sql<number>`(select count(*) from ${listEntries} where ${listEntries.userId} = ${users.id})`,
      })
      .from(users)
      .orderBy(users.createdAt)
      .all()
    return c.json(rows)
  })
  .delete('/users/:id', (c) => {
    const id = intParam(c, 'id')
    if (id === c.get('user').id) throw new HTTPException(400, { message: 'CANNOT_DELETE_SELF' })
    db.delete(users).where(eq(users.id, id)).run()
    return c.json({ ok: true })
  })
  .get('/settings', (c) => {
    const source = metadataSource()
    if (source === 'jikan' && (!jikanStatus || Date.now() - jikanStatus.at > 5 * 60_000)) refreshJikanStatus()
    const body: AdminSettings = {
      hasAnime365Token: Boolean(getSetting('anime365_token') || env.anime365Token),
      importProviders: Object.fromEntries(IMPORT_PROVIDERS.map((p) => [p, providerEnabled(p)])) as AdminSettings['importProviders'],
      jikanReachable: jikanStatus?.value ?? null,
      metadataSource: source,
    }
    return c.json(body)
  })
  .put('/settings', async (c) => {
    const input = await parseBody(c, adminSettingsSchema)
    if (input.anime365Token !== undefined) setSetting('anime365_token', input.anime365Token || null)
    if (input.metadataSource) setSetting('metadata_source', input.metadataSource)
    return c.json({ ok: true })
  })
