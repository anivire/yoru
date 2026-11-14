import { Hono } from 'hono'
import { type AppEnv, requireAuth } from '../lib/auth'
import { notFound } from '../lib/http'
import { collection, isCollection, recentReleases, schedule, trending } from '../services/discover'
import { shikimori } from '../services/shikimori'

export const discoverRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/recent', async (c) => c.json(await recentReleases().catch(() => [])))
  .get('/trending', async (c) => {
    const genre = Number(c.req.query('genre')) || null
    return c.json(await trending(genre).catch(() => []))
  })
  .get('/genres', async (c) => c.json(await shikimori.genres(c.get('user').locale === 'en' ? 'en' : 'ru').catch(() => [])))
  .get('/:name', async (c) => {
    const name = c.req.param('name')
    if (!isCollection(name)) notFound()
    return c.json(await collection(name).catch(() => []))
  })

export const scheduleRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', async (c) => c.json(await schedule(c.get('user').id, c.req.query('from'), c.req.query('to'))))
