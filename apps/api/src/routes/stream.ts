import { Hono } from 'hono'
import { STREAM_KINDS, type StreamKind } from '@yoru/shared'
import { type AppEnv, requireAuth } from '../lib/auth'
import { badRequest } from '../lib/http'
import { intParam } from '../lib/validate'
import { listTranslations, streamTranslation, subtitlesFor } from '../services/provider'

export const streamRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/:malId/translations', async (c) => {
    const episode = Number(c.req.query('episode'))
    const kind = c.req.query('kind') as StreamKind
    if (!Number.isInteger(episode) || episode <= 0) badRequest('Invalid episode')
    if (!STREAM_KINDS.includes(kind)) badRequest('Invalid kind')
    return c.json(await listTranslations(intParam(c, 'malId'), episode, kind))
  })
  .get('/translation/:id', async (c) => {
    const author = c.req.query('author') ?? ''
    return c.json(await streamTranslation(c.get('user'), intParam(c, 'id'), author))
  })
  .get('/subtitles/:id', (c) => subtitlesFor(c.get('user'), intParam(c, 'id')))
