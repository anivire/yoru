import type { AnimeCharacter, AnimeExtras, AnimeSummary, RelatedAnime } from '@yoru/shared'
import { inArray } from 'drizzle-orm'
import { db, now } from '../db/client'
import { featureEnabled } from '../lib/features'
import { anime } from '../db/schema'
import { type AniListMedia, anilist } from './anilist'
import { type AnimeRow, toSummary, upsertAnime } from './anime'

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

function summaries(items: AniListMedia[]): Map<number, AnimeSummary> {
  const valid = items.filter((m): m is AniListMedia & { idMal: number } => Boolean(m.idMal) && m.type !== 'MANGA')
  const ids = [...new Set(valid.map((m) => m.idMal))]
  const existing = new Map(ids.length ? db.select().from(anime).where(inArray(anime.malId, ids)).all().map((r) => [r.malId, r]) : [])
  const result = new Map<number, AnimeSummary>()
  for (const m of valid) {
    if (result.has(m.idMal)) continue
    const row = existing.get(m.idMal)
    const data = fromMedia(m)
    if (!row) upsertAnime(data, { onlyIfMissing: true })
    else if (!row.imageUrl && data.imageUrl) upsertAnime({ ...row, imageUrl: data.imageUrl })
    const merged = row ? { ...row, imageUrl: row.imageUrl ?? data.imageUrl } : ({ ...data, titleRussian: null, latestEpisode: null } as unknown as AnimeRow)
    result.set(m.idMal, toSummary(merged))
  }
  return result
}

export async function animeExtras(malId: number): Promise<AnimeExtras> {
  const media = featureEnabled('related') ? await anilist.extras(malId).catch(() => null) : null
  if (!media) return { relations: [], characters: [], recommendations: [] }

  const relationEdges = media.relations.edges.filter((e) => e.node.type === 'ANIME' && e.node.idMal && e.node.idMal !== malId)
  const recNodes = media.recommendations.nodes.map((n) => n.mediaRecommendation).filter((m): m is AniListMedia => Boolean(m?.idMal) && m!.idMal !== malId)
  const cards = summaries([...relationEdges.map((e) => e.node), ...recNodes])

  const rank = (r: string) => {
    const i = RELATION_ORDER.indexOf(r)
    return i === -1 ? RELATION_ORDER.length : i
  }
  const relations: RelatedAnime[] = relationEdges
    .map((e) => ({ relation: e.relationType.toLowerCase(), anime: cards.get(e.node.idMal!)! }))
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
        voiceActor: va?.name.full ? { name: va.name.full, imageUrl: va.image?.large ?? null } : null,
      }
    })

  const relatedIds = new Set(relations.map((r) => r.anime.malId))
  const recommendations = recNodes.map((m) => cards.get(m.idMal!)).filter((a): a is AnimeSummary => Boolean(a) && !relatedIds.has(a!.malId))

  return { relations, characters, recommendations }
}
