import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { randomToken } from '../lib/crypto'
import { badRequest } from '../lib/http'
import { isoDate } from '../lib/time'
import { ANILIST_STATUS, type ImportItem } from './importers'

interface SeanimeDate {
  year?: number | null
  month?: number | null
  day?: number | null
}

interface SeanimeEntry {
  status?: string | null
  progress?: number | null
  repeat?: number | null
  notes?: string | null
  score?: number | null
  startedAt?: SeanimeDate | null
  completedAt?: SeanimeDate | null
  media?: {
    idMal?: number | null
    format?: string | null
    episodes?: number | null
    title?: { userPreferred?: string | null; romaji?: string | null; english?: string | null; native?: string | null } | null
    coverImage?: { extraLarge?: string | null; large?: string | null; medium?: string | null } | null
  } | null
}

const SQLITE_MAGIC = 'SQLite format 3\u0000'

function entriesOf(value: unknown): SeanimeEntry[] {
  const root = value as { MediaListCollection?: unknown; mediaListCollection?: unknown } | null
  const collection = (root?.MediaListCollection ?? root?.mediaListCollection ?? root) as { lists?: { entries?: SeanimeEntry[] | null }[] | null } | null
  return (collection?.lists ?? []).flatMap((list) => list?.entries ?? [])
}

function collectionsFromDatabase(buffer: Buffer): unknown[] {
  const file = path.join(os.tmpdir(), `yoru-seanime-${randomToken(8)}.db`)
  fs.writeFileSync(file, buffer)
  try {
    const db = new Database(file, { readonly: true, fileMustExist: true })
    try {
      const tables = new Set((db.prepare("select name from sqlite_master where type = 'table'").all() as { name: string }[]).map((t) => t.name))
      const found: unknown[] = []
      for (const table of ['simulated_collections', 'local_collections']) {
        if (!tables.has(table)) continue
        const rows = db.prepare(`select value from ${table} where type = 'anime' order by updated_at desc`).all() as { value: Buffer | string }[]
        for (const row of rows) {
          try {
            found.push(JSON.parse(Buffer.isBuffer(row.value) ? row.value.toString('utf8') : row.value))
          } catch {}
        }
      }
      return found
    } finally {
      db.close()
    }
  } finally {
    fs.rmSync(file, { force: true })
  }
}

function toItem(e: SeanimeEntry): ImportItem {
  const media = e.media ?? {}
  const title = media.title ?? {}
  const rawScore = Number(e.score) || 0
  const score = rawScore > 10 ? Math.round(rawScore) / 10 : rawScore
  return {
    malId: media.idMal || null,
    title: title.romaji || title.userPreferred || title.english || title.native || '?',
    titleEnglish: title.english ?? null,
    titleJapanese: title.native ?? null,
    imageUrl: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null,
    type: media.format ? media.format.toLowerCase() : null,
    episodes: media.episodes ?? null,
    status: ANILIST_STATUS[e.status ?? ''] ?? 'planning',
    progress: e.progress ?? 0,
    score: score > 0 ? score : null,
    rewatches: e.repeat ?? 0,
    notes: e.notes || null,
    startedAt: isoDate(e.startedAt),
    completedAt: isoDate(e.completedAt),
  }
}

export function parseSeanimeExport(buffer: Buffer): ImportItem[] {
  let collections: unknown[]
  if (buffer.subarray(0, SQLITE_MAGIC.length).toString('latin1') === SQLITE_MAGIC) {
    collections = collectionsFromDatabase(buffer)
  } else {
    try {
      collections = [JSON.parse(buffer.toString('utf8'))]
    } catch {
      badRequest('SEANIME_INVALID')
    }
  }
  const entries = collections.map(entriesOf).sort((a, b) => b.length - a.length)[0] ?? []
  if (!entries.length) badRequest('SEANIME_EMPTY')
  const seen = new Set<number>()
  const items: ImportItem[] = []
  for (const entry of entries) {
    const item = toItem(entry)
    if (item.malId && seen.has(item.malId)) continue
    if (item.malId) seen.add(item.malId)
    items.push(item)
  }
  return items
}
