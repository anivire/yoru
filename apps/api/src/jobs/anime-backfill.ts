import { and, isNull, notInArray, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { anime, listEntries } from '../db/schema'
import { ensureAnime } from '../services/anime'

const BATCH = 40
const INTERVAL_MS = 3 * 60_000

const failed = new Set<number>()
let running = false
let timer: NodeJS.Timeout | null = null

function pending(): number[] {
  return db
    .select({ malId: anime.malId })
    .from(anime)
    .where(
      and(
        isNull(anime.detailsFetchedAt),
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
        const row = await ensureAnime(malId).catch(() => null)
        if (!row?.detailsFetchedAt) failed.add(malId)
      }
    }
  } catch (error) {
    console.error('[yoru] anime backfill failed', error)
  } finally {
    running = false
  }
}

export function kickAnimeBackfill() {
  void run()
}

export function startAnimeBackfill() {
  if (timer) return
  setTimeout(run, 10_000)
  timer = setInterval(run, INTERVAL_MS)
}
