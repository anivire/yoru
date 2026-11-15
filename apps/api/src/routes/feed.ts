import { noteInputSchema } from '@yoru/shared'
import { Hono } from 'hono'
import { type AppEnv, requireAuth } from '../lib/auth'
import { intParam, parseBody } from '../lib/validate'
import { ensureAnime, getAnimeRow } from '../services/anime'
import { animeNotesFor, createNote, deleteNote, feedPage, updateNote } from '../services/feed'

export const feedRoutes = new Hono<AppEnv>().use(requireAuth).get('/', (c) =>
  c.json(
    feedPage(c.get('user').id, {
      before: c.req.query('before') || null,
      limit: Number(c.req.query('limit')) || 150,
    }),
  ),
)

export const noteRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/anime/:malId', (c) => c.json(animeNotesFor(c.get('user').id, intParam(c, 'malId'))))
  .post('/anime/:malId', async (c) => {
    const malId = intParam(c, 'malId')
    const input = await parseBody(c, noteInputSchema)
    if (!getAnimeRow(malId)) await ensureAnime(malId)
    return c.json(createNote(c.get('user').id, malId, input))
  })
  .patch('/:id', async (c) => c.json(updateNote(c.get('user').id, intParam(c, 'id'), await parseBody(c, noteInputSchema))))
  .delete('/:id', (c) => {
    deleteNote(c.get('user').id, intParam(c, 'id'))
    return c.json({ ok: true })
  })
