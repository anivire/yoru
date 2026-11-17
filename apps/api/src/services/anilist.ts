import { cached, SourceOffError, upstream, UpstreamError } from '../lib/http'
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
      voiceActors: { id: number; name: { full: string | null }; image: { large: string | null } | null }[]
    }[]
  }
  recommendations: { nodes: { mediaRecommendation: AniListMedia | null }[] }
}

const MEDIA = 'idMal type format status episodes season seasonYear averageScore title { romaji english native } coverImage { large }'

const QUERY = `query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    relations { edges { relationType node { ${MEDIA} } } }
    characters(sort: [ROLE, RELEVANCE, ID], perPage: 25) {
      edges { role node { id name { full } image { large } } voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full } image { large } } }
    }
    recommendations(sort: [RATING_DESC, ID], perPage: 18) { nodes { mediaRecommendation { ${MEDIA} } } }
  }
}`

export interface AniListStaff {
  id: number
  name: { full: string | null; native: string | null }
  image: { large: string | null } | null
  description: string | null
  dateOfBirth: { year: number | null; month: number | null; day: number | null } | null
  homeTown: string | null
  yearsActive: number[] | null
  siteUrl: string | null
  characterMedia: {
    pageInfo: { hasNextPage: boolean }
    edges: { characterRole: string | null; characters: ({ id: number; name: { full: string | null }; image: { large: string | null } | null } | null)[]; node: AniListMedia }[]
  }
}

const STAFF_QUERY = `query ($id: Int, $page: Int) {
  Staff(id: $id) {
    id name { full native } image { large } description(asHtml: false) dateOfBirth { year month day } homeTown yearsActive siteUrl
    characterMedia(page: $page, perPage: 50, sort: [POPULARITY_DESC]) {
      pageInfo { hasNextPage }
      edges { characterRole characters { id name { full } image { large } } node { ${MEDIA} } }
    }
  }
}`

async function request(malId: number): Promise<AniListExtras | null> {
  return (await graphql<{ Media?: AniListExtras | null }>(QUERY, { idMal: malId }))?.Media ?? null
}

export interface AniListFullMedia {
  idMal: number | null
  format: string | null
  status: string | null
  episodes: number | null
  duration: number | null
  season: string | null
  seasonYear: number | null
  averageScore: number | null
  genres: string[] | null
  synonyms: string[] | null
  description: string | null
  title: { romaji: string | null; english: string | null; native: string | null }
  coverImage: { extraLarge: string | null; large: string | null } | null
  studios: { nodes: { name: string }[] } | null
  startDate: { year: number | null; month: number | null; day: number | null } | null
  endDate: { year: number | null; month: number | null; day: number | null } | null
  trailer: { site: string | null; id: string | null } | null
}

const FULL_MEDIA = `idMal format status episodes duration season seasonYear averageScore genres synonyms description(asHtml: false)
  title { romaji english native } coverImage { extraLarge large } studios(isMain: true) { nodes { name } }
  startDate { year month day } endDate { year month day } trailer { site id }`

const MANY_QUERY = `query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { ${FULL_MEDIA} } } }`

const ANIME_QUERY = `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${FULL_MEDIA} } }`

const SEARCH_QUERY = `query ($page: Int, $perPage: Int, $search: String, $format: [MediaFormat], $status: MediaStatus, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, isAdult: false, search: $search, format_in: $format, status: $status, sort: $sort) { ${FULL_MEDIA} }
  }
}`

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  if (!sourceEnabled('anilist')) throw new SourceOffError('anilist', 503, 'AniList is disabled')
  const res = await upstream('anilist', 'AniList', sourceUrl('anilist'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) })
  if (res.status === 404) return null
  if (!res.ok) throw new UpstreamError('anilist', res.status, `AniList HTTP ${res.status}`)
  return ((await res.json()) as { data?: T }).data ?? null
}

export interface AniListSearch {
  q: string
  page: number
  format: string[] | null
  status: string | null
}

export const anilist = {
  extras(malId: number): Promise<AniListExtras | null> {
    if (!sourceEnabled('anilist')) return Promise.resolve(null)
    return cached(`anilist:extras:v3:${malId}`, 3 * DAY, async () => ({ media: await request(malId) })).then((r) => r.media)
  },
  staff(id: number, page: number): Promise<AniListStaff | null> {
    return cached(`anilist:staff:${id}:${page}`, 3 * DAY, async () => ({ staff: (await graphql<{ Staff: AniListStaff | null }>(STAFF_QUERY, { id, page }))?.Staff ?? null })).then((r) => r.staff)
  },
  async many(malIds: number[]): Promise<AniListFullMedia[]> {
    const ids = [...new Set(malIds)].slice(0, 50)
    if (!ids.length) return []
    return (await graphql<{ Page: { media: AniListFullMedia[] } }>(MANY_QUERY, { ids }))?.Page.media ?? []
  },
  anime(malId: number): Promise<AniListFullMedia | null> {
    return cached(`anilist:anime:${malId}`, DAY / 4, async () => ({ media: (await graphql<{ Media: AniListFullMedia | null }>(ANIME_QUERY, { idMal: malId }))?.Media ?? null })).then((r) => r.media)
  },
  search(params: AniListSearch): Promise<{ media: AniListFullMedia[]; hasNextPage: boolean }> {
    const variables = {
      page: params.page,
      perPage: 24,
      search: params.q || undefined,
      format: params.format ?? undefined,
      status: params.status ?? undefined,
      sort: params.q ? ['SEARCH_MATCH'] : ['TRENDING_DESC', 'POPULARITY_DESC'],
    }
    return cached(`anilist:search:${JSON.stringify(variables)}`, DAY / 24, async () => {
      const data = await graphql<{ Page: { pageInfo: { hasNextPage: boolean }; media: AniListFullMedia[] } }>(SEARCH_QUERY, variables)
      return { media: data?.Page.media ?? [], hasNextPage: data?.Page.pageInfo.hasNextPage ?? false }
    })
  },
}
