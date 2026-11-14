import { desc, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  type AdminSettings,
  type AdminUser,
  type DataSourceId,
  type ImportProvider,
  type Invite,
  IMPORT_PROVIDERS,
  adminSettingsSchema,
  inviteInputSchema,
} from '@yoru/shared'
import { db, now } from '../db/client'
import { invites, users } from '../db/schema'
import { env } from '../env'
import { type AppEnv, requireAdmin, requireAuth } from '../lib/auth'
import { randomToken } from '../lib/crypto'
import { getSetting, metadataSource, setSetting } from '../lib/settings'
import { githubConfig, oauthConfig, setSourceEnabled, setSourceUrl } from '../lib/sources'
import { intParam, parseBody } from '../lib/validate'
import { clearDiscoverCache } from '../services/discover'
import { providerEnabled, redirectUri } from '../services/importers'
import { resetSourceStatus, sourceInfos } from '../services/sources'

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
        entries: sql<number>`(select count(*) from "list_entries" as "le" where "le"."user_id" = "users"."id")`,
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
    const github = githubConfig()
    const body: AdminSettings = {
      hasAnime365Token: Boolean(getSetting('anime365_token') || env.anime365Token),
      importProviders: Object.fromEntries(IMPORT_PROVIDERS.map((p) => [p, providerEnabled(p)])) as AdminSettings['importProviders'],
      metadataSource: metadataSource(),
      sources: sourceInfos(),
      github: { repo: github.repo, branch: github.branch, defaultRepo: env.githubRepo, defaultBranch: env.githubBranch, hasToken: Boolean(github.token) },
      oauth: Object.fromEntries(
        IMPORT_PROVIDERS.map((p) => {
          const config = oauthConfig(p)
          return [
            p,
            {
              configured: Boolean(config.clientId && config.clientSecret),
              clientId: config.clientId,
              hasSecret: Boolean(config.clientSecret),
              fromEnv: config.fromEnv,
              redirectUri: redirectUri(p),
            },
          ]
        }),
      ) as AdminSettings['oauth'],
    }
    return c.json(body)
  })
  .put('/settings', async (c) => {
    const input = await parseBody(c, adminSettingsSchema)
    if (input.anime365Token !== undefined) setSetting('anime365_token', input.anime365Token || null)
    if (input.metadataSource) setSetting('metadata_source', input.metadataSource)
    for (const [id, patch] of Object.entries(input.sources ?? {}) as [DataSourceId, { enabled?: boolean; url?: string | null } | undefined][]) {
      if (!patch) continue
      if (patch.enabled !== undefined) setSourceEnabled(id, patch.enabled)
      if (patch.url !== undefined) {
        setSourceUrl(id, patch.url || null)
        resetSourceStatus(id)
      }
    }
    if (input.github) {
      if (input.github.repo !== undefined) setSetting('github.repo', input.github.repo || null)
      if (input.github.branch !== undefined) setSetting('github.branch', input.github.branch || null)
      if (input.github.token !== undefined) setSetting('github.token', input.github.token || null)
      resetSourceStatus('github')
    }
    for (const [provider, patch] of Object.entries(input.oauth ?? {}) as [ImportProvider, { clientId?: string | null; clientSecret?: string | null } | undefined][]) {
      if (!patch) continue
      if (patch.clientId !== undefined) setSetting(`oauth.${provider}.clientId`, patch.clientId || null)
      if (patch.clientSecret !== undefined) setSetting(`oauth.${provider}.clientSecret`, patch.clientSecret || null)
    }
    clearDiscoverCache()
    return c.json({ ok: true })
  })
