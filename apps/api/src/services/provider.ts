import { and, eq } from 'drizzle-orm'
import type { ProviderMatch, StreamKind, StreamResult, Translation } from '@yoru/shared'
import { db, now } from '../db/client'
import { providerMappings } from '../db/schema'
import { env } from '../env'
import type { UserRow } from '../lib/auth'
import { UpstreamError, badRequest } from '../lib/http'
import { getSetting } from '../lib/settings'
import { setLatestEpisode } from './anime'
import { anime365, seriesTitle } from './anime365'

export const PROVIDER = 'anime365'
const MAPPING_TTL_MS = 24 * 3_600_000

function readMapping(malId: number) {
  return db
    .select()
    .from(providerMappings)
    .where(and(eq(providerMappings.provider, PROVIDER), eq(providerMappings.malId, malId)))
    .get()
}

function writeMapping(malId: number, providerId: number | null, title: string | null, manual: boolean) {
  const values = { provider: PROVIDER, malId, providerId, title, manual, updatedAt: now() }
  db.insert(providerMappings)
    .values(values)
    .onConflictDoUpdate({ target: [providerMappings.provider, providerMappings.malId], set: values })
    .run()
}

export async function resolveMatch(malId: number): Promise<ProviderMatch> {
  const row = readMapping(malId)
  const stale = !row || (!row.manual && !row.providerId && Date.now() - Date.parse(row.updatedAt) > MAPPING_TTL_MS)
  if (row && !stale) return { provider: PROVIDER, providerId: row.providerId, title: row.title, manual: row.manual }
  const series = await anime365.seriesByMal(malId)
  writeMapping(malId, series?.id ?? null, series ? seriesTitle(series) : null, false)
  return { provider: PROVIDER, providerId: series?.id ?? null, title: series ? seriesTitle(series) : null, manual: false }
}

export async function setManualMatch(malId: number, providerId: number | null): Promise<ProviderMatch> {
  if (providerId === null) {
    db.delete(providerMappings)
      .where(and(eq(providerMappings.provider, PROVIDER), eq(providerMappings.malId, malId)))
      .run()
    return resolveMatch(malId)
  }
  const series = await anime365.series(providerId)
  writeMapping(malId, series.id, seriesTitle(series), true)
  return { provider: PROVIDER, providerId: series.id, title: seriesTitle(series), manual: true }
}

export async function providerEpisodes(malId: number, fresh = false) {
  const match = await resolveMatch(malId)
  if (!match.providerId) return []
  const episodes = await anime365.episodes(match.providerId, fresh)
  const last = episodes.at(-1)
  if (last) setLatestEpisode(malId, Number(last.episodeInt))
  return episodes
}

async function providerEpisode(malId: number, episode: number) {
  const episodes = await providerEpisodes(malId)
  const found = episodes.find((e) => Number(e.episodeInt) === episode)
  if (!found) badRequest('Episode is not available on Anime365')
  return found
}

export async function listTranslations(malId: number, episode: number, kind: StreamKind): Promise<Translation[]> {
  const ep = await providerEpisode(malId, episode)
  const rows = await anime365.translations(ep.id, kind)
  return rows.map((t) => ({
    id: String(t.id),
    kind,
    author: t.authorsSummary || t.title || t.type,
    priority: Number(t.priority) || 0,
    qualityType: t.qualityType ?? null,
    height: t.height ?? null,
  }))
}

export function tokenFor(user: UserRow): string | null {
  return user.anime365Token || getSetting('anime365_token') || env.anime365Token || null
}

export async function streamTranslation(user: UserRow, translationId: number, author: string): Promise<StreamResult> {
  const token = tokenFor(user)
  if (!token) badRequest('ANIME365_TOKEN_MISSING')
  try {
    const embed = await anime365.embed(translationId, token)
    if (!embed.sources.length) badRequest('NO_SOURCES')
    return {
      translationId: String(translationId),
      author,
      sources: embed.sources,
      subtitlesUrl: embed.subtitlesUrl ? `/api/stream/subtitles/${translationId}` : null,
      embedUrl: null,
    }
  } catch (error) {
    if (error instanceof UpstreamError && (error.status === 401 || error.status === 403)) badRequest('ANIME365_TOKEN_INVALID')
    throw error
  }
}

const subtitleUrls = new Map<number, string>()

export async function subtitlesFor(user: UserRow, translationId: number): Promise<Response> {
  let url = subtitleUrls.get(translationId)
  if (!url) {
    const token = tokenFor(user)
    if (!token) badRequest('ANIME365_TOKEN_MISSING')
    const embed = await anime365.embed(translationId, token)
    if (!embed.subtitlesUrl) badRequest('NO_SUBTITLES')
    url = embed.subtitlesUrl
    subtitleUrls.set(translationId, url)
    if (subtitleUrls.size > 500) subtitleUrls.delete(subtitleUrls.keys().next().value!)
  }
  const res = await fetch(url, { headers: { 'User-Agent': env.userAgent }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new UpstreamError('anime365', res.status, `Subtitles HTTP ${res.status}`)
  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
