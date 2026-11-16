import { commentInputSchema, noteInputSchema, reactionInputSchema } from '@yoru/shared'
import { z } from 'zod'
import { Hono } from 'hono'
import { type AppEnv, requireAuth } from '../lib/auth'
import { intParam, parseBody } from '../lib/validate'
import { ensureAnime, getAnimeRow } from '../services/anime'
import { animeNotesFor, createNote, deleteNote, feedPage, updateNote } from '../services/feed'
import { addComment, deleteComment, editComment, listComments, toggleReaction } from '../services/interactions'

function feedScope(value: string | undefined) {
  return value === 'friends' || value === 'all' ? value : 'me'
}

export const feedRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) =>
    c.json(
      feedPage(c.get('user').id, {
        before: c.req.query('before') || null,
        limit: Number(c.req.query('limit')) || 150,
        scope: feedScope(c.req.query('scope')),
      }),
    ),
  )
  .post('/:id/reaction', async (c) => {
    const { emoji } = await parseBody(c, reactionInputSchema)
    toggleReaction(c.get('user').id, intParam(c, 'id'), emoji)
    return c.json({ ok: true })
  })

const commentTextSchema = z.object({ text: z.string().trim().min(1).max(1000) })

export const commentRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => {
    const target = c.req.query('target') === 'note' ? 'note' : 'event'
    const id = Number(c.req.query('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json([])
    return c.json(listComments(c.get('user'), target, id))
  })
  .post('/', async (c) => {
    const input = await parseBody(c, commentInputSchema)
    return c.json(addComment(c.get('user'), input.target, input.id, input.text))
  })
  .patch('/:id', async (c) => c.json(editComment(c.get('user'), intParam(c, 'id'), (await parseBody(c, commentTextSchema)).text)))
  .delete('/:id', (c) => {
    deleteComment(c.get('user'), intParam(c, 'id'))
    return c.json({ ok: true })
  })

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
    const user = c.get('user')
    deleteNote(user.id, intParam(c, 'id'), user.role === 'admin')
    return c.json({ ok: true })
  })
