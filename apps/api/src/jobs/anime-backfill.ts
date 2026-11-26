import { and, isNotNull, isNull, ne, notInArray, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { anime, listEntries } from '../db/schema'
import { primaryMetadata } from '../providers/chain'
import { sleep } from '../lib/http'
import { ensureAnime, getAnimeRow, needsCard, upsertAnime } from '../services/anime'

const BATCH = 50
const INTERVAL_MS = 3 * 60_000
const WANTED_LIMIT = 500
const SINGLE_PAUSE_MS = 1000

const failed = new Set<number>()
const wanted = new Map<number, boolean>()
let running = false
let timer: NodeJS.Timeout | null = null

function pending(): number[] {
  const primary = primaryMetadata()?.id
  const queued = [...wanted.keys()].filter((id) => !failed.has(id)).slice(0, BATCH)
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

async function refresh(ids: number[]): Promise<boolean> {
  const primary = primaryMetadata()
  if (primary?.many) {
    const items = await primary.many(ids, { background: true }).catch(() => null)
    if (!items) return false
    for (const item of items) upsertAnime(item, { details: true, source: primary.id })
  }
  for (const malId of ids) {
    const outdated = wanted.get(malId) && !primary?.many
    wanted.delete(malId)
    if (!outdated && !needsCard(getAnimeRow(malId), primary?.id ?? null)) continue
    const row = await ensureAnime(malId).catch(() => null)
    if (needsCard(row ?? undefined, primary?.id ?? null)) failed.add(malId)
    await sleep(SINGLE_PAUSE_MS)
  }
  return true
}

async function run() {
  if (running) return
  running = true
  try {
    for (let ids = pending(); ids.length; ids = pending()) {
      if (!(await refresh(ids))) break
    }
  } catch (error) {
    console.error('[yoru] anime backfill failed', error)
  } finally {
    running = false
  }
}

export function queueAnimeRefresh(malIds: number[], opts: { outdated?: boolean } = {}) {
  for (const id of malIds) {
    if (wanted.size >= WANTED_LIMIT) break
    if (!failed.has(id)) wanted.set(id, Boolean(opts.outdated) || Boolean(wanted.get(id)))
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
