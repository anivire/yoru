import type { AnimeSummary, Genre, Screenshot } from '@yoru/shared'
import { inArray } from 'drizzle-orm'
import { db, now } from '../db/client'
import { anime } from '../db/schema'
import { cached, cacheGet, sleep, SourceOffError, upstream, UpstreamError } from '../lib/http'
import { sourceEnabled, sourceUrl } from '../lib/sources'
import { type AnimeRow, toSummary, upsertAnime } from './anime'

const HOUR = 3_600_000
const MIN_INTERVAL_MS = 250

export interface ShikiAnime {
  id: number
  name: string
  russian?: string | null
  image?: { original?: string; preview?: string }
  kind?: string | null
  score?: string | null
  status?: string | null
  episodes?: number
  episodes_aired?: number
  aired_on?: string | null
  released_on?: string | null
}

interface ShikiFranchise {
  nodes: { id: number; date: number | null }[]
  links: ShikiLink[]
}

interface ShikiLink {
  source_id: number
  target_id: number
  relation: string
}

export interface ShikiFranchiseEntry {
  anime: ShikiAnime
  side: boolean
  relation: string | null
}

const HIDDEN_KINDS = new Set(['music', 'pv', 'cm'])
const MAIN_RELATIONS = new Set(['sequel', 'prequel', 'alternative_version', 'alternative_setting'])
const PARENT_RELATIONS = new Set(['parent_story', 'full_story'])
const RELATION_NAMES: Record<string, string> = { parent_story: 'side_story', full_story: 'side_story', alternative_version: 'alternative', alternative_setting: 'alternative' }

function franchiseOrder(items: ShikiAnime[], allLinks: ShikiLink[]): ShikiFranchiseEntry[] {
  const ids = new Set(items.map((i) => i.id))
  const links = allLinks.filter((l) => ids.has(l.source_id) && ids.has(l.target_id))
  const main = new Set<number>()
  for (const l of links) {
    if (!MAIN_RELATIONS.has(l.relation)) continue
    main.add(l.source_id)
    main.add(l.target_id)
  }
  for (const i of items) if (i.kind === 'tv') main.add(i.id)
  if (!main.size && items[0]) main.add(items[0].id)
  const position = new Map(items.map((i, n) => [i.id, n]))
  const alternative = (id: number) =>
    !links.some((l) => l.source_id === id && (l.relation === 'prequel' || l.relation === 'sequel') && position.get(l.target_id)! < position.get(id)!) &&
    links.some((l) => l.source_id === id && l.relation.startsWith('alternative') && position.get(l.target_id)! < position.get(id)!)

  const children = new Map<number, ShikiAnime[]>()
  items.forEach((item, index) => {
    if (main.has(item.id)) return
    const own = links.filter((l) => l.source_id === item.id && main.has(l.target_id))
    let parent = (own.find((l) => PARENT_RELATIONS.has(l.relation)) ?? own[0])?.target_id
    parent ??= links.find((l) => l.target_id === item.id && main.has(l.source_id))?.source_id
    parent ??= items.slice(0, index).findLast((i) => main.has(i.id))?.id ?? [...main][0]!
    children.set(parent, [...(children.get(parent) ?? []), item])
  })

  return items
    .filter((i) => main.has(i.id))
    .flatMap((item) => [
      { anime: item, side: false, relation: alternative(item.id) ? 'alternative' : null },
      ...(children.get(item.id) ?? []).map((child) => {
        const relation = links.find((l) => l.source_id === item.id && l.target_id === child.id)?.relation ?? links.find((l) => l.source_id === child.id && l.target_id === item.id)?.relation ?? null
        return { anime: child, side: true, relation: relation ? (RELATION_NAMES[relation] ?? relation) : null }
      }),
    ])
}

export interface ShikiCalendarEntry {
  next_episode: number
  next_episode_at: string
  anime: ShikiAnime
}

interface ShikiGenre {
  id: number
  name: string
  russian: string
  kind: string
  entry_type: string
}

function disabled<T>(): Promise<T> {
  return Promise.reject(new SourceOffError('shikimori', 503, 'Shikimori is disabled'))
}

let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

async function request<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const res = await upstream('shikimori', 'Shikimori', `${sourceUrl('shikimori')}/api${path}${query.size ? `?${query}` : ''}`)
  if (!res.ok) throw new UpstreamError('shikimori', res.status, `Shikimori HTTP ${res.status} (${path})`)
  return (await res.json()) as T
}

function enqueue<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const run = queue.then(() => request<T>(path, params))
  queue = run.catch(() => undefined)
  return run
}

export function shikiUrl(path: string | null | undefined): string | null {
  if (!path || path.includes('/missing_')) return null
  return /^https?:\/\//.test(path) ? path : sourceUrl('shikimori') + path
}

const STATUS: Record<string, string> = { anons: 'upcoming', ongoing: 'airing', released: 'finished' }
const SEASONS = ['winter', 'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall']

export function currentSeason(date = new Date()): string {
  return `${SEASONS[date.getMonth()]}_${date.getFullYear()}`
}

