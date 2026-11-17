import { desc, eq, isNotNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  type AdminSettings,
  type AdminUser,
  type DataSourceId,
  type FeatureId,
  type ExtensionUpdateResult,
  type ImportProvider,
  type Invite,
  type ProviderCategory,
  type ProviderGroup,
  type ProviderEntryInfo,
  type ProvidersSettings,
  type ReleaseStatus,
  IMPORT_PROVIDERS,
  DATA_SOURCES,
  FEATURES,
  PROVIDER_GROUPS,
  RELEASE_SOURCES,
  adminSettingsSchema,
  extensionInstallSchema,
  extensionPatchSchema,
  inviteInputSchema,
  providerOrderSchema,
} from '@yoru/shared'
import { db, now } from '../db/client'
import { invites, notifications, providerReleases, users } from '../db/schema'
import { env } from '../env'
import { type AppEnv, requireAdmin, requireAuth } from '../lib/auth'
import { randomToken } from '../lib/crypto'
import { featureEnabled, setFeatureEnabled } from '../lib/features'
import { badRequest } from '../lib/http'
import { getSetting, setSetting } from '../lib/settings'
import { groupEntries, knownProviders, primaryProvider, setGroupEntries } from '../providers/chain'
import { installExtension, listExtensions, patchExtension, removeExtension, updateExtension } from '../extensions/manager'
import { githubConfig, kodikToken, oauthConfig, setSourceEnabled, setSourceUrl } from '../lib/sources'
import { intParam, parseBody } from '../lib/validate'
import { clearDiscoverCache } from '../services/discover'
import { oauthConfigured, providerEnabled, redirectUri } from '../services/importers'
import { resetSourceStatus, sourceInfos } from '../services/sources'
import { removeAvatar } from './users'
import { lastReleaseRun, releaseChecks } from '../jobs/release-watcher'
import { moderationRoutes } from './moderation'
import { avatarUrl } from '../services/social'

const usedByUser = alias(users, 'used_by_user')
const SINGLE_USE_SOURCES = ['jikan', 'kitsu', 'anilibria', 'kodik']

function listInvites(): Invite[] {
  const joined = new Map<number, Invite['joined']>()
  for (const user of db.select({ inviteId: users.inviteId, username: users.username, displayName: users.displayName }).from(users).where(isNotNull(users.inviteId)).orderBy(desc(users.createdAt)).all()) {
    const list = joined.get(user.inviteId!) ?? []
    list.push({ username: user.username, displayName: user.displayName })
    joined.set(user.inviteId!, list)
  }
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
      multiUse: invite.multiUse,
      uses: invite.uses,
      joined: joined.get(invite.id) ?? [],
    }))
}

