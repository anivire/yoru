import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { NotificationList } from '@yoru/shared'
import { db, now } from '../db/client'
import { anime, notifications } from '../db/schema'
import { type AppEnv, requireAuth } from '../lib/auth'
import { parseBody } from '../lib/validate'

const readSchema = z.object({ ids: z.array(z.number().int()).max(500).optional() })

export const notificationRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => {
    const userId = c.get('user').id
    const items = db
      .select({ n: notifications, title: anime.title, titleEnglish: anime.titleEnglish, titleJapanese: anime.titleJapanese, titleRussian: anime.titleRussian, imageUrl: anime.imageUrl })
      .from(notifications)
      .leftJoin(anime, eq(anime.malId, notifications.malId))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
      .all()
    const unread = db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .get()!.count
    const body: NotificationList = {
      unread,
      items: items.map(({ n, title, titleEnglish, titleJapanese, titleRussian, imageUrl }) => ({
        id: n.id,
        malId: n.malId,
        episode: n.episode,
        type: n.type,
        kind: n.kind,
        author: n.author,
        animeTitle: title ?? `#${n.malId}`,
        titles: { title: title ?? `#${n.malId}`, titleEnglish: titleEnglish ?? null, titleJapanese: titleJapanese ?? null, titleRussian: titleRussian || null },
        imageUrl: imageUrl ?? null,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
    }
    return c.json(body)
  })
  .post('/read', async (c) => {
    const { ids } = await parseBody(c, readSchema)
    const userId = c.get('user').id
    const where = ids?.length
      ? and(eq(notifications.userId, userId), inArray(notifications.id, ids), isNull(notifications.readAt))
      : and(eq(notifications.userId, userId), isNull(notifications.readAt))
    db.update(notifications).set({ readAt: now() }).where(where).run()
    return c.json({ ok: true })
  })
  .delete('/', (c) => {
    db.delete(notifications).where(eq(notifications.userId, c.get('user').id)).run()
    return c.json({ ok: true })
  })
