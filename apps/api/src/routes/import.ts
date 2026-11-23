import { desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { IMPORT_PROVIDERS, type ImportProvider, type ImportSource, type ImportStatus } from '@yoru/shared'
import { db } from '../db/client'
import { imports, watchProgress } from '../db/schema'
import { env } from '../env'
import { type AppEnv, requireAuth } from '../lib/auth'
import { badRequest } from '../lib/http'
import { applyImport, consumeState, createAuthorizeUrl, fetchProviderList, providerEnabled } from '../services/importers'
import { parseSeanimeExport } from '../services/seanime'
import { parseYoruExport } from '../services/yoru-import'

const MAX_FILE_BYTES = 64 * 1024 * 1024

function providerParam(value: string): ImportProvider {
  if (!IMPORT_PROVIDERS.includes(value as ImportProvider)) badRequest('Unknown provider')
  return value as ImportProvider
}

const running = new Map<number, { provider: ImportProvider; failed: boolean }>()

function backTo(params: Record<string, string>) {
  return `${env.appUrl}/settings/import?${new URLSearchParams(params)}`
}

export const importRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/status', (c) => {
    const userId = c.get('user').id
    const last = db.select().from(imports).where(eq(imports.userId, userId)).orderBy(desc(imports.createdAt)).get()
    const job = running.get(userId)
    if (job?.failed) running.delete(userId)
    const body: ImportStatus = {
      running: job && !job.failed ? job.provider : null,
      failed: job?.failed ? job.provider : null,
      providers: Object.fromEntries(IMPORT_PROVIDERS.map((p) => [p, providerEnabled(p)])) as ImportStatus['providers'],
      last: last
        ? {
            provider: last.provider as ImportSource,
            imported: last.imported,
            updated: last.updated,
            skipped: last.skipped,
            createdAt: last.createdAt,
          }
        : null,
    }
    return c.json(body)
  })
  .post('/seanime', async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) badRequest('SEANIME_NO_FILE')
    if (file.size > MAX_FILE_BYTES) badRequest('SEANIME_TOO_LARGE')
    const items = parseSeanimeExport(Buffer.from(await file.arrayBuffer()))
    return c.json(applyImport(c.get('user').id, 'seanime', items))
  })
  .post('/yoru', async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) badRequest('YORU_INVALID')
    if (file.size > MAX_FILE_BYTES) badRequest('SEANIME_TOO_LARGE')
    const { items, progress } = parseYoruExport(Buffer.from(await file.arrayBuffer()))
    const userId = c.get('user').id
    const result = applyImport(userId, 'yoru', items)
    db.transaction((tx) => {
      for (const p of progress) {
        tx.insert(watchProgress)
          .values({ userId, ...p })
          .onConflictDoUpdate({
            target: [watchProgress.userId, watchProgress.malId, watchProgress.episode],
            set: { position: p.position, duration: p.duration, updatedAt: p.updatedAt },
            setWhere: sql`${watchProgress.updatedAt} < ${p.updatedAt}`,
          })
          .run()
      }
    })
    return c.json(result)
  })
  .get('/:provider/start', (c) => {
    const provider = providerParam(c.req.param('provider'))
    if (!providerEnabled(provider)) badRequest('PROVIDER_NOT_CONFIGURED')
    return c.redirect(createAuthorizeUrl(c.get('user').id, provider))
  })
  .get('/:provider/callback', async (c) => {
    const provider = providerParam(c.req.param('provider'))
    const code = c.req.query('code')
    const state = c.req.query('state') ?? ''
    if (!code) return c.redirect(backTo({ provider, error: c.req.query('error') ?? 'denied' }))
    const saved = consumeState(provider, state)
    if (!saved || saved.userId !== c.get('user').id) return c.redirect(backTo({ provider, error: 'state' }))
    const userId = saved.userId
    if (running.get(userId)?.failed === false) return c.redirect(backTo({ provider, started: '1' }))
    running.set(userId, { provider, failed: false })
    fetchProviderList(provider, code, saved.codeVerifier)
      .then((items) => {
        applyImport(userId, provider, items)
        running.delete(userId)
      })
      .catch((error: Error) => {
        console.warn(`[import:${provider}]`, error.message)
        running.set(userId, { provider, failed: true })
      })
    return c.redirect(backTo({ provider, started: '1' }))
  })
