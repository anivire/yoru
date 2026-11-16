import { Hono } from 'hono'
import { type AppEnv, requireAuth } from '../lib/auth'
import { featureEnabled } from '../lib/features'
import { notFound } from '../lib/http'
import { collection, isCollection, memoized, recentReleases, schedule, trending } from '../services/discover'
import { shikimori } from '../services/shikimori'

export const discoverRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .use(async (c, next) => {
    await next()
    if (c.res.ok) c.header('Cache-Control', 'private, max-age=300')
  })
  .get('/recent', async (c) => c.json(await recentReleases().catch(() => [])))
  .get('/trending', async (c) => {
    const genre = Number(c.req.query('genre')) || null
    return c.json(await trending(genre).catch(() => []))
  })
  .get('/genres', async (c) => {
    const locale = c.get('user').locale === 'en' ? 'en' : 'ru'
    if (!featureEnabled('discover')) return c.json([])
    return c.json(await memoized(`genres:${locale}`, () => shikimori.genres(locale)).catch(() => []))
  })
  .get('/:name', async (c) => {
    const name = c.req.param('name')
    if (!isCollection(name)) notFound()
    return c.json(await collection(name).catch(() => []))
  })

export const scheduleRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', async (c) => c.json(await schedule(c.get('user').id, c.req.query('from'), c.req.query('to'))))
