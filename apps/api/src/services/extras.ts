import type { AnimeCharacter, AnimeExtras, AnimeSummary, PersonPage, PersonRole, RelatedAnime, WatchOrderEntry } from '@yoru/shared'
import { inArray } from 'drizzle-orm'
import { db, now } from '../db/client'
import { featureEnabled } from '../lib/features'
import { notFound } from '../lib/http'
import { anime } from '../db/schema'
import { type AniListMedia, anilist } from './anilist'
import { toSummary, upsertAnime } from './anime'
import { cards } from './cards'
import { shikimori, shikiSummaries } from './shikimori'

const STATUS: Record<string, string> = { FINISHED: 'finished', RELEASING: 'airing', NOT_YET_RELEASED: 'upcoming', CANCELLED: 'finished', HIATUS: 'airing' }
const TYPES: Record<string, string> = { TV: 'tv', TV_SHORT: 'tv', MOVIE: 'movie', SPECIAL: 'special', OVA: 'ova', ONA: 'ona', MUSIC: 'music' }
const RELATION_ORDER = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'SUMMARY', 'COMPILATION', 'CONTAINS', 'CHARACTER', 'OTHER']
const ROLES: Record<string, AnimeCharacter['role']> = { MAIN: 'main', SUPPORTING: 'supporting', BACKGROUND: 'background' }

function fromMedia(m: AniListMedia & { idMal: number }) {
  return {
    malId: m.idMal,
    title: m.title.romaji || m.title.english || m.title.native || `#${m.idMal}`,
    titleEnglish: m.title.english,
    titleJapanese: m.title.native,
    imageUrl: m.coverImage?.large ?? null,
    type: (m.format && TYPES[m.format]) || null,
    episodes: m.episodes,
    status: (m.status && STATUS[m.status]) || null,
    airing: m.status === 'RELEASING',
    year: m.seasonYear,
    season: m.season ? m.season.toLowerCase() : null,
    score: m.averageScore ? m.averageScore / 10 : null,
    genres: [],
    updatedAt: now(),
  }
}

async function summaries(items: AniListMedia[]): Promise<Map<number, AnimeSummary>> {
  const valid = items.filter((m): m is AniListMedia & { idMal: number } => Boolean(m.idMal) && m.type !== 'MANGA')
  const ids = [...new Set(valid.map((m) => m.idMal))]
  if (!ids.length) return new Map()
  for (const m of valid) upsertAnime(fromMedia(m), { onlyIfMissing: true })
  const rows = db.select().from(anime).where(inArray(anime.malId, ids)).all()
  const refined = await cards(rows.map(toSummary))
  return new Map(refined.map((a) => [a.malId, a]))
}

export async function watchOrder(malId: number): Promise<WatchOrderEntry[]> {
  if (!featureEnabled('franchise')) return []
  const entries = await shikimori.franchise(malId).catch(() => [])
  const list = await cards(shikiSummaries(entries.map((e) => e.anime)))
  return entries.map((e, i) => ({ anime: list[i]!, side: e.side, relation: e.relation }))
}

export async function animeExtras(malId: number): Promise<AnimeExtras> {
  const media = featureEnabled('related') ? await anilist.extras(malId) : null
  if (!media) return { relations: [], characters: [], recommendations: [] }

  const relationEdges = media.relations.edges.filter((e) => e.node.type === 'ANIME' && e.node.idMal && e.node.idMal !== malId)
  const recNodes = media.recommendations.nodes.map((n) => n.mediaRecommendation).filter((m): m is AniListMedia => Boolean(m?.idMal) && m!.idMal !== malId)
  const known = await summaries([...relationEdges.map((e) => e.node), ...recNodes])

  const rank = (r: string) => {
    const i = RELATION_ORDER.indexOf(r)
    return i === -1 ? RELATION_ORDER.length : i
  }
  const relations: RelatedAnime[] = relationEdges
    .map((e) => ({ relation: e.relationType.toLowerCase(), anime: known.get(e.node.idMal!)! }))
    .filter((r) => r.anime)
    .sort((a, b) => rank(a.relation.toUpperCase()) - rank(b.relation.toUpperCase()) || (a.anime.year ?? 9999) - (b.anime.year ?? 9999))

  const characters: AnimeCharacter[] = media.characters.edges
    .filter((e) => e.node.name.full)
    .map((e) => {
      const va = e.voiceActors[0]
      return {
        id: e.node.id,
        name: e.node.name.full!,
        imageUrl: e.node.image?.large ?? null,
        role: ROLES[e.role] ?? 'supporting',
        voiceActor: va?.name.full ? { id: va.id, name: va.name.full, imageUrl: va.image?.large ?? null } : null,
      }
    })

  const relatedIds = new Set(relations.map((r) => r.anime.malId))
  const recommendations = recNodes.map((m) => known.get(m.idMal!)).filter((a): a is AnimeSummary => Boolean(a) && !relatedIds.has(a!.malId))

  return { relations, characters, recommendations }
}

