import { Hono } from 'hono'
import { STREAM_KINDS, type StreamKind, type VideoProviderInfo } from '@yoru/shared'
import { type AppEnv, requireAuth } from '../lib/auth'
import { badRequest, notFound } from '../lib/http'
import { intParam } from '../lib/validate'
import { activeProviders } from '../providers/chain'
import { subtitlesFor } from '../services/provider'

function videoProvider(id: string) {
  return activeProviders('video').find((p) => p.id === id) ?? notFound('PROVIDER_UNAVAILABLE')
}

function episodeParam(value: string | undefined): number {
  const episode = Number(value)
  if (!Number.isInteger(episode) || episode <= 0) badRequest('Invalid episode')
  return episode
}

export const streamRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/providers', (c) => {
    const body: VideoProviderInfo[] = activeProviders('video').map((p) => ({ id: p.id, name: p.name, kinds: p.kinds, manualMatch: p.manualMatch }))
    return c.json(body)
  })
  .get('/subtitles/:id', (c) => subtitlesFor(c.get('user'), intParam(c, 'id')))
  .get('/:malId/:provider/episodes', async (c) => c.json(await videoProvider(c.req.param('provider')).episodes(intParam(c, 'malId'))))
  .get('/:malId/:provider/translations', async (c) => {
    const kind = c.req.query('kind') as StreamKind
    if (!STREAM_KINDS.includes(kind)) badRequest('Invalid kind')
    return c.json(await videoProvider(c.req.param('provider')).translations(intParam(c, 'malId'), episodeParam(c.req.query('episode')), kind))
  })
  .get('/:malId/:provider/stream', async (c) => {
    const translation = c.req.query('translation') ?? ''
    if (!translation) badRequest('Invalid translation')
    const provider = videoProvider(c.req.param('provider'))
    return c.json(await provider.stream(c.get('user'), intParam(c, 'malId'), episodeParam(c.req.query('episode')), translation, c.req.query('author') ?? ''))
  })
