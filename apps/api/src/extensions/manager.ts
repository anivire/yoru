import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { EXTENSION_TYPES, type ExtensionInfo, type ExtensionLog, type ExtensionSettingField, type ExtensionType, STREAM_KINDS, type StreamKind } from '@yoru/shared'
import { db, now } from '../db/client'
import { extensions } from '../db/schema'
import { env } from '../env'
import { UpstreamError, badRequest, notFound } from '../lib/http'
import { setExternalProviders } from '../providers/chain'
import type { AnimeData, MetadataProvider, SearchProvider, VideoProvider } from '../providers/types'
import { type AnimeRow, getAnimeRow, toSummary, upsertAnime } from '../services/anime'
import { proxyUrl } from './proxy'
import { ExtensionError, callExtension } from './sandbox'

type ExtensionRow = typeof extensions.$inferSelect

const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024
const LOG_LIMIT = 50

const manifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/),
    name: z.string().trim().min(1).max(80),
    version: z.string().trim().min(1).max(32),
    type: z.enum(EXTENSION_TYPES),
    author: z.string().trim().max(80).optional(),
    description: z.string().trim().max(500).optional(),
    manifestURI: z.string().url().optional(),
    payloadURI: z.string().min(1).max(2000).optional(),
    payload: z.string().max(1_000_000).optional(),
    kinds: z.array(z.enum(STREAM_KINDS)).min(1).optional(),
    settings: z
      .array(z.object({ key: z.string().regex(/^[A-Za-z0-9_]{1,40}$/), label: z.string().trim().min(1).max(80), type: z.enum(['text', 'password']).default('text') }))
      .max(20)
      .optional(),
  })
  .refine((m) => Boolean(m.payload || m.payloadURI), { message: 'The manifest has neither payload nor payloadURI' })

type Manifest = z.infer<typeof manifestSchema>

const optionalString = z.string().nullish().transform((v) => v ?? null)
const optionalNumber = z.number().nullish().transform((v) => v ?? null)

const animeSchema = z.object({
  malId: z.number().int().positive().optional(),
  title: z.string().min(1),
  titleEnglish: optionalString,
  titleJapanese: optionalString,
  titleRussian: optionalString,
  synonyms: z.array(z.string()).optional(),
  imageUrl: optionalString,
  type: optionalString,
  episodes: optionalNumber,
  status: z.enum(['airing', 'finished', 'upcoming']).nullish().transform((v) => v ?? null),
  year: optionalNumber,
  season: optionalString,
  score: optionalNumber,
  genres: z.array(z.string()).optional(),
  studios: z.array(z.string()).optional(),
  synopsis: optionalString,
  duration: optionalString,
  rating: optionalString,
  airedFrom: optionalString,
  airedTo: optionalString,
  trailerUrl: optionalString,
})

const searchSchema = z.object({
  items: z.array(animeSchema.extend({ malId: z.number().int().positive() })),
  hasNextPage: z.boolean().optional(),
})

const episodesSchema = z.object({
  matched: z.boolean(),
  title: optionalString,
  episodes: z.array(z.number().int().positive()),
})

const translationsSchema = z.array(
  z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    kind: z.enum(STREAM_KINDS),
    author: z.string().min(1),
    priority: z.number().optional(),
    quality: optionalString,
    height: optionalNumber,
  }),
)

