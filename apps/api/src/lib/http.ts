import { eq, lt } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db } from '../db/client'
import { httpCache } from '../db/schema'
import { env } from '../env'

export class UpstreamError extends Error {
  constructor(
    public service: string,
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export class SourceOffError extends UpstreamError {}

export interface UpstreamInit extends Omit<RequestInit, 'signal' | 'headers'> {
  headers?: Record<string, string>
  timeoutMs?: number
}

export async function upstream(service: string, label: string, url: string, init: UpstreamInit = {}): Promise<Response> {
  const { timeoutMs = 15_000, headers, ...rest } = init
  try {
    return await fetch(url, { ...rest, headers: { Accept: 'application/json', 'User-Agent': env.userAgent, ...headers }, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    throw new UpstreamError(service, 0, `${label} unreachable: ${(error as Error).message}`)
  }
}

export async function upstreamJson<T>(service: string, label: string, url: string, init: UpstreamInit = {}): Promise<T> {
  const res = await upstream(service, label, url, init)
  if (!res.ok) throw new UpstreamError(service, res.status, `${label} HTTP ${res.status}`)
  return (await res.json()) as T
}

const KEEP_STALE_MS = 7 * 86_400_000
const FAILURE_BACKOFF_MS = 60_000

function cacheRow(key: string) {
  return db.select().from(httpCache).where(eq(httpCache.key, key)).get()
}

export function cacheGet<T>(key: string): T | null {
  const row = cacheRow(key)
  if (!row || row.expiresAt < Date.now()) return null
  return JSON.parse(row.value) as T
}

export function cacheSet(key: string, value: unknown, ttlMs: number) {
  const expiresAt = Date.now() + ttlMs
  const json = JSON.stringify(value)
  db.insert(httpCache)
    .values({ key, value: json, expiresAt })
    .onConflictDoUpdate({ target: httpCache.key, set: { value: json, expiresAt } })
    .run()
}

export function cachePurgeExpired() {
  db.delete(httpCache).where(lt(httpCache.expiresAt, Date.now() - KEEP_STALE_MS)).run()
  for (const [key, at] of failedAt) if (Date.now() - at > FAILURE_BACKOFF_MS) failedAt.delete(key)
}

const inflight = new Map<string, Promise<unknown>>()
const failedAt = new Map<string, number>()

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const row = cacheRow(key)
  if (row && row.expiresAt >= Date.now()) return JSON.parse(row.value) as T
  const stale = row ? (JSON.parse(row.value) as T) : null
  if (stale !== null && Date.now() - (failedAt.get(key) ?? 0) < FAILURE_BACKOFF_MS) return stale
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const promise = load()
    .then((value) => {
      cacheSet(key, value, ttlMs)
      failedAt.delete(key)
      return value
    })
    .catch((error: unknown) => {
      if (stale === null || error instanceof SourceOffError) throw error
      failedAt.set(key, Date.now())
      return stale
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

export function badRequest(message: string): never {
  throw new HTTPException(400, { message })
}

export function notFound(message = 'Not found'): never {
  throw new HTTPException(404, { message })
}

export function forbidden(message = 'Forbidden'): never {
  throw new HTTPException(403, { message })
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
