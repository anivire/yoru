import { cached, cacheSet, sleep, SourceOffError, upstream, UpstreamError } from '../lib/http'
import { sourceEnabled, sourceUrl } from '../lib/sources'

const DAY = 86_400_000
const MISSING_TTL = DAY / 4

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

const RESERVE = 10
const MAX_WAIT_MS = 5000

let remaining = Infinity
let seenAt = 0
let blockedUntil = 0
let background: Promise<unknown> = Promise.resolve()

async function send<T>(query: string, variables: Record<string, unknown>, low: boolean): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const saving = low && remaining < RESERVE ? seenAt + 60_000 - Date.now() : 0
    const wait = Math.max(blockedUntil - Date.now(), saving)
    if (wait > 0) {
      if (!low && wait > MAX_WAIT_MS) throw new UpstreamError('anilist', 429, 'AniList rate limit')
      await sleep(wait)
    }
    const res = await upstream('anilist', 'AniList', sourceUrl('anilist'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) })
    const left = Number(res.headers.get('X-RateLimit-Remaining') ?? NaN)
    if (Number.isFinite(left)) {
      remaining = left
      seenAt = Date.now()
    }
    if (res.status === 429) {
      blockedUntil = Date.now() + (Number(res.headers.get('Retry-After')) || 60) * 1000
      remaining = 0
      seenAt = Date.now()
      continue
    }
    if (res.status === 404) return null
    if (!res.ok) throw new UpstreamError('anilist', res.status, `AniList HTTP ${res.status}`)
    return ((await res.json()) as { data?: T }).data ?? null
  }
  throw new UpstreamError('anilist', 429, 'AniList rate limit')
}

function graphql<T>(query: string, variables: Record<string, unknown>, opts: { background?: boolean } = {}): Promise<T | null> {
  if (!sourceEnabled('anilist')) return Promise.reject(new SourceOffError('anilist', 503, 'AniList is disabled'))
  if (!opts.background) return send<T>(query, variables, false)
  const run = background.then(() => send<T>(query, variables, true))
  background = run.catch(() => undefined)
  return run
}

function remember(malIds: number[], media: AniListFullMedia[]) {
  const found = new Set<number>()
  for (const m of media) {
    if (!m.idMal) continue
    found.add(m.idMal)
    cacheSet(`anilist:anime:${m.idMal}`, { media: m }, DAY / 4)
  }
  for (const id of malIds) if (!found.has(id)) cacheSet(`anilist:anime:${id}`, { media: null }, MISSING_TTL)
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
    return cached(`anilist:extras:v3:${malId}`, (r) => (r.media ? 3 * DAY : MISSING_TTL), async () => ({ media: await request(malId) })).then((r) => r.media)
  },
  staff(id: number, page: number): Promise<AniListStaff | null> {
    return cached(`anilist:staff:${id}:${page}`, (r) => (r.staff ? 3 * DAY : MISSING_TTL), async () => ({ staff: (await graphql<{ Staff: AniListStaff | null }>(STAFF_QUERY, { id, page }))?.Staff ?? null })).then((r) => r.staff)
  },
  async many(malIds: number[], opts: { background?: boolean } = {}): Promise<AniListFullMedia[]> {
    const ids = [...new Set(malIds)].slice(0, 50)
    if (!ids.length) return []
    const media = (await graphql<{ Page: { media: AniListFullMedia[] } }>(MANY_QUERY, { ids }, opts))?.Page.media ?? []
    remember(ids, media)
    return media
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
      remember([], data?.Page.media ?? [])
      return { media: data?.Page.media ?? [], hasNextPage: data?.Page.pageInfo.hasNextPage ?? false }
    })
  },
}