const streamSchema = z
  .object({
    sources: z.array(z.object({ url: z.string().url(), type: z.enum(['mp4', 'm3u8']), height: z.number().int().nonnegative().optional() })).default([]),
    subtitlesUrl: z.string().url().nullish(),
    embedUrl: z.string().url().nullish(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .refine((s) => s.sources.length > 0 || Boolean(s.embedUrl), { message: 'Return sources or embedUrl' })

const logs = new Map<string, ExtensionLog[]>()

function pushLog(id: string, level: ExtensionLog['level'], line: string) {
  const list = logs.get(id) ?? []
  list.push({ at: now(), level, line })
  if (list.length > LOG_LIMIT) list.splice(0, list.length - LOG_LIMIT)
  logs.set(id, list)
}

function fields(row: ExtensionRow): ExtensionSettingField[] {
  return ((row.manifest as Partial<Manifest>).settings ?? []).map((f) => ({ key: f.key, label: f.label, type: f.type ?? 'text' }))
}

function animeData(raw: z.infer<typeof animeSchema>, malId: number): AnimeData {
  return {
    ...raw,
    malId,
    titleRussian: raw.titleRussian,
    synonyms: raw.synonyms ?? [],
    genres: raw.genres ?? [],
    studios: raw.studios ?? [],
    airing: raw.status === 'airing',
    updatedAt: now(),
  }
}

function animeContext(row: AnimeRow | undefined, malId: number) {
  return {
    malId,
    title: row?.title ?? null,
    titleEnglish: row?.titleEnglish ?? null,
    titleJapanese: row?.titleJapanese ?? null,
    titleRussian: row?.titleRussian ?? null,
    synonyms: row?.synonyms ?? [],
    type: row?.type ?? null,
    year: row?.year ?? null,
    episodes: row?.episodes ?? null,
  }
}

async function call<T>(id: string, method: string, args: unknown[], schema: z.ZodType<T>): Promise<T> {
  const row = db.select().from(extensions).where(eq(extensions.id, id)).get()
  if (!row?.enabled) throw new ExtensionError('The extension is turned off')
  try {
    const raw = await callExtension(row.code, method, args, { settings: row.settings, log: (level, line) => pushLog(id, level, line) })
    const parsed = schema.safeParse(raw)
    if (!parsed.success) throw new ExtensionError(`Unexpected ${method} result: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
    if (row.lastError) db.update(extensions).set({ lastError: null, lastErrorAt: null }).where(eq(extensions.id, id)).run()
    return parsed.data
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    pushLog(id, 'error', `${method}: ${message}`)
    db.update(extensions).set({ lastError: `${method}: ${message}`.slice(0, 1000), lastErrorAt: now() }).where(eq(extensions.id, id)).run()
    throw new UpstreamError(`ext:${id}`, 502, message)
  }
}

function enabledCheck(id: string) {
  return () => Boolean(db.select({ enabled: extensions.enabled }).from(extensions).where(eq(extensions.id, id)).get()?.enabled)
}

function metadataProvider(row: ExtensionRow): MetadataProvider {
  return {
    id: `ext:${row.id}`,
    name: row.name,
    builtin: false,
    available: enabledCheck(row.id),
    async anime(malId) {
      const raw = await call(row.id, 'anime', [malId], animeSchema.nullable())
      return raw ? animeData(raw, malId) : null
    },
  }
}

function searchProvider(row: ExtensionRow): SearchProvider {
  return {
    id: `ext:${row.id}`,
    name: row.name,
    builtin: false,
    features: [],
    available: enabledCheck(row.id),
    accepts: (query) => !query.genres.length,
    async search(query) {
      const raw = await call(row.id, 'search', [{ q: query.q, page: query.page, type: query.type ?? null, status: query.status ?? null }], searchSchema)
      const items = raw.items.map((item) => {
        upsertAnime(animeData(item, item.malId), { onlyIfMissing: true })
        return toSummary(getAnimeRow(item.malId)!)
      })
      return { items, hasNextPage: raw.hasNextPage ?? false, total: null }
    },
  }
}

function videoProvider(row: ExtensionRow): VideoProvider {
  const kinds = ((row.manifest as Partial<Manifest>).kinds ?? [...STREAM_KINDS]) as StreamKind[]
  return {
    id: `ext:${row.id}`,
    name: row.name,
    builtin: false,
    kinds,
    manualMatch: false,
    available: enabledCheck(row.id),
    async episodes(malId) {
      const raw = await call(row.id, 'episodes', [animeContext(getAnimeRow(malId), malId)], episodesSchema)
      return { matched: raw.matched, title: raw.title, episodes: [...new Set(raw.episodes)].sort((a, b) => a - b) }
    },
    async translations(malId, episode, kind) {
      const raw = await call(row.id, 'translations', [animeContext(getAnimeRow(malId), malId), episode, kind], translationsSchema)
      return raw
        .filter((t) => t.kind === kind)
        .map((t) => ({ id: t.id, kind: t.kind, author: t.author, priority: t.priority ?? 0, qualityType: t.quality, height: t.height }))
    },
    async stream(_user, malId, episode, translationId, author) {
      const raw = await call(row.id, 'stream', [animeContext(getAnimeRow(malId), malId), episode, translationId], streamSchema)
      const headers = raw.headers ?? {}
      const proxied = Object.keys(headers).length > 0
      return {
        translationId,
        author,
        sources: raw.sources
          .map((s) => ({ url: proxied ? proxyUrl(s.url, headers) : s.url, type: s.type, height: s.height ?? 0 }))
          .sort((a, b) => b.height - a.height),
        subtitlesUrl: raw.subtitlesUrl ? proxyUrl(raw.subtitlesUrl, headers) : null,
        embedUrl: raw.embedUrl ?? null,
      }
    },
  }
}

export function loadExtensions() {
  const rows = db.select().from(extensions).all()
  const ofType = (type: ExtensionType) => rows.filter((r) => r.type === type)
  setExternalProviders('metadata', ofType('metadata-provider').map(metadataProvider))
  setExternalProviders('search', ofType('search-provider').map(searchProvider))
  setExternalProviders('video', ofType('video-provider').map(videoProvider))
}

async function download(url: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, { headers: { 'User-Agent': env.userAgent }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
  } catch (error) {
    badRequest(`EXTENSION_DOWNLOAD_FAILED: ${(error as Error).message}`)
  }
  if (!res.ok) badRequest(`EXTENSION_DOWNLOAD_FAILED: HTTP ${res.status}`)
  const text = await res.text()
  if (text.length > MAX_DOWNLOAD_BYTES) badRequest('EXTENSION_TOO_LARGE')
  return text
}

function parseManifest(text: string): Manifest {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    badRequest('EXTENSION_MANIFEST_INVALID')
  }
  const parsed = manifestSchema.safeParse(json)
  if (!parsed.success) badRequest(`EXTENSION_MANIFEST_INVALID: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'manifest'}: ${i.message}`).join('; ')}`)
  return parsed.data
}

function resolveUrl(url: string, base: string | null): string {
  try {
    return new URL(url, base ?? undefined).href
  } catch {
    badRequest('EXTENSION_PAYLOAD_URL_INVALID')
  }
}

async function fromManifest(manifest: Manifest, manifestUrl: string | null) {
  const code = manifest.payload ?? (await download(resolveUrl(manifest.payloadURI!, manifestUrl)))
  const existing = db.select().from(extensions).where(eq(extensions.id, manifest.id)).get()
  if (existing && existing.type !== manifest.type) badRequest('EXTENSION_TYPE_CHANGED')
  const values = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    author: manifest.author ?? null,
    description: manifest.description ?? null,
    manifestUrl: manifest.manifestURI ?? manifestUrl,
    manifest: manifest as unknown as Record<string, unknown>,
    code,
    lastError: null,
    lastErrorAt: null,
    updatedAt: now(),
  }
  if (existing) db.update(extensions).set(values).where(eq(extensions.id, manifest.id)).run()
  else db.insert(extensions).values({ ...values, enabled: true, settings: {}, installedAt: now() }).run()
  loadExtensions()
  return manifest.id
}

export async function installExtension(input: { url?: string; manifest?: string }): Promise<string> {
  const text = input.manifest ?? (await download(input.url!))
  return fromManifest(parseManifest(text), input.url ?? null)
}

export async function updateExtension(id: string): Promise<{ version: string; updated: boolean }> {
  const row = db.select().from(extensions).where(eq(extensions.id, id)).get() ?? notFound('EXTENSION_NOT_FOUND')
  if (!row.manifestUrl) badRequest('EXTENSION_NO_UPDATE_URL')
  const manifest = parseManifest(await download(row.manifestUrl))
  if (manifest.id !== row.id) badRequest('EXTENSION_ID_CHANGED')
  if (manifest.version === row.version) return { version: row.version, updated: false }
  await fromManifest(manifest, row.manifestUrl)
  return { version: manifest.version, updated: true }
}

export function patchExtension(id: string, patch: { enabled?: boolean; settings?: Record<string, string | null> }) {
  const row = db.select().from(extensions).where(eq(extensions.id, id)).get() ?? notFound('EXTENSION_NOT_FOUND')
  const allowed = new Set(fields(row).map((f) => f.key))
  const settings = { ...row.settings }
  for (const [key, value] of Object.entries(patch.settings ?? {})) {
    if (!allowed.has(key)) continue
    if (value === null || value === '') delete settings[key]
    else settings[key] = value
  }
  db.update(extensions)
    .set({ enabled: patch.enabled ?? row.enabled, settings, updatedAt: now() })
    .where(eq(extensions.id, id))
    .run()
}

export function removeExtension(id: string) {
  db.delete(extensions).where(eq(extensions.id, id)).run()
  logs.delete(id)
  loadExtensions()
}

export function listExtensions(): ExtensionInfo[] {
  return db
    .select()
    .from(extensions)
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      version: row.version,
      type: row.type,
      author: row.author,
      description: row.description,
      manifestUrl: row.manifestUrl,
      enabled: row.enabled,
      settings: fields(row).map((field) => ({
        field,
        value: field.type === 'password' ? null : (row.settings[field.key] ?? null),
        set: Boolean(row.settings[field.key]),
      })),
      lastError: row.lastError,
      lastErrorAt: row.lastErrorAt,
      installedAt: row.installedAt,
      updatedAt: row.updatedAt,
      logs: [...(logs.get(row.id) ?? [])].reverse(),
    }))
}
