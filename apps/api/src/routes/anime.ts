import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { type AnimePage, type ProviderCandidate, type Screenshot, type SkipTime, type WatchOrderEntry, providerMatchSchema } from '@yoru/shared'
import { type AppEnv, requireAuth } from '../lib/auth'
import { featureEnabled } from '../lib/features'
import { chainSignature } from '../providers/chain'
import { searchAnime, searchGenres } from '../providers/search'
import { intParam, parseBody } from '../lib/validate'
import { ensureAnime, toDetails } from '../services/anime'
import { anime365, seriesTitle } from '../services/anime365'
import { episodeList } from '../services/episodes'
import { getEntry, toEntry } from '../services/lists'
import { animeExtras, personPage } from '../services/extras'
import { animeLinks } from '../services/links'
import { resolveMatch, setManualMatch } from '../services/provider'
import { shikimori, shikiSummaries } from '../services/shikimori'
import { skipTimes } from '../services/aniskip'

const RESPONSE_TTL = 10 * 60_000
const RESPONSE_LIMIT = 500
const responses = new Map<string, { at: number; body: string }>()

const cacheResponse = createMiddleware<AppEnv>(async (c, next) => {
  const key = `${chainSignature('search')}:${c.req.path}?${new URL(c.req.url).searchParams.toString()}`
  const hit = responses.get(key)
  if (hit && Date.now() - hit.at < RESPONSE_TTL) {
    return c.body(hit.body, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' })
  }
  await next()
  if (!c.res.ok) return
  responses.set(key, { at: Date.now(), body: await c.res.clone().text() })
  if (responses.size > RESPONSE_LIMIT) responses.delete(responses.keys().next().value!)
  c.res.headers.set('Cache-Control', 'private, max-age=300')
})
const SEARCH_PARAMS = ['order_by', 'sort', 'rating', 'min_score', 'start_date', 'end_date'] as const

export const animeRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/search', cacheResponse, async (c) => {
    const params: Record<string, string> = {}
    for (const key of SEARCH_PARAMS) {
      const value = c.req.query(key)
      if (value) params[key] = value
    }
    return c.json(
      await searchAnime({
        q: c.req.query('q')?.trim() ?? '',
        page: Math.max(1, Number(c.req.query('page')) || 1),
        type: c.req.query('type') || undefined,
        status: c.req.query('status') || undefined,
        genres: (c.req.query('genres') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0),
        params,
      }),
    )
  })
  .get('/genres', cacheResponse, async (c) => c.json(await searchGenres()))
  .get('/seiyuu/:id', async (c) => c.json(await personPage(intParam(c, 'id'), Math.max(1, Number(c.req.query('page')) || 1))))
  .get('/match/search', async (c) => {
    const q = c.req.query('q')?.trim() ?? ''
    if (q.length < 2) return c.json([] as ProviderCandidate[])
    const rows = await anime365.search(q)
    const body: ProviderCandidate[] = rows.map((s) => ({
      providerId: s.id,
      title: seriesTitle(s),
      year: s.year ?? null,
      type: s.typeTitle ?? s.type ?? null,
      episodes: s.numberOfEpisodes ?? null,
      malId: s.myAnimeListId ?? null,
      posterUrl: s.posterUrl ?? null,
    }))
    return c.json(body)
  })
  .get('/:id', async (c) => {
    const malId = intParam(c, 'id')
    const row = await ensureAnime(malId)
    const entry = getEntry(c.get('user').id, malId)
    const body: AnimePage = { anime: toDetails(row), entry: entry ? toEntry(entry) : null }
    return c.json(body)
  })
  .get('/:id/episodes', async (c) => {
    const row = await ensureAnime(intParam(c, 'id'))
    return c.json(await episodeList(c.get('user').id, row))
  })
  .get('/:id/banner', async (c) => {
    const shots = featureEnabled('screenshots') ? await shikimori.screenshots(intParam(c, 'id')).catch(() => [] as string[]) : []
    return c.json({ url: shots[0] ?? null })
  })
  .get('/:id/extras', async (c) => c.json(await animeExtras(intParam(c, 'id'))))
  .get('/:id/franchise', async (c) => {
    const entries = featureEnabled('franchise') ? await shikimori.franchise(intParam(c, 'id')).catch(() => []) : []
    const cards = shikiSummaries(entries.map((e) => e.anime))
    return c.json(entries.map((e, i): WatchOrderEntry => ({ anime: cards[i]!, side: e.side, relation: e.relation })))
  })
  .get('/:id/screenshots', async (c) => c.json(featureEnabled('screenshots') ? await shikimori.gallery(intParam(c, 'id')).catch(() => [] as Screenshot[]) : []))
  .get('/:id/match', async (c) => c.json(await resolveMatch(intParam(c, 'id'))))
  .get('/:id/links', async (c) => c.json(await animeLinks(intParam(c, 'id'))))
  .get('/:id/skip/:episode', async (c) => {
    const length = Number(c.req.query('length'))
    const skips = await skipTimes(intParam(c, 'id'), intParam(c, 'episode'), Number.isFinite(length) && length > 0 ? length : 0).catch(() => [] as SkipTime[])
    return c.json(skips)
  })
  .put('/:id/match', async (c) => {
    const { providerId } = await parseBody(c, providerMatchSchema)
    return c.json(await setManualMatch(intParam(c, 'id'), providerId))
  })
