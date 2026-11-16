import { and, eq } from 'drizzle-orm'
import type { AnilibriaRelease, StreamSource } from '@yoru/shared'
import { db, now } from '../db/client'
import { providerMappings } from '../db/schema'
import { sourceEnabled, sourceUrl } from '../lib/sources'
import { cached, SourceOffError, upstreamJson } from '../lib/http'
import { getAnimeRow } from './anime'

const PROVIDER = 'anilibria'
const HOUR = 3_600_000
const MAPPING_TTL_MS = 24 * HOUR

interface LibriaRelease {
  id: number
  year: number | null
  type?: { value: string | null } | null
  name: { main: string | null; english: string | null; alternative: string | null }
  mal?: { id: number | null } | null
  shikimori?: { id: number | null } | null
}

interface LibriaEpisode {
  ordinal: number
  name: string | null
  hls_480: string | null
  hls_720: string | null
  hls_1080: string | null
}

async function request<T>(path: string): Promise<T> {
  if (!sourceEnabled('anilibria')) throw new SourceOffError('anilibria', 503, 'AniLibria is disabled')
  return upstreamJson<T>('anilibria', 'AniLibria', `${sourceUrl('anilibria')}${path}`, { timeoutMs: 20_000 })
}

function search(query: string): Promise<LibriaRelease[]> {
  return cached(`anilibria:search:${query.toLowerCase()}`, 6 * HOUR, () =>
    request<LibriaRelease[]>(`/app/search/releases?query=${encodeURIComponent(query)}`),
  )
}

function release(id: number): Promise<LibriaRelease & { episodes: LibriaEpisode[] }> {
  return cached(`anilibria:release:${id}`, HOUR, () => request(`/anime/releases/${id}`))
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function queriesFor(malId: number): { queries: string[]; names: Set<string>; year: number | null; type: string | null } {
  const row = getAnimeRow(malId)
  if (!row) return { queries: [], names: new Set(), year: null, type: null }
  const titles = [row.titleRussian, row.title, row.titleEnglish, ...(row.synonyms ?? [])].filter((t): t is string => Boolean(t?.trim()))
  const queries = new Set<string>()
  for (const t of titles) {
    queries.add(t.trim())
    const short = t.trim().split(/\s+/).slice(0, 2).join(' ')
    if (short.length >= 4) queries.add(short)
  }
  return { queries: [...queries].slice(0, 6), names: new Set(titles.map(normalize)), year: row.year, type: row.type }
}

async function findRelease(malId: number): Promise<LibriaRelease | null> {
  const { queries, names, year, type } = queriesFor(malId)
  const compatible = (r: LibriaRelease) => {
    const yearOk = !year || !r.year || Math.abs(r.year - year) <= 1
    const libriaType = r.type?.value?.toUpperCase()
    const typeOk = !type || !libriaType || (type === 'movie') === (libriaType === 'MOVIE')
    return yearOk && typeOk
  }
  const fallback: LibriaRelease[] = []
  let failures = 0
  let lastError: unknown = null
  for (const query of queries) {
    const rows = await search(query).catch((error: unknown) => {
      failures++
      lastError = error
      return [] as LibriaRelease[]
    })
    const exact = rows.find((r) => (r.mal?.id === malId || r.shikimori?.id === malId) && compatible(r))
    if (exact) return exact
    for (const r of rows) {
      if (r.mal?.id) continue
      const matchesName = [r.name.english, r.name.main, r.name.alternative].some((n) => n && names.has(normalize(n)))
      if (matchesName && compatible(r)) fallback.push(r)
    }
  }
  if (!fallback.length && failures === queries.length && lastError) throw lastError
  return fallback[0] ?? null
}

function readMapping(malId: number) {
  return db
    .select()
    .from(providerMappings)
    .where(and(eq(providerMappings.provider, PROVIDER), eq(providerMappings.malId, malId)))
    .get()
}

async function resolveRelease(malId: number): Promise<{ id: number | null; title: string | null }> {
  const row = readMapping(malId)
  const stale = !row || (!row.providerId && Date.now() - Date.parse(row.updatedAt) > MAPPING_TTL_MS)
  if (row && !stale) return { id: row.providerId, title: row.title }
  const found = await findRelease(malId)
  const values = { provider: PROVIDER, malId, providerId: found?.id ?? null, title: found?.name.main ?? found?.name.english ?? null, manual: false, updatedAt: now() }
  db.insert(providerMappings)
    .values(values)
    .onConflictDoUpdate({ target: [providerMappings.provider, providerMappings.malId], set: values })
    .run()
  return { id: values.providerId, title: values.title }
}

function sourcesOf(e: LibriaEpisode): StreamSource[] {
  const list: StreamSource[] = []
  if (e.hls_1080) list.push({ url: e.hls_1080, type: 'm3u8', height: 1080 })
  if (e.hls_720) list.push({ url: e.hls_720, type: 'm3u8', height: 720 })
  if (e.hls_480) list.push({ url: e.hls_480, type: 'm3u8', height: 480 })
  return list
}

export async function anilibriaRelease(malId: number): Promise<AnilibriaRelease> {
  const match = await resolveRelease(malId)
  if (!match.id) return { releaseId: null, title: null, episodes: [] }
  const data = await release(match.id)
  return {
    releaseId: data.id,
    title: data.name.main ?? data.name.english ?? match.title,
    episodes: data.episodes
      .map((e) => ({ number: Math.round(Number(e.ordinal)), name: e.name || null, sources: sourcesOf(e) }))
      .filter((e) => Number.isInteger(e.number) && e.number > 0 && e.sources.length),
  }
}

export interface LibriaLatest {
  id: number
  year: number | null
  is_ongoing?: boolean | null
  mal?: { id: number | null } | null
  shikimori?: { id: number | null } | null
  fresh_at: string | null
  latest_episode?: { ordinal: number; updated_at: string | null } | null
}

export function anilibriaLatest(limit: number): Promise<LibriaLatest[]> {
  return request<LibriaLatest[]>(`/anime/releases/latest?limit=${limit}`)
}
