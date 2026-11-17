import { and, isNotNull, isNull, ne, notInArray, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { anime, listEntries } from '../db/schema'
import { primaryMetadata } from '../providers/chain'
import { ensureAnime, needsCard } from '../services/anime'

const BATCH = 40
const INTERVAL_MS = 3 * 60_000
const WANTED_LIMIT = 500

const failed = new Set<number>()
const wanted = new Set<number>()
let running = false
let timer: NodeJS.Timeout | null = null

function pending(): number[] {
  const primary = primaryMetadata()?.id
  const queued = [...wanted].filter((id) => !failed.has(id)).slice(0, BATCH)
  if (queued.length) return queued
  return db
    .select({ malId: anime.malId })
    .from(anime)
    .where(
      and(
        primary ? or(isNull(anime.detailsFetchedAt), and(isNotNull(anime.source), ne(anime.source, primary))) : isNull(anime.detailsFetchedAt),
        sql`${anime.malId} in (select ${listEntries.malId} from ${listEntries})`,
        failed.size ? notInArray(anime.malId, [...failed]) : undefined,
      ),
    )
    .limit(BATCH)
    .all()
    .map((r) => r.malId)
}

async function run() {
  if (running) return
  running = true
  try {
    for (let ids = pending(); ids.length; ids = pending()) {
      for (const malId of ids) {
        wanted.delete(malId)
        const row = await ensureAnime(malId).catch(() => null)
        if (needsCard(row ?? undefined, primaryMetadata()?.id ?? null)) failed.add(malId)
      }
    }
  } catch (error) {
    console.error('[yoru] anime backfill failed', error)
  } finally {
    running = false
  }
}

export function queueAnimeRefresh(malIds: number[]) {
  for (const id of malIds) {
    if (wanted.size >= WANTED_LIMIT) break
    if (!failed.has(id)) wanted.add(id)
  }
  if (wanted.size) void run()
}

export function kickAnimeBackfill() {
  void run()
}

export function startAnimeBackfill() {
  if (timer) return
  setTimeout(run, 10_000)
  timer = setInterval(run, INTERVAL_MS)
}
