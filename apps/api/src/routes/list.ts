import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  EXPORT_FORMATS,
  type ExportFormat,
  LIST_STATUSES,
  type ListResponse,
  type ListStatus,
  listEntryInputSchema,
  progressInputSchema,
} from '@yoru/shared'
import { db, now } from '../db/client'
import { watchProgress } from '../db/schema'
import { type AppEnv, requireAuth } from '../lib/auth'
import { badRequest } from '../lib/http'
import { intParam, parseBody } from '../lib/validate'
import { airedEpisodes, ensureAnime, getAnimeRow } from '../services/anime'
import { exportList } from '../services/export'
import { activityData, logEpisodes, syncListActivity } from '../services/activity'
import { homeData } from '../services/home'
import { type ListFilters, allEntries, deleteEntry, filterEntries, listCounts, markWatched, saveEntry } from '../services/lists'

const SORTS = ['updated', 'title', 'score', 'progress', 'year', 'added'] as const
const DEFAULT_PAGE = 48
const MAX_PAGE = 200

export const listRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => {
    const userId = c.get('user').id
    const status = c.req.query('status') as ListStatus | undefined
    const sort = c.req.query('sort') as ListFilters['sort']
    const filters: ListFilters = {
      status: status && LIST_STATUSES.includes(status) ? status : undefined,
      q: c.req.query('q') || undefined,
      type: c.req.query('type') || undefined,
      genre: c.req.query('genre') || undefined,
      year: Number(c.req.query('year')) || undefined,
      sort: sort && SORTS.includes(sort) ? sort : 'score',
    }
    const all = allEntries(userId)
    const filtered = filterEntries(all, filters)
    const offset = Math.max(0, Number(c.req.query('offset')) || 0)
    const limit = Math.min(MAX_PAGE, Math.max(1, Number(c.req.query('limit')) || DEFAULT_PAGE))
    const body: ListResponse = {
      items: filtered.slice(offset, offset + limit),
      counts: listCounts(userId),
      total: filtered.length,
      offset,
      facets: {
        years: [...new Set(all.map((e) => e.anime.year).filter((y): y is number => Boolean(y)))].sort((a, b) => b - a),
        types: [...new Set(all.map((e) => e.anime.type).filter((v): v is string => Boolean(v)))],
      },
    }
    return c.json(body)
  })
  .get('/export', (c) => {
    const format = c.req.query('format') as ExportFormat
    if (!EXPORT_FORMATS.includes(format)) badRequest('Unknown format')
    const user = c.get('user')
    const file = exportList(format, allEntries(user.id), user.username)
    return c.body(file.body, 200, {
      'Content-Type': file.type,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    })
  })
  .put('/:malId', async (c) => {
    const malId = intParam(c, 'malId')
    const input = await parseBody(c, listEntryInputSchema)
    const row = getAnimeRow(malId) ?? (await ensureAnime(malId))
    return c.json(saveEntry(c.get('user').id, malId, input, row.episodes, airedEpisodes(row)))
  })
  .delete('/:malId', (c) => {
    deleteEntry(c.get('user').id, intParam(c, 'malId'))
    return c.json({ ok: true })
  })

export const progressRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .put('/:malId/:episode', async (c) => {
    const malId = intParam(c, 'malId')
    const episode = intParam(c, 'episode')
    const { position, duration } = await parseBody(c, progressInputSchema)
    const userId = c.get('user').id
    const values = { position, duration, updatedAt: now() }
    db.insert(watchProgress)
      .values({ userId, malId, episode, ...values })
      .onConflictDoUpdate({ target: [watchProgress.userId, watchProgress.malId, watchProgress.episode], set: values })
      .run()
    const row = getAnimeRow(malId) ?? (await ensureAnime(malId))
    if (duration > 0 && position / duration >= 0.85) {
      logEpisodes(userId, malId, [episode])
      markWatched(userId, malId, episode, row.episodes)
    }
    return c.json({ ok: true })
  })
  .delete('/:malId/:episode', (c) => {
    db.delete(watchProgress)
      .where(
        and(
          eq(watchProgress.userId, c.get('user').id),
          eq(watchProgress.malId, intParam(c, 'malId')),
          eq(watchProgress.episode, intParam(c, 'episode')),
        ),
      )
      .run()
    return c.json({ ok: true })
  })

export const homeRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', async (c) => c.json(await homeData(c.get('user').id)))
  .get('/activity', (c) => c.json(activityData(c.get('user').id, c.req.query('tz'))))
  .post('/activity/sync', (c) => c.json({ episodes: syncListActivity(c.get('user').id) }))
