import { env } from '../env'
import { UpstreamError, cached } from '../lib/http'
import { sourceEnabled, sourceUrl } from '../lib/sources'

const DAY = 86_400_000

export interface AniListMedia {
  idMal: number | null
  type: 'ANIME' | 'MANGA' | null
  format: string | null
  status: string | null
  episodes: number | null
  season: string | null
  seasonYear: number | null
  averageScore: number | null
  title: { romaji: string | null; english: string | null; native: string | null }
  coverImage: { large: string | null } | null
}

export interface AniListExtras {
  relations: { edges: { relationType: string; node: AniListMedia }[] }
  characters: {
    edges: {
      role: string
      node: { id: number; name: { full: string | null }; image: { large: string | null } | null }
      voiceActors: { name: { full: string | null }; image: { large: string | null } | null }[]
    }[]
  }
  recommendations: { nodes: { mediaRecommendation: AniListMedia | null }[] }
}

const MEDIA = 'idMal type format status episodes season seasonYear averageScore title { romaji english native } coverImage { large }'

const QUERY = `query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    relations { edges { relationType node { ${MEDIA} } } }
    characters(sort: [ROLE, RELEVANCE, ID], perPage: 18) {
      edges { role node { id name { full } image { large } } voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { name { full } image { large } } }
    }
    recommendations(sort: [RATING_DESC, ID], perPage: 18) { nodes { mediaRecommendation { ${MEDIA} } } }
  }
}`

async function request(malId: number): Promise<AniListExtras | null> {
  let res: Response
  try {
    res = await fetch(sourceUrl('anilist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': env.userAgent },
      body: JSON.stringify({ query: QUERY, variables: { idMal: malId } }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    throw new UpstreamError('anilist', 0, `AniList unreachable: ${(error as Error).message}`)
  }
  if (res.status === 404) return null
  if (!res.ok) throw new UpstreamError('anilist', res.status, `AniList HTTP ${res.status}`)
  const body = (await res.json()) as { data?: { Media?: AniListExtras | null } }
  return body.data?.Media ?? null
}

export const anilist = {
  extras(malId: number): Promise<AniListExtras | null> {
    if (!sourceEnabled('anilist')) return Promise.resolve(null)
    return cached(`anilist:extras:${malId}`, 3 * DAY, async () => ({ media: await request(malId) })).then((r) => r.media)
  },
}
