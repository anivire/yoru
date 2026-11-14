import type { AnimeLink, AnimeService } from '@yoru/shared'
import { env } from '../env'
import { anime365 } from './anime365'
import { resolveMatch } from './provider'

const HOSTS: [AnimeService, RegExp][] = [
  ['anilist', /(^|\.)anilist\.co$/],
  ['anidb', /(^|\.)anidb\.net$/],
  ['kinopoisk', /(^|\.)kinopoisk\.ru$/],
  ['crunchyroll', /(^|\.)crunchyroll\.com$/],
]

function host(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export async function animeLinks(malId: number): Promise<AnimeLink[]> {
  const links: AnimeLink[] = [
    { service: 'mal', url: `https://myanimelist.net/anime/${malId}` },
    { service: 'shikimori', url: `${env.shikimoriUrl}/animes/${malId}` },
  ]
  const match = await resolveMatch(malId).catch(() => null)
  if (!match?.providerId) return links
  const series = await anime365.series(match.providerId).catch(() => null)
  const found = new Map<AnimeService, string>()
  if (series?.anilistId) found.set('anilist', `https://anilist.co/anime/${series.anilistId}`)
  for (const link of series?.links ?? []) {
    const h = host(link.url)
    if (!h) continue
    const service = HOSTS.find(([, re]) => re.test(h))?.[0]
    if (service && !found.has(service)) found.set(service, link.url)
  }
  if (found.has('anilist')) links.push({ service: 'anilist', url: found.get('anilist')! })
  for (const service of ['anidb', 'kinopoisk', 'crunchyroll'] as const) {
    const url = found.get(service)
    if (url) links.push({ service, url })
  }
  return links
}