export const adminRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireAdmin)
  .route('/moderation', moderationRoutes)
  .get('/invites', (c) => c.json(listInvites()))
  .post('/invites', async (c) => {
    const input = await parseBody(c, inviteInputSchema)
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null
    db.insert(invites)
      .values({ code: randomToken(12), note: input.note ?? null, multiUse: input.multiUse ?? false, createdBy: c.get('user').id, createdAt: now(), expiresAt })
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
        displayName: users.displayName,
        avatarVersion: users.avatarVersion,
        avatarCrop: users.avatarCrop,
        role: users.role,
        createdAt: users.createdAt,
        entries: sql<number>`(select count(*) from "list_entries" as "le" where "le"."user_id" = "users"."id")`,
        friends: sql<number>`(select count(*) from "friendships" as "f" where "f"."status" = 'accepted' and ("f"."user_id" = "users"."id" or "f"."friend_id" = "users"."id"))`,
        comments: sql<number>`(select count(*) from "comments" as "cm" where "cm"."user_id" = "users"."id")`,
      })
      .from(users)
      .orderBy(users.createdAt)
      .all()
      .map(({ avatarVersion, avatarCrop, ...row }) => ({ ...row, avatarUrl: avatarUrl(row.id, avatarVersion), avatarCrop: avatarVersion ? avatarCrop : null }))
    return c.json(rows)
  })
  .delete('/users/:id', (c) => {
    const id = intParam(c, 'id')
    if (id === c.get('user').id) throw new HTTPException(400, { message: 'CANNOT_DELETE_SELF' })
    removeAvatar(id)
    db.delete(users).where(eq(users.id, id)).run()
    return c.json({ ok: true })
  })
  .get('/extensions', (c) => c.json(listExtensions()))
  .post('/extensions', async (c) => {
    const id = await installExtension(await parseBody(c, extensionInstallSchema))
    return c.json({ id })
  })
  .post('/extensions/:id/update', async (c) => {
    const id = c.req.param('id')
    const body: ExtensionUpdateResult = { id, ...(await updateExtension(id)) }
    return c.json(body)
  })
  .patch('/extensions/:id', async (c) => {
    patchExtension(c.req.param('id'), await parseBody(c, extensionPatchSchema))
    return c.json({ ok: true })
  })
  .delete('/extensions/:id', (c) => {
    removeExtension(c.req.param('id'))
    return c.json({ ok: true })
  })
  .get('/providers', (c) => {
    const body = Object.fromEntries(
      PROVIDER_GROUPS.map((group) => {
        const categories: ProviderCategory[] = group === 'video' ? ['video'] : ['metadata', 'search']
        return [
          group,
          groupEntries(group).map((entry): ProviderEntryInfo => {
            const providers = categories.flatMap((category) => knownProviders(category).filter((p) => p.id === entry.id).map((p) => ({ category, p })))
            const first = providers[0]!.p
            const extension = entry.id.startsWith('ext:') ? entry.id.slice(4) : null
            return {
              id: entry.id,
              name: first.name,
              roles: providers.map(({ category }) => category),
              source: !extension && DATA_SOURCES.includes(entry.id as DataSourceId) ? (entry.id as DataSourceId) : null,
              extension,
              enabled: entry.enabled,
              available: providers.some(({ p }) => p.available()),
            }
          }),
        ]
      }),
    ) as ProvidersSettings
    return c.json(body)
  })
  .put('/providers/:group', async (c) => {
    const group = c.req.param('group') as ProviderGroup
    if (!PROVIDER_GROUPS.includes(group)) badRequest('Invalid group')
    const { entries } = await parseBody(c, providerOrderSchema)
    setGroupEntries(group, entries)
    for (const entry of entries) {
      if (!DATA_SOURCES.includes(entry.id as DataSourceId)) continue
      if (entry.enabled) setSourceEnabled(entry.id as DataSourceId, true)
      else if (SINGLE_USE_SOURCES.includes(entry.id)) setSourceEnabled(entry.id as DataSourceId, false)
    }
    return c.json({ ok: true })
  })
  .post('/sources/:id/check', (c) => {
    const id = c.req.param('id') as DataSourceId
    if (!DATA_SOURCES.includes(id)) badRequest('Invalid source')
    resetSourceStatus(id)
    return c.json(sourceInfos())
  })
  .get('/releases', (c) => {
    const checks = releaseChecks()
    const since = new Date(Date.now() - 86_400_000).toISOString()
    const notified = new Map(
      db
        .select({ provider: notifications.provider, last: sql<string>`max(${notifications.createdAt})`, recent: sql<number>`sum(case when ${notifications.createdAt} > ${since} then 1 else 0 end)` })
        .from(notifications)
        .groupBy(notifications.provider)
        .all()
        .map((row) => [row.provider, row]),
    )
    const lastRunAt = lastReleaseRun()
    const status: ReleaseStatus = {
      intervalMinutes: env.releasePollMinutes,
      lastRunAt,
      nextRunAt: lastRunAt ? new Date(Date.parse(lastRunAt) + env.releasePollMinutes * 60_000).toISOString() : null,
      sources: RELEASE_SOURCES.map((id) => {
        const found = db.select({ releasedAt: providerReleases.releasedAt }).from(providerReleases).where(eq(providerReleases.provider, id)).orderBy(sql`rowid desc`).limit(1).get()
        const sent = notified.get(id)
        return {
          id,
          checkedAt: checks[id]?.checkedAt ?? null,
          error: checks[id]?.error ?? null,
          lastFoundAt: found?.releasedAt ?? null,
          lastNotifiedAt: sent?.last ?? null,
          notified24h: Number(sent?.recent ?? 0),
        }
      }),
    }
    return c.json(status)
  })
  .get('/settings', (c) => {
    const github = githubConfig()
    const body: AdminSettings = {
      hasAnime365Token: Boolean(getSetting('anime365_token') || env.anime365Token),
      hasKodikToken: Boolean(kodikToken()),
      features: Object.fromEntries(FEATURES.map((id) => [id, featureEnabled(id)])) as AdminSettings['features'],
      importProviders: Object.fromEntries(IMPORT_PROVIDERS.map((p) => [p, providerEnabled(p)])) as AdminSettings['importProviders'],
      metadataSource: primaryProvider('metadata') === 'anime365' ? 'anime365' : 'jikan',
      sources: sourceInfos(),
      github: { repo: github.repo, branch: github.branch, defaultRepo: env.githubRepo, defaultBranch: env.githubBranch, hasToken: Boolean(github.token) },
      oauth: Object.fromEntries(
        IMPORT_PROVIDERS.map((p) => {
          const config = oauthConfig(p)
          return [
            p,
            {
              configured: oauthConfigured(p),
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
    for (const [id, enabled] of Object.entries(input.features ?? {}) as [FeatureId, boolean | undefined][]) {
      if (enabled !== undefined) setFeatureEnabled(id, enabled)
    }
    if (input.features?.discover !== undefined) clearDiscoverCache()
    if (input.kodikToken !== undefined) {
      setSetting('kodik_token', input.kodikToken || null)
      resetSourceStatus('kodik')
    }
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
