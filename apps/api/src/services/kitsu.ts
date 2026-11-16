import { cached, SourceOffError, upstreamJson } from '../lib/http'
import { sourceEnabled, sourceUrl } from '../lib/sources'

const HOUR = 3_600_000
const PAGE_SIZE = 20

export interface KitsuAnime {
  id: string
  attributes: {
    canonicalTitle: string | null
    titles: Record<string, string | null> | null
    abbreviatedTitles: string[] | null
    synopsis: string | null
    subtype: string | null
    status: string | null
    startDate: string | null
    endDate: string | null
    averageRating: string | null
    episodeCount: number | null
    episodeLength: number | null
    ageRating: string | null
    posterImage: { original?: string | null; large?: string | null } | null
    youtubeVideoId: string | null
  }
  relationships?: {
    mappings?: { data?: { id: string }[] }
    categories?: { data?: { id: string }[] }
  }
}

interface Included {
  id: string
  type: string
  attributes: { externalSite?: string; externalId?: string; title?: string }
}

interface KitsuList {
  data: KitsuAnime[]
  included?: Included[]
  links?: { next?: string }
}

export interface KitsuEntry {
  anime: KitsuAnime
  malId: number | null
  genres: string[]
}

async function request<T>(path: string): Promise<T> {
  if (!sourceEnabled('kitsu')) throw new SourceOffError('kitsu', 503, 'Kitsu is disabled')
  return upstreamJson<T>('kitsu', 'Kitsu', `${sourceUrl('kitsu')}${path}`, { headers: { Accept: 'application/vnd.api+json' } })
}

function entries(list: KitsuList): KitsuEntry[] {
  const included = new Map((list.included ?? []).map((i) => [`${i.type}:${i.id}`, i]))
  return list.data.map((anime) => {
    const mapping = (anime.relationships?.mappings?.data ?? [])
      .map((m) => included.get(`mappings:${m.id}`))
      .find((m) => m?.attributes.externalSite === 'myanimelist/anime')
    const malId = Number(mapping?.attributes.externalId)
    const genres = (anime.relationships?.categories?.data ?? []).map((c) => included.get(`categories:${c.id}`)?.attributes.title).filter((t): t is string => Boolean(t))
    return { anime, malId: Number.isInteger(malId) && malId > 0 ? malId : null, genres }
  })
}

const INCLUDE = 'include=mappings,categories&fields[mappings]=externalSite,externalId&fields[categories]=title'

export interface KitsuSearch {
  q: string
  page: number
  subtype: string | null
  status: string | null
}

export const kitsu = {
  async anime(malId: number): Promise<KitsuEntry | null> {
    return cached(`kitsu:anime:v2:${malId}`, 6 * HOUR, async () => {
      const mapping = await request<{ data: { relationships: { item: { data: { id: string } | null } } }[] }>(
        `/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${malId}&include=item&fields[anime]=id`,
      )
      const id = mapping.data[0]?.relationships.item.data?.id
      if (!id) return { entry: null }
      const list = await request<{ data: KitsuAnime; included?: Included[] }>(`/anime/${id}?${INCLUDE}`)
      const entry = entries({ data: [list.data], included: list.included })[0]!
      return { entry: { ...entry, malId } }
    }).then((r) => r.entry)
  },

  search(params: KitsuSearch): Promise<{ entries: KitsuEntry[]; hasNextPage: boolean }> {
    const query = new URLSearchParams({ 'page[limit]': String(PAGE_SIZE), 'page[offset]': String((params.page - 1) * PAGE_SIZE) })
    if (params.q) query.set('filter[text]', params.q)
    else query.set('sort', '-userCount')
    if (params.subtype) query.set('filter[subtype]', params.subtype)
    if (params.status) query.set('filter[status]', params.status)
    const path = `/anime?${query}&${INCLUDE}`
    return cached(`kitsu:search:${path}`, HOUR, async () => {
      const list = await request<KitsuList>(path)
      return { entries: entries(list), hasNextPage: Boolean(list.links?.next) }
    })
  },
}
