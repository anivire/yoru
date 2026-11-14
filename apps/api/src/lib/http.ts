import { eq, lt } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db } from '../db/client'
import { httpCache } from '../db/schema'

export class UpstreamError extends Error {
  constructor(
    public service: string,
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function cacheGet<T>(key: string): T | null {
  const row = db.select().from(httpCache).where(eq(httpCache.key, key)).get()
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
  db.delete(httpCache).where(lt(httpCache.expiresAt, Date.now())).run()
}

const inflight = new Map<string, Promise<unknown>>()

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit !== null) return hit
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const promise = load()
    .then((value) => {
      cacheSet(key, value, ttlMs)
      return value
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
