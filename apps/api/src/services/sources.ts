import { DATA_SOURCES, type DataSourceId, type DataSourceInfo } from '@yoru/shared'
import { env } from '../env'
import { customSourceUrl, defaultSourceUrl, githubConfig, kodikToken, sourceEnabled, sourceUrl } from '../lib/sources'

const STATUS_TTL = 5 * 60_000
const statuses = new Map<DataSourceId, { value: boolean; at: number; url: string }>()
const checking = new Set<DataSourceId>()

function probeTarget(id: DataSourceId, url: string): string {
  switch (id) {
    case 'anime365':
      return `${url}/api/series?limit=1&fields=id`
    case 'jikan':
      return `${url}/anime/1`
    case 'shikimori':
      return `${url}/api/animes?limit=1`
    case 'anilibria':
      return `${url}/anime/releases/latest?limit=1`
    case 'anilist':
      return url
    case 'kitsu':
      return `${url}/anime?page[limit]=1`
    case 'kodik':
      return `${url}/translations/v2?token=${encodeURIComponent(kodikToken() ?? '')}`
    case 'aniskip':
      return `${url}/v2/skip-times/21/1?types[]=op&episodeLength=0`
    case 'github':
      return `${url}/repos/${githubConfig().repo}`
  }
}

async function probe(id: DataSourceId, url: string): Promise<boolean> {
  const token = id === 'github' ? githubConfig().token : ''
  try {
    const graphql = id === 'anilist'
    const res = await fetch(probeTarget(id, url), {
      method: graphql ? 'POST' : 'GET',
      body: graphql ? JSON.stringify({ query: '{ Media(id: 1) { id } }' }) : undefined,
      headers: {
        Accept: 'application/json',
        'User-Agent': env.userAgent,
        ...(graphql ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

function refresh(id: DataSourceId, url: string) {
  if (checking.has(id)) return
  checking.add(id)
  probe(id, url)
    .then((value) => statuses.set(id, { value, at: Date.now(), url }))
    .finally(() => checking.delete(id))
}

export function resetSourceStatus(id: DataSourceId) {
  statuses.delete(id)
}

export function sourceInfos(): DataSourceInfo[] {
  return DATA_SOURCES.map((id) => {
    const url = sourceUrl(id)
    const status = statuses.get(id)
    const current = status && status.url === url ? status : null
    if (!current || Date.now() - current.at > STATUS_TTL) refresh(id, url)
    return {
      id,
      enabled: sourceEnabled(id),
      url,
      defaultUrl: defaultSourceUrl(id),
      customUrl: Boolean(customSourceUrl(id)),
      reachable: current ? current.value : null,
    }
  })
}
