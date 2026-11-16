import { and, count, desc, eq, gt, ne } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { type AccountInfo, type ProfileSettings, type SessionInfo, type ShareInfo, type UserCard, confirmPasswordSchema, profileUpdateSchema, shareUpdateSchema, userSettingsSchema } from '@yoru/shared'
import { db, now } from '../db/client'
import { activity, animeNotes, blocks, feedEvents, imports, invites, listEntries, notifications, sessions, users, watchProgress } from '../db/schema'
import { type AppEnv, currentSessionId, destroySession, requireAuth, toUser } from '../lib/auth'
import { randomToken, verifyPassword } from '../lib/crypto'
import { parseBody } from '../lib/validate'
import { cardColumns, summariesFor, toCard } from '../services/social'
import { MAX_AVATAR_BYTES, imageType, removeAvatar, saveAvatar } from './users'

const inviter = alias(users, 'inviter')

async function confirmPassword(passwordHash: string, password: string) {
  if (!(await verifyPassword(password, passwordHash))) throw new HTTPException(400, { message: 'INVALID_PASSWORD' })
}

function clearUserData(userId: number) {
  db.transaction((tx) => {
    for (const table of [listEntries, watchProgress, activity, notifications, imports, animeNotes, feedEvents]) {
      tx.delete(table).where(eq(table.userId, userId)).run()
    }
  })
}

function shareColumns(flags: { list?: boolean; stats?: boolean }) {
  return { ...(flags.list === undefined ? {} : { shareList: flags.list }), ...(flags.stats === undefined ? {} : { shareStats: flags.stats }) }
}

function readShare(userId: number): ShareInfo {
  const row = db.select({ token: users.shareToken, list: users.shareList, stats: users.shareStats }).from(users).where(eq(users.id, userId)).get()
  return { token: row?.token ?? null, list: row?.list ?? true, stats: row?.stats ?? false }
}

function readProfile(userId: number): ProfileSettings {
  const row = db
    .select({
      displayName: users.displayName,
      bio: users.bio,
      profileVisibility: users.profileVisibility,
      listVisibility: users.listVisibility,
      statsVisibility: users.statsVisibility,
      shareActivity: users.shareActivity,
      bannerMalId: users.bannerMalId,
      favorites: users.favorites,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get()!
  return { ...row, favorites: summariesFor(row.favorites) }
}

export const meRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/profile', (c) => c.json(readProfile(c.get('user').id)))
  .patch('/profile', async (c) => {
    const input = await parseBody(c, profileUpdateSchema)
    const known = (ids: number[]) => new Set(summariesFor(ids).map((a) => a.malId))
    const favorites = input.favorites ? [...new Set(input.favorites)].filter((id) => known(input.favorites!).has(id)) : undefined
    const patch = {
      ...input,
      ...(input.displayName !== undefined ? { displayName: input.displayName || null } : {}),
      ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
      ...(favorites !== undefined ? { favorites } : {}),
      ...(input.bannerMalId ? { bannerMalId: known([input.bannerMalId]).has(input.bannerMalId) ? input.bannerMalId : null } : {}),
    }
    if (Object.keys(patch).length) db.update(users).set(patch).where(eq(users.id, c.get('user').id)).run()
    return c.json(readProfile(c.get('user').id))
  })
  .put('/avatar', async (c) => {
    const bytes = new Uint8Array(await c.req.arrayBuffer())
    if (bytes.length > MAX_AVATAR_BYTES) throw new HTTPException(413, { message: 'AVATAR_TOO_LARGE' })
    if (!imageType(bytes)) throw new HTTPException(400, { message: 'AVATAR_INVALID' })
    saveAvatar(c.get('user').id, bytes)
    return c.json(toUser(db.select().from(users).where(eq(users.id, c.get('user').id)).get()!))
  })
  .delete('/avatar', (c) => {
    removeAvatar(c.get('user').id)
    return c.json(toUser(db.select().from(users).where(eq(users.id, c.get('user').id)).get()!))
  })
  .get('/blocks', (c) => {
    const rows = db.select(cardColumns).from(blocks).innerJoin(users, eq(users.id, blocks.blockedId)).where(eq(blocks.userId, c.get('user').id)).orderBy(desc(blocks.createdAt)).all()
    return c.json(rows.map(toCard) satisfies UserCard[])
  })
  .get('/share', (c) => c.json(readShare(c.get('user').id)))
  .post('/share', async (c) => {
    const flags = await parseBody(c, shareUpdateSchema)
    db.update(users).set({ shareToken: randomToken(16), ...shareColumns(flags) }).where(eq(users.id, c.get('user').id)).run()
    return c.json(readShare(c.get('user').id))
  })
  .patch('/share', async (c) => {
    const flags = await parseBody(c, shareUpdateSchema)
    const columns = shareColumns(flags)
    if (Object.keys(columns).length) db.update(users).set(columns).where(eq(users.id, c.get('user').id)).run()
    return c.json(readShare(c.get('user').id))
  })
  .delete('/share', (c) => {
    db.update(users).set({ shareToken: null }).where(eq(users.id, c.get('user').id)).run()
    return c.json(readShare(c.get('user').id))
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
  .post('/clear', async (c) => {
    const { password } = await parseBody(c, confirmPasswordSchema)
    const user = c.get('user')
    await confirmPassword(user.passwordHash, password)
    clearUserData(user.id)
    return c.json({ ok: true })
  })
  .post('/delete', async (c) => {
    const { password } = await parseBody(c, confirmPasswordSchema)
    const user = c.get('user')
    await confirmPassword(user.passwordHash, password)
    if (user.role === 'admin') {
      const admins = db.select({ n: count() }).from(users).where(eq(users.role, 'admin')).get()?.n ?? 0
      if (admins <= 1) throw new HTTPException(400, { message: 'LAST_ADMIN' })
    }
    destroySession(c)
    removeAvatar(user.id)
    db.delete(users).where(eq(users.id, user.id)).run()
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