const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g

function splitDescription(raw: string | null) {
  const links: PersonPage['links'] = []
  if (!raw) return { description: null, links }
  const kept: string[] = []
  for (const line of raw.replace(/~!.*?!~/gs, '').split('\n')) {
    const prefix = /^\s*([^:[\]]{1,30}):/.exec(line)?.[1]?.replace(/[_*]/g, '').trim()
    const found = [...line.matchAll(MD_LINK)].filter(([, , url]) => !/^https?:\/\/(www\.)?anilist\.co\//.test(url!))
    for (const [, label, url] of found) {
      if (!links.some((l) => l.url === url)) links.push({ label: prefix && found.length === 1 ? `${prefix} ${label!.trim()}` : label!.trim(), url: url! })
    }
    const rest = line.replace(MD_LINK, '').replace(/^\s*[^:[\]]{1,30}:/, '')
    if (found.length && /^[\s,|·•:\-–—()_*]*$/.test(rest)) continue
    kept.push(line.replace(MD_LINK, '$1'))
  }
  const heading = (line: string) => /^\s*(#{1,6}\s+.+|(__|\*\*)[^_*]{1,60}(__|\*\*):?|(__|\*\*)?[^:]{1,40}:(__|\*\*)?)\s*$/.test(line)
  const filled = kept.filter((line, i) => {
    if (!heading(line)) return true
    const next = kept.slice(i + 1).find((l) => l.trim())
    return next !== undefined && !heading(next)
  })
  const description = filled.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { description: description || null, links }
}

export async function personPage(id: number, page: number): Promise<PersonPage> {
  const staff = featureEnabled('related') ? await anilist.staff(id, page) : null
  if (!staff?.name.full) throw notFound('PERSON_NOT_FOUND')
  const edges = staff.characterMedia.edges.filter((e) => e.node.type === 'ANIME' && e.node.idMal)
  const known = await summaries(edges.map((e) => e.node))
  const byAnime = new Map<number, PersonRole>()
  for (const e of edges) {
    const anime = known.get(e.node.idMal!)
    if (!anime) continue
    const role = byAnime.get(anime.malId) ?? { anime, characters: [] }
    byAnime.set(anime.malId, role)
    for (const c of e.characters) {
      if (c?.name.full && !role.characters.some((x) => x.id === c.id)) role.characters.push({ id: c.id, name: c.name.full, imageUrl: c.image?.large ?? null, role: ROLES[e.characterRole ?? ''] ?? 'supporting' })
    }
  }
  const roles = [...byAnime.values()]
  return {
    id: staff.id,
    name: staff.name.full,
    nativeName: staff.name.native,
    imageUrl: staff.image?.large ?? null,
    ...splitDescription(staff.description),
    birthday: staff.dateOfBirth?.year || staff.dateOfBirth?.month ? staff.dateOfBirth : null,
    homeTown: staff.homeTown,
    yearsActive: staff.yearsActive ?? [],
    url: staff.siteUrl,
    roles,
    hasNextPage: staff.characterMedia.pageInfo.hasNextPage,
  }
}
