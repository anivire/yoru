import { eq } from 'drizzle-orm'
import type { MetadataSource } from '@yoru/shared'
import { db } from '../db/client'
import { settings } from '../db/schema'
import { env } from '../env'

export function getSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get()
  return row?.value ?? null
}

export function setSetting(key: string, value: string | null) {
  if (value === null) {
    db.delete(settings).where(eq(settings.key, key)).run()
    return
  }
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run()
}

export function metadataSource(): MetadataSource {
  return (getSetting('metadata_source') ?? env.metadataSource) === 'anime365' ? 'anime365' : 'jikan'
}
