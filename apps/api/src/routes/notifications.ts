import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { type NotificationList, type NotificationSources, TRANSLATION_SOURCES } from '@yoru/shared'
import { db, now } from '../db/client'
import { anime, comments, notifications, socialNotifications, users } from '../db/schema'
import { type AppEnv, requireAuth } from '../lib/auth'
import { parseBody } from '../lib/validate'
import { activeCalendars } from '../jobs/release-watcher'
import { isActive } from '../providers/chain'
import { cardColumns, hiddenUserIds, toCard } from '../services/social'

const readSchema = z.object({ ids: z.array(z.number().int()).max(500).optional(), socialIds: z.array(z.number().int()).max(500).optional() })

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
    const hidden = hiddenUserIds(userId)
    const social = db
      .select({ n: socialNotifications, actor: cardColumns, title: anime.title, titleEnglish: anime.titleEnglish, titleJapanese: anime.titleJapanese, titleRussian: anime.titleRussian, imageUrl: anime.imageUrl })
      .from(socialNotifications)
      .innerJoin(users, eq(users.id, socialNotifications.actorId))
      .leftJoin(anime, eq(anime.malId, socialNotifications.malId))
      .where(eq(socialNotifications.userId, userId))
      .orderBy(desc(socialNotifications.createdAt))
      .limit(50)
      .all()
      .filter((row) => !hidden.has(row.n.actorId))
    const commentIds = social.filter((row) => row.n.type === 'comment' && row.n.refId).map((row) => row.n.refId!)
    const commentTargets = new Map(
      commentIds.length
        ? db.select({ id: comments.id, type: comments.targetType, targetId: comments.targetId }).from(comments).where(inArray(comments.id, commentIds)).all().map((c) => [c.id, { type: c.type, id: c.targetId }] as const)
        : [],
    )
    const socialUnread = db
      .select({ count: sql<number>`count(*)` })
      .from(socialNotifications)
      .where(and(eq(socialNotifications.userId, userId), isNull(socialNotifications.readAt)))
      .get()!.count
    const body: NotificationList = {
      unread: unread + socialUnread,
      social: social.map(({ n, actor, title, titleEnglish, titleJapanese, titleRussian, imageUrl }) => ({
        id: n.id,
        type: n.type,
        actor: toCard(actor),
        malId: n.malId,
        titles: title ? { title, titleEnglish: titleEnglish ?? null, titleJapanese: titleJapanese ?? null, titleRussian: titleRussian || null } : null,
        imageUrl: imageUrl ?? null,
        refId: n.refId,
        target: n.type === 'reaction' && n.refId ? { type: 'event', id: n.refId } : n.type === 'comment' && n.refId ? (commentTargets.get(n.refId) ?? null) : null,
        text: n.text,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      items: items.map(({ n, title, titleEnglish, titleJapanese, titleRussian, imageUrl }) => ({
        id: n.id,
        malId: n.malId,
        episode: n.episode,
        type: n.type,
        kind: n.kind,
        source: n.provider,
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
  .get('/unread', (c) => {
    const userId = c.get('user').id
    const count = (table: typeof notifications | typeof socialNotifications) =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(table)
        .where(and(eq(table.userId, userId), isNull(table.readAt)))
        .get()!.count
    return c.json({ unread: count(notifications) + count(socialNotifications) })
  })
  .get('/sources', (c) => {
    const body: NotificationSources = {
      translations: TRANSLATION_SOURCES.filter((id) => isActive('video', id)),
      calendars: activeCalendars(),
    }
    return c.json(body)
  })
  .post('/read', async (c) => {
    const { ids, socialIds } = await parseBody(c, readSchema)
    const userId = c.get('user').id
    const all = !ids?.length && !socialIds?.length
    if (all || ids?.length) {
      const where = ids?.length
        ? and(eq(notifications.userId, userId), inArray(notifications.id, ids), isNull(notifications.readAt))
        : and(eq(notifications.userId, userId), isNull(notifications.readAt))
      db.update(notifications).set({ readAt: now() }).where(where).run()
    }
    if (all || socialIds?.length) {
      const where = socialIds?.length
        ? and(eq(socialNotifications.userId, userId), inArray(socialNotifications.id, socialIds), isNull(socialNotifications.readAt))
        : and(eq(socialNotifications.userId, userId), isNull(socialNotifications.readAt))
      db.update(socialNotifications).set({ readAt: now() }).where(where).run()
    }
    return c.json({ ok: true })
  })
  .delete('/', (c) => {
    db.delete(notifications).where(eq(notifications.userId, c.get('user').id)).run()
    db.delete(socialNotifications).where(eq(socialNotifications.userId, c.get('user').id)).run()
    return c.json({ ok: true })
  })
