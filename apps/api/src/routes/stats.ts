import { Hono } from 'hono'
import { type AppEnv, requireAuth } from '../lib/auth'
import { userStats } from '../services/stats'

export const statsRoutes = new Hono<AppEnv>().use(requireAuth).get('/', (c) => c.json(userStats(c.get('user').id, c.req.query('tz'))))
