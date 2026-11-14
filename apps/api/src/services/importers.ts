import { and, eq, lt } from 'drizzle-orm'
import type { ImportProvider, ImportResult, ImportSource, ListStatus } from '@yoru/shared'
import { db, now } from '../db/client'
import { imports, listEntries, oauthStates } from '../db/schema'
import { env } from '../env'
import { randomToken } from '../lib/crypto'
import { UpstreamError } from '../lib/http'
import { oauthConfig, sourceEnabled, sourceUrl } from '../lib/sources'
import { isoDate } from '../lib/time'
import { upsertAnime } from './anime'
import { getEntry } from './lists'
import { syncListActivity } from './activity'
import { kickAnimeBackfill } from '../jobs/anime-backfill'

export interface ImportItem {
  malId: number | null
  title: string
  titleEnglish?: string | null
  titleJapanese?: string | null
  imageUrl?: string | null
  type?: string | null
  episodes?: number | null
  status: ListStatus
  progress: number
  score: number | null
  rewatches: number
  notes: string | null
  startedAt: string | null
  completedAt: string | null
}

export function redirectUri(provider: ImportProvider) {
  return `${env.appUrl}/api/import/${provider}/callback`
}

export function providerEnabled(provider: ImportProvider) {
  const c = oauthConfig(provider)
  return Boolean(c.clientId && c.clientSecret) && (provider !== 'shikimori' || sourceEnabled('shikimori'))
}

export function createAuthorizeUrl(userId: number, provider: ImportProvider): string {
  db.delete(oauthStates).where(lt(oauthStates.createdAt, new Date(Date.now() - 30 * 60_000).toISOString())).run()
  const state = randomToken(24)
  const verifier = provider === 'mal' ? randomToken(48) : null
  db.insert(oauthStates).values({ state, userId, provider, codeVerifier: verifier, createdAt: now() }).run()
  const { clientId } = oauthConfig(provider)
  const redirect = redirectUri(provider)
  switch (provider) {
    case 'anilist': {
      const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', state })
      return `https://anilist.co/api/v2/oauth/authorize?${q}`
    }
    case 'shikimori': {
      const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'user_rates', state })
      return `${sourceUrl('shikimori')}/oauth/authorize?${q}`
    }
    case 'mal': {
      const q = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirect,
        state,
        code_challenge: verifier!,
        code_challenge_method: 'plain',
      })
      return `https://myanimelist.net/v1/oauth2/authorize?${q}`
    }
  }
}

export function consumeState(provider: ImportProvider, state: string) {
  const row = db
    .select()
    .from(oauthStates)
    .where(and(eq(oauthStates.state, state), eq(oauthStates.provider, provider)))
    .get()
  if (row) db.delete(oauthStates).where(eq(oauthStates.state, state)).run()
  return row
}

