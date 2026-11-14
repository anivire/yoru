import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { env } from '../env'
import * as schema from './schema'

fs.mkdirSync(path.dirname(env.databasePath), { recursive: true })

const sqlite = new Database(env.databasePath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('busy_timeout = 5000')

export const db = drizzle(sqlite, { schema })
export type DB = typeof db

function migrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.resolve(here, '../drizzle'),
    path.resolve(here, '../../drizzle'),
  ].filter((p): p is string => Boolean(p))
  const found = candidates.find((p) => fs.existsSync(path.join(p, 'meta', '_journal.json')))
  if (!found) throw new Error('Migrations folder not found')
  return found
}

export function runMigrations() {
  migrate(db, { migrationsFolder: migrationsFolder() })
}

export function now(): string {
  return new Date().toISOString()
}
