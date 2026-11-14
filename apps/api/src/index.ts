import { serve } from '@hono/node-server'
import { eq } from 'drizzle-orm'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'
import { app } from './app'
import { db, now, runMigrations } from './db/client'
import { invites, users } from './db/schema'
import { env } from './env'
import { startAnimeBackfill } from './jobs/anime-backfill'
import { startReleaseWatcher } from './jobs/release-watcher'
import { hashPassword, randomToken } from './lib/crypto'

if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
  console.log('[yoru] outbound requests go through HTTP(S)_PROXY')
}

async function bootstrapAdmin() {
  const admin = db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).get()
  if (admin) return
  if (env.adminUsername && env.adminPassword) {
    db.insert(users)
      .values({ username: env.adminUsername, passwordHash: await hashPassword(env.adminPassword), role: 'admin', createdAt: now() })
      .run()
    console.log(`[yoru] admin "${env.adminUsername}" created from ADMIN_USERNAME/ADMIN_PASSWORD`)
    return
  }
  const pending = db.select().from(invites).where(eq(invites.role, 'admin')).all().find((i) => !i.usedAt)
  const code = pending?.code ?? randomToken(12)
  if (!pending) db.insert(invites).values({ code, role: 'admin', note: 'bootstrap', createdAt: now() }).run()
  console.log(`[yoru] no admin yet, create one at ${env.appUrl}/invite/${code}`)
}

runMigrations()
await bootstrapAdmin()
startReleaseWatcher()
startAnimeBackfill()

serve({ fetch: app.fetch, port: env.port, hostname: env.host }, (info) => {
  console.log(`[yoru] api listening on http://${info.address}:${info.port}`)
})