async function postToken(url: string, body: Record<string, string>, json: boolean, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded',
      'User-Agent': env.userAgent,
      ...extraHeaders,
    },
    body: json ? JSON.stringify(body) : new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new UpstreamError('oauth', res.status, `Token exchange failed: HTTP ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new UpstreamError('oauth', 500, 'Token exchange returned no access_token')
  return data.access_token
}

async function getJson<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': env.userAgent,
      ...(init.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new UpstreamError('import', res.status, `HTTP ${res.status} from ${new URL(url).host}`)
  return (await res.json()) as T
}

export const ANILIST_STATUS: Record<string, ListStatus> = {
  CURRENT: 'watching',
  PLANNING: 'planning',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  PAUSED: 'paused',
  REPEATING: 'rewatching',
}

const ANILIST_QUERY = `query ($userId: Int) {
  MediaListCollection(userId: $userId, type: ANIME) {
    lists { entries {
      status progress repeat notes
      score(format: POINT_10_DECIMAL)
      startedAt { year month day }
      completedAt { year month day }
      media { idMal format episodes title { romaji english native } coverImage { large } }
    } }
  }
}`

interface AniListDate {
  year: number | null
  month: number | null
  day: number | null
}

interface AniListEntry {
  status: string
  progress: number | null
  repeat: number | null
  notes: string | null
  score: number | null
  startedAt: AniListDate | null
  completedAt: AniListDate | null
  media: {
    idMal: number | null
    format: string | null
    episodes: number | null
    title: { romaji: string | null; english: string | null; native: string | null }
    coverImage: { large: string | null } | null
  }
}

async function anilistGraphql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const body = await getJson<{ data: T; errors?: { message: string }[] }>('https://graphql.anilist.co', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (body.errors?.length) throw new UpstreamError('anilist', 500, body.errors.map((e) => e.message).join('; '))
  return body.data
}

async function fetchAniList(code: string): Promise<ImportItem[]> {
  const { clientId, clientSecret } = oauthConfig('anilist')
  const token = await postToken(
    'https://anilist.co/api/v2/oauth/token',
    { grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri('anilist'), code },
    true,
  )
  const viewer = await anilistGraphql<{ Viewer: { id: number } }>(token, 'query { Viewer { id } }')
  const data = await anilistGraphql<{ MediaListCollection: { lists: { entries: AniListEntry[] }[] } }>(token, ANILIST_QUERY, {
    userId: viewer.Viewer.id,
  })
  return data.MediaListCollection.lists
    .flatMap((l) => l.entries)
    .map((e) => ({
      malId: e.media.idMal,
      title: e.media.title.romaji || e.media.title.english || e.media.title.native || '?',
      titleEnglish: e.media.title.english,
      titleJapanese: e.media.title.native,
      imageUrl: e.media.coverImage?.large ?? null,
      type: e.media.format ? e.media.format.toLowerCase() : null,
      episodes: e.media.episodes,
      status: ANILIST_STATUS[e.status] ?? 'planning',
      progress: e.progress ?? 0,
      score: e.score ? e.score : null,
      rewatches: e.repeat ?? 0,
      notes: e.notes,
      startedAt: isoDate(e.startedAt),
      completedAt: isoDate(e.completedAt),
    }))
}

const SHIKI_STATUS: Record<string, ListStatus> = {
  planned: 'planning',
  watching: 'watching',
  rewatching: 'rewatching',
  completed: 'completed',
  on_hold: 'paused',
  dropped: 'dropped',
}

interface ShikiRate {
  status: string
  score: number
  episodes: number
  rewatches: number
  text: string | null
  created_at: string | null
  updated_at: string | null
  anime: {
    id: number
    name: string
    russian: string | null
    kind: string | null
    episodes: number
    image?: { original?: string }
  } | null
}

async function fetchShikimori(code: string): Promise<ImportItem[]> {
  const { clientId, clientSecret } = oauthConfig('shikimori')
  const token = await postToken(`${sourceUrl('shikimori')}/oauth/token`, {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri('shikimori'),
  }, false)
  const me = await getJson<{ id: number }>(`${sourceUrl('shikimori')}/api/users/whoami`, token)
  const items: ImportItem[] = []
  for (let page = 1; page < 50; page++) {
    const rates = await getJson<ShikiRate[]>(`${sourceUrl('shikimori')}/api/users/${me.id}/anime_rates?limit=5000&page=${page}`, token)
    for (const r of rates) {
      if (!r.anime) continue
      const image = r.anime.image?.original
      items.push({
        malId: r.anime.id,
        title: r.anime.name,
        imageUrl: image ? (image.startsWith('http') ? image : `${sourceUrl('shikimori')}${image}`) : null,
        type: r.anime.kind,
        episodes: r.anime.episodes || null,
        status: SHIKI_STATUS[r.status] ?? 'planning',
        progress: r.episodes ?? 0,
        score: r.score > 0 ? r.score : null,
        rewatches: r.rewatches ?? 0,
        notes: r.text,
        startedAt: null,
        completedAt: r.status === 'completed' && r.updated_at ? r.updated_at.slice(0, 10) : null,
      })
    }
    if (rates.length < 5000) break
  }
  return items
}

const MAL_STATUS: Record<string, ListStatus> = {
  watching: 'watching',
  completed: 'completed',
  on_hold: 'paused',
  dropped: 'dropped',
  plan_to_watch: 'planning',
}

interface MalListPage {
  data: {
    node: {
      id: number
      title: string
      main_picture?: { large?: string; medium?: string }
      media_type?: string
      num_episodes?: number
      alternative_titles?: { en?: string; ja?: string }
    }
    list_status: {
      status: string
      score: number
      num_episodes_watched: number
      is_rewatching: boolean
      num_times_rewatched?: number
      start_date?: string
      finish_date?: string
      comments?: string
    }
  }[]
  paging: { next?: string }
}

async function fetchMal(code: string, verifier: string): Promise<ImportItem[]> {
  const { clientId, clientSecret } = oauthConfig('mal')
  const token = await postToken('https://myanimelist.net/v1/oauth2/token', {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri('mal'),
  }, false)
  const fields = 'list_status{comments,num_times_rewatched},num_episodes,media_type,alternative_titles,main_picture'
  let url: string | undefined = `https://api.myanimelist.net/v2/users/@me/animelist?fields=${encodeURIComponent(fields)}&limit=1000&nsfw=true`
  const items: ImportItem[] = []
  while (url) {
    const page: MalListPage = await getJson<MalListPage>(url, token)
    for (const { node, list_status: s } of page.data) {
      items.push({
        malId: node.id,
        title: node.title,
        titleEnglish: node.alternative_titles?.en || null,
        titleJapanese: node.alternative_titles?.ja || null,
        imageUrl: node.main_picture?.large ?? node.main_picture?.medium ?? null,
        type: node.media_type ?? null,
        episodes: node.num_episodes || null,
        status: s.is_rewatching ? 'rewatching' : MAL_STATUS[s.status] ?? 'planning',
        progress: s.num_episodes_watched ?? 0,
        score: s.score > 0 ? s.score : null,
        rewatches: s.num_times_rewatched ?? 0,
        notes: s.comments || null,
        startedAt: s.start_date ?? null,
        completedAt: s.finish_date ?? null,
      })
    }
    url = page.paging.next
  }
  return items
}

