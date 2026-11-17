import type { AnimeSummary } from '@yoru/shared'
import { inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { anime } from '../db/schema'
import { queueAnimeRefresh } from '../jobs/anime-backfill'
import { primaryMetadata } from '../providers/chain'
import { type AnimeRow, needsCard, toSummary, upsertAnime } from './anime'

const BATCH = 50
const BATCH_TIMEOUT_MS = 4000

const unknown = new Map<string, Set<number>>()

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

export async function refineCards(malIds: number[]): Promise<void> {
  const primary = primaryMetadata()
  if (!primary || !malIds.length) return
  const ids = [...new Set(malIds)]
  const rows = new Map(db.select().from(anime).where(inArray(anime.malId, ids)).all().map((r) => [r.malId, r]))
  const skip = unknown.get(primary.id) ?? new Set<number>()
  const stale = ids.filter((id) => needsCard(rows.get(id), primary.id) && !skip.has(id))
  if (!stale.length) return
  if (!primary.many) {
    queueAnimeRefresh(stale)
    return
  }
  const batch = stale.slice(0, BATCH)
  const items = await timeout(primary.many(batch), BATCH_TIMEOUT_MS).catch(() => null)
  if (!items) {
    queueAnimeRefresh(stale)
    return
  }
  for (const item of items) upsertAnime(item, { details: true, source: primary.id })
  const found = new Set(items.map((i) => i.malId))
  const missing = batch.filter((id) => !found.has(id))
  for (const id of missing) skip.add(id)
  unknown.set(primary.id, skip)
  queueAnimeRefresh([...missing, ...stale.slice(BATCH)])
}

export async function cards(items: AnimeSummary[]): Promise<AnimeSummary[]> {
  if (!items.length) return items
  await refineCards(items.map((i) => i.malId))
  const rows = new Map<number, AnimeRow>(db.select().from(anime).where(inArray(anime.malId, items.map((i) => i.malId))).all().map((r) => [r.malId, r]))
  return items.map((item) => {
    const row = rows.get(item.malId)
    return row ? toSummary(row) : item
  })
}
