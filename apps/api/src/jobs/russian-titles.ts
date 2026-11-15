import { eq, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { anime } from '../db/schema'
import { sleep } from '../lib/http'
import { sourceEnabled } from '../lib/sources'
import { shikimori } from '../services/shikimori'

const BATCH = 50
const INTERVAL_MS = 10 * 60_000

let running = false
let timer: NodeJS.Timeout | null = null

function pending(): number[] {
  return db
    .select({ malId: anime.malId })
    .from(anime)
    .where(isNull(anime.titleRussian))
    .limit(BATCH)
    .all()
    .map((r) => r.malId)
}

async function run() {
  if (running || !sourceEnabled('shikimori')) return
  running = true
  try {
    for (let ids = pending(); ids.length; ids = pending()) {
      const rows = await shikimori.byIds(ids)
      const found = new Map(rows.map((r) => [r.id, r.russian?.trim() || '']))
      db.transaction((tx) => {
        for (const malId of ids) tx.update(anime).set({ titleRussian: found.get(malId) ?? '' }).where(eq(anime.malId, malId)).run()
      })
      await sleep(1_000)
    }
  } catch (error) {
    console.warn('[yoru] russian titles failed:', (error as Error).message)
  } finally {
    running = false
  }
}

export function startRussianTitles() {
  if (timer) return
  setTimeout(run, 15_000)
  timer = setInterval(run, INTERVAL_MS)
}
