import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { PublicListResponse } from '@yoru/shared'
import { db } from '../db/client'
import { users } from '../db/schema'
import { notFound } from '../lib/http'
import { listPage } from './list'

export const publicRoutes = new Hono().get('/lists/:token', (c) => {
  const token = c.req.param('token')
  const owner = token.length >= 16 ? db.select({ id: users.id, username: users.username }).from(users).where(eq(users.shareToken, token)).get() : undefined
  if (!owner) notFound('SHARE_NOT_FOUND')
  const page = listPage(owner.id, (key) => c.req.query(key))
  const body: PublicListResponse = { ...page, items: page.items.map((e) => ({ ...e, notes: null })), username: owner.username }
  c.header('Cache-Control', 'public, max-age=60')
  return c.json(body)
})