function fromShiki(a: ShikiAnime) {
  const aired = a.aired_on ? new Date(a.aired_on) : null
  const score = Number.parseFloat(a.score ?? '')
  return {
    malId: a.id,
    title: a.name,
    titleRussian: a.russian || null,
    synonyms: a.russian ? [a.russian] : [],
    imageUrl: shikiUrl(a.image?.original),
    type: a.kind ?? null,
    episodes: a.episodes || null,
    status: (a.status && STATUS[a.status]) || null,
    airing: a.status === 'ongoing',
    year: aired ? aired.getUTCFullYear() : null,
    season: aired ? SEASONS[aired.getUTCMonth()]! : null,
    score: score > 0 ? score : null,
    genres: [],
    updatedAt: now(),
  }
}

export function shikiSummaries(items: ShikiAnime[]): AnimeSummary[] {
  if (!items.length) return []
  const ids = items.map((i) => i.id)
  const existing = new Map(db.select().from(anime).where(inArray(anime.malId, ids)).all().map((r) => [r.malId, r]))
  return items.map((item) => {
    const row = existing.get(item.id)
    if (row) {
      const image = row.imageUrl ?? shikiUrl(item.image?.original)
      const titleRussian = row.titleRussian || item.russian || row.titleRussian
      if ((image && !row.imageUrl) || titleRussian !== row.titleRussian) upsertAnime({ ...row, imageUrl: image, titleRussian })
      return toSummary({ ...row, imageUrl: image, titleRussian })
    }
    const data = fromShiki(item)
    upsertAnime(data, { onlyIfMissing: true })
    return toSummary({ ...data, titleEnglish: null, titleJapanese: null, latestEpisode: null } as unknown as AnimeRow)
  })
}

function screenshotsKey(id: number) {
  return `shiki:screenshots:${id}`
}

export function cachedBanner(id: number): string | null | undefined {
  if (!sourceEnabled('shikimori')) return null
  const value = cacheGet<string[]>(screenshotsKey(id))
  return value === null ? undefined : (value[0] ?? null)
}

const warming = new Set<number>()

export function warmBanners(ids: number[]) {
  for (const id of ids) {
    if (warming.has(id) || cachedBanner(id) !== undefined) continue
    warming.add(id)
    shikimori
      .screenshots(id)
      .catch(() => undefined)
      .finally(() => warming.delete(id))
  }
}

export const shikimori = {
  calendar(): Promise<ShikiCalendarEntry[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return cached('shiki:calendar', HOUR, () => enqueue<ShikiCalendarEntry[]>('/calendar', { censored: 'true' }))
  },

  byIds(ids: number[]): Promise<ShikiAnime[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return enqueue<ShikiAnime[]>('/animes', { ids: ids.join(','), limit: ids.length, censored: 'false' })
  },

  franchise(id: number): Promise<ShikiFranchiseEntry[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return cached(`shiki:franchise:v3:${id}`, 7 * 24 * HOUR, async () => {
      const { nodes, links } = await enqueue<ShikiFranchise>(`/animes/${id}/franchise`)
      if (nodes.length < 2) return []
      const order = new Map(nodes.map((n) => [n.id, n.date ?? Number.MAX_SAFE_INTEGER]))
      const ids = [...order.keys()]
      const items: ShikiAnime[] = []
      for (let i = 0; i < ids.length; i += 50) items.push(...(await shikimori.byIds(ids.slice(i, i + 50))))
      const shown = items.filter((a) => !HIDDEN_KINDS.has(a.kind ?? '')).sort((a, b) => order.get(a.id)! - order.get(b.id)!)
      return shown.length < 2 ? shown.map((anime) => ({ anime, side: false, relation: null })) : franchiseOrder(shown, links)
    })
  },

  animes(params: Record<string, string | number>): Promise<ShikiAnime[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    const query = { censored: 'true', limit: 24, ...params }
    const key = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
    return cached(`shiki:animes:${key}`, 3 * HOUR, () => enqueue<ShikiAnime[]>('/animes', query))
  },

  async screenshots(id: number): Promise<string[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return cached(screenshotsKey(id), 7 * 24 * HOUR, async () => {
      const rows = await enqueue<{ original?: string }[]>(`/animes/${id}/screenshots`)
      return rows.map((r) => shikiUrl(r.original)).filter((u): u is string => Boolean(u))
    })
  },

  async gallery(id: number): Promise<Screenshot[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return cached(`shiki:gallery:${id}`, 7 * 24 * HOUR, async () => {
      const rows = await enqueue<{ original?: string; preview?: string }[]>(`/animes/${id}/screenshots`)
      return rows
        .map((r) => ({ full: shikiUrl(r.original), thumb: shikiUrl(r.preview ?? r.original) }))
        .filter((r): r is Screenshot => Boolean(r.full && r.thumb))
    })
  },

  genres(locale: 'ru' | 'en'): Promise<Genre[]> {
    if (!sourceEnabled('shikimori')) return disabled()
    return cached('shiki:genres', 24 * HOUR, () => enqueue<ShikiGenre[]>('/genres')).then((rows) =>
      rows
        .filter((g) => g.entry_type === 'Anime' && g.kind === 'genre')
        .map((g) => ({ id: g.id, name: locale === 'ru' ? g.russian : g.name, count: 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    )
  },
}
