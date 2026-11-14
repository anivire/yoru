import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { IMPORT_PROVIDERS, type ImportProvider, type ImportStatus } from '@yoru/shared'
import { db } from '../db/client'
import { imports } from '../db/schema'
import { env } from '../env'
import { type AppEnv, requireAuth } from '../lib/auth'
import { badRequest } from '../lib/http'
import { applyImport, consumeState, createAuthorizeUrl, fetchProviderList, providerEnabled } from '../services/importers'

function providerParam(value: string): ImportProvider {
  if (!IMPORT_PROVIDERS.includes(value as ImportProvider)) badRequest('Unknown provider')
  return value as ImportProvider
}

function backTo(params: Record<string, string>) {
  return `${env.appUrl}/settings/import?${new URLSearchParams(params)}`
}

export const importRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/status', (c) => {
    const last = db.select().from(imports).where(eq(imports.userId, c.get('user').id)).orderBy(desc(imports.createdAt)).get()
    const body: ImportStatus = {
      providers: Object.fromEntries(IMPORT_PROVIDERS.map((p) => [p, providerEnabled(p)])) as ImportStatus['providers'],
      last: last
        ? {
            provider: last.provider as ImportProvider,
            imported: last.imported,
            updated: last.updated,
            skipped: last.skipped,
            createdAt: last.createdAt,
          }
        : null,
    }
    return c.json(body)
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
    try {
      const items = await fetchProviderList(provider, code, saved.codeVerifier)
      const result = applyImport(saved.userId, provider, items)
      return c.redirect(
        backTo({ provider, imported: String(result.imported), updated: String(result.updated), skipped: String(result.skipped) }),
      )
    } catch (error) {
      console.warn(`[import:${provider}]`, (error as Error).message)
      return c.redirect(backTo({ provider, error: 'failed' }))
    }
  })
