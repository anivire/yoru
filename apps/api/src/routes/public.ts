import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { PublicListResponse, PublicShareInfo, PublicStatsResponse } from '@yoru/shared'
import { db } from '../db/client'
import { users } from '../db/schema'
import { notFound } from '../lib/http'
import { userStats } from '../services/stats'
import { listPage } from './list'

function sharedOwner(token: string) {
  const owner = token.length >= 16 ? db.select({ id: users.id, username: users.username, list: users.shareList, stats: users.shareStats }).from(users).where(eq(users.shareToken, token)).get() : undefined
  if (!owner || (!owner.list && !owner.stats)) notFound('SHARE_NOT_FOUND')
  return owner
}

export const publicRoutes = new Hono()
  .get('/share/:token', (c) => {
    const owner = sharedOwner(c.req.param('token'))
    const body: PublicShareInfo = { username: owner.username, list: owner.list, stats: owner.stats }
    c.header('Cache-Control', 'public, max-age=60')
    return c.json(body)
  })
  .get('/stats/:token', (c) => {
    const owner = sharedOwner(c.req.param('token'))
    if (!owner.stats) notFound('SHARE_NOT_FOUND')
    const body: PublicStatsResponse = { ...userStats(owner.id, c.req.query('tz')), username: owner.username }
    c.header('Cache-Control', 'public, max-age=60')
    return c.json(body)
  })
  .get('/lists/:token', (c) => {
    const owner = sharedOwner(c.req.param('token'))
    if (!owner.list) notFound('SHARE_NOT_FOUND')
    const page = listPage(owner.id, (key) => c.req.query(key))
    const body: PublicListResponse = { ...page, items: page.items.map((e) => ({ ...e, notes: null })), username: owner.username }
    c.header('Cache-Control', 'public, max-age=60')
    return c.json(body)
  })