export async function fetchProviderList(provider: ImportProvider, code: string, verifier: string | null) {
  switch (provider) {
    case 'anilist':
      return fetchAniList(code)
    case 'shikimori':
      return fetchShikimori(code)
    case 'mal':
      return fetchMal(code, verifier ?? '')
  }
}

export function applyImport(userId: number, provider: ImportSource, items: ImportItem[]): ImportResult {
  const result: ImportResult = { provider, imported: 0, updated: 0, skipped: 0 }
  db.transaction(() => {
    for (const item of items) {
      if (!item.malId) {
        result.skipped++
        continue
      }
      upsertAnime(
        {
          malId: item.malId,
          title: item.title,
          titleEnglish: item.titleEnglish ?? null,
          titleJapanese: item.titleJapanese ?? null,
          imageUrl: item.imageUrl ?? null,
          type: item.type ?? null,
          episodes: item.episodes ?? null,
          updatedAt: now(),
        },
        { onlyIfMissing: true },
      )
      const existing = getEntry(userId, item.malId)
      const values = {
        status: item.status,
        progress: item.progress,
        score: item.score,
        rewatches: item.rewatches,
        notes: item.notes,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        updatedAt: now(),
      }
      if (existing) {
        db.update(listEntries).set(values).where(eq(listEntries.id, existing.id)).run()
        result.updated++
      } else {
        db.insert(listEntries).values({ ...values, userId, malId: item.malId, createdAt: now() }).run()
        result.imported++
      }
    }
    db.insert(imports).values({ ...result, userId, createdAt: now() }).run()
  })
  syncListActivity(userId)
  kickAnimeBackfill()
  return result
}
