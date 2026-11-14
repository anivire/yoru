import { Hono } from 'hono'
import { type AnimePage, type Genre, type ProviderCandidate, type SearchResult, providerMatchSchema } from '@yoru/shared'
import { type AppEnv, requireAuth } from '../lib/auth'
import { UpstreamError } from '../lib/http'
import { metadataSource } from '../lib/settings'
import { intParam, parseBody } from '../lib/validate'
import { ensureAnime, searchFallback, toDetails, upsertA365Summaries, upsertJikanSummaries } from '../services/anime'
import { anime365, seriesTitle } from '../services/anime365'
import { episodeList } from '../services/episodes'
import { jikan } from '../services/jikan'
import { getEntry, toEntry } from '../services/lists'
import { animeLinks } from '../services/links'
import { resolveMatch, setManualMatch } from '../services/provider'
import { shikimori } from '../services/shikimori'

const A365_PAGE = 24
const SEARCH_PARAMS = ['type', 'status', 'genres', 'order_by', 'sort', 'rating', 'min_score', 'start_date', 'end_date'] as const

export const animeRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/search', async (c) => {
    const q = c.req.query('q')?.trim() ?? ''
    const page = Math.max(1, Number(c.req.query('page')) || 1)
    const params = new URLSearchParams({ page: String(page), limit: '24', sfw: 'true' })
    if (q) params.set('q', q)
    for (const key of SEARCH_PARAMS) {
      const value = c.req.query(key)
      if (value) params.set(key, value)
    }
    const filtered = SEARCH_PARAMS.some((k) => c.req.query(k))
    if (metadataSource() === 'anime365') {
      const query: Record<string, string | number> = { limit: A365_PAGE, offset: (page - 1) * A365_PAGE }
      const type = c.req.query('type')
      const status = c.req.query('status')
      const genres = (c.req.query('genres') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0)
      if (q) query.query = q
      else if (genres.length) query.chips = `genre@=${genres.join(',')}`
      if (type) query.type = type
      if (status === 'airing' || (!q && !filtered)) query.isAiring = 1
      if (status === 'complete') query.isAiring = 0
      const rows = status === 'upcoming' ? [] : await anime365.list(query)
      const matching = q && genres.length ? rows.filter((s) => genres.every((g) => s.genres?.some((x) => x.id === g))) : rows
      const body: SearchResult = {
        items: upsertA365Summaries(matching),
        pagination: { page, hasNextPage: rows.length === A365_PAGE, total: null },
        source: 'anime365',
      }
      return c.json(body)
    }
    try {
      const res = !q && !filtered ? await jikan.seasonNow(page) : await jikan.search(params)
      const body: SearchResult = {
        items: upsertJikanSummaries(res.data),
        pagination: { page, hasNextPage: res.pagination.has_next_page, total: res.pagination.items?.total ?? null },
        source: 'jikan',
      }
      return c.json(body)
    } catch (error) {
      if (!(error instanceof UpstreamError) || !q) throw error
      const items = await searchFallback(q)
      const body: SearchResult = { items, pagination: { page: 1, hasNextPage: false, total: items.length }, source: 'anime365' }
      return c.json(body)
    }
  })
  .get('/genres', async (c) => {
    if (metadataSource() === 'anime365') return c.json(await anime365.genres().catch(() => [] as Genre[]))
    const genres = await jikan.genres().catch(() => [])
    const body: Genre[] = genres.map((g) => ({ id: g.mal_id, name: g.name, count: g.count }))
    return c.json(body)
  })
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
    const shots = await shikimori.screenshots(intParam(c, 'id')).catch(() => [] as string[])
    return c.json({ url: shots[0] ?? null })
  })
  .get('/:id/match', async (c) => c.json(await resolveMatch(intParam(c, 'id'))))
  .get('/:id/links', async (c) => c.json(await animeLinks(intParam(c, 'id'))))
  .put('/:id/match', async (c) => {
    const { providerId } = await parseBody(c, providerMatchSchema)
    return c.json(await setManualMatch(intParam(c, 'id'), providerId))
  })
