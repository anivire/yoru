import fs from 'node:fs'
import path from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './env'
import type { AppEnv } from './lib/auth'
import { UpstreamError } from './lib/http'
import { sessionUser } from './lib/auth'
import { adminRoutes } from './routes/admin'
import { animeRoutes } from './routes/anime'
import { authRoutes } from './routes/auth'
import { discoverRoutes, scheduleRoutes } from './routes/discover'
import { importRoutes } from './routes/import'
import { publicRoutes } from './routes/public'
import { homeRoutes, listRoutes, progressRoutes } from './routes/list'
import { meRoutes } from './routes/me'
import { notificationRoutes } from './routes/notifications'
import { feedRoutes, noteRoutes } from './routes/feed'
import { roomRoutes } from './routes/rooms'
import { statsRoutes } from './routes/stats'
import { streamRoutes } from './routes/stream'
import { buildInfo, versionInfo } from './services/version'

export const app = new Hono<AppEnv>()

app.use(logger((line) => (line.includes('/api/progress') ? undefined : console.log(line))))
app.use(secureHeaders({ crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false, contentSecurityPolicy: undefined }))

app.get('/api/health', (c) => c.json({ ok: true }))
app.get('/api/build', (c) => {
  c.header('Cache-Control', 'no-store')
  return c.json(buildInfo())
})
app.get('/api/version', async (c) => c.json(await versionInfo(Boolean(sessionUser(c)))))
app.route('/api/auth', authRoutes)
app.route('/api/me', meRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/anime', animeRoutes)
app.route('/api/list', listRoutes)
app.route('/api/progress', progressRoutes)
app.route('/api/home', homeRoutes)
app.route('/api/stream', streamRoutes)
app.route('/api/stats', statsRoutes)
app.route('/api/rooms', roomRoutes)
app.route('/api/feed', feedRoutes)
app.route('/api/notes', noteRoutes)
app.route('/api/notifications', notificationRoutes)
app.route('/api/import', importRoutes)
app.route('/api/discover', discoverRoutes)
app.route('/api/schedule', scheduleRoutes)
app.route('/api/public', publicRoutes)
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

if (env.webDist && fs.existsSync(env.webDist)) {
  const root = path.relative(process.cwd(), env.webDist) || '.'
  const indexHtml = fs.readFileSync(path.join(env.webDist, 'index.html'), 'utf8')
  app.use(
    '/assets/*',
    serveStatic({
      root,
      onFound: (_path, c) => {
        c.header('Cache-Control', 'public, max-age=31536000, immutable')
      },
    }),
  )
  app.all('/assets/*', (c) => c.text('Not found', 404))
  app.use(
    '*',
    serveStatic({
      root,
      onFound: (_path, c) => {
        c.header('Cache-Control', 'no-cache')
      },
    }),
  )
  app.get('*', (c) => {
    c.header('Cache-Control', 'no-cache')
    return c.html(indexHtml)
  })
}

app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
  if (error instanceof UpstreamError) {
    const status = error.status === 404 ? 404 : 502
    return c.json({ error: error.message, service: error.service }, status)
  }
  console.error(error)
  return c.json({ error: 'Internal error' }, 500)
})
