import { serve } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { eq } from 'drizzle-orm'
import { app } from './app'
import { db, now, runMigrations } from './db/client'
import { invites, users } from './db/schema'
import { env } from './env'
import { startAnimeBackfill } from './jobs/anime-backfill'
import { startRussianTitles } from './jobs/russian-titles'
import { startReleaseWatcher } from './jobs/release-watcher'
import { backfillAllFeeds } from './services/feed'
import { loadExtensions } from './extensions/manager'
import { hashPassword, randomToken } from './lib/crypto'

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
loadExtensions()
await bootstrapAdmin()
startReleaseWatcher()
startAnimeBackfill()
startRussianTitles()
backfillAllFeeds()

for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => process.exit(0))

serve({ fetch: app.fetch, port: env.port, hostname: env.host, websocket: { server: new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 }) } }, (info) => {
  console.log(`[yoru] api listening on http://${info.address}:${info.port}`)
})
