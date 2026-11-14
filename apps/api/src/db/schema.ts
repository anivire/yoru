import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  locale: text('locale', { enum: ['ru', 'en'] }).notNull().default('ru'),
  notifySub: integer('notify_sub', { mode: 'boolean' }).notNull().default(true),
  notifyVoice: integer('notify_voice', { mode: 'boolean' }).notNull().default(true),
  anime365Token: text('anime365_token'),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('users_username_idx').on(t.username)])

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [index('sessions_user_idx').on(t.userId)])

export const invites = sqliteTable('invites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  note: text('note'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
  usedAt: text('used_at'),
}, (t) => [uniqueIndex('invites_code_idx').on(t.code)])

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const anime = sqliteTable('anime', {
  malId: integer('mal_id').primaryKey(),
  title: text('title').notNull(),
  titleEnglish: text('title_english'),
  titleJapanese: text('title_japanese'),
  synonyms: text('synonyms', { mode: 'json' }).$type<string[]>().notNull().default([]),
  imageUrl: text('image_url'),
  type: text('type'),
  episodes: integer('episodes'),
  status: text('status'),
  airing: integer('airing', { mode: 'boolean' }).notNull().default(false),
  year: integer('year'),
  season: text('season'),
  score: real('score'),
  genres: text('genres', { mode: 'json' }).$type<string[]>().notNull().default([]),
  studios: text('studios', { mode: 'json' }).$type<string[]>().notNull().default([]),
  synopsis: text('synopsis'),
  duration: text('duration'),
  rating: text('rating'),
  airedFrom: text('aired_from'),
  airedTo: text('aired_to'),
  broadcastDay: text('broadcast_day'),
  broadcastTime: text('broadcast_time'),
  broadcastTimezone: text('broadcast_timezone'),
  trailerUrl: text('trailer_url'),
  latestEpisode: integer('latest_episode'),
  detailsFetchedAt: text('details_fetched_at'),
  updatedAt: text('updated_at').notNull(),
})

export const listEntries = sqliteTable('list_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  malId: integer('mal_id').notNull().references(() => anime.malId),
  status: text('status', { enum: ['watching', 'planning', 'completed', 'rewatching', 'paused', 'dropped'] }).notNull(),
  progress: integer('progress').notNull().default(0),
  score: real('score'),
  rewatches: integer('rewatches').notNull().default(0),
  notes: text('notes'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  uniqueIndex('list_entries_user_anime_idx').on(t.userId, t.malId),
  index('list_entries_anime_idx').on(t.malId),
])

export const watchProgress = sqliteTable('watch_progress', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  malId: integer('mal_id').notNull(),
  episode: integer('episode').notNull(),
  position: real('position').notNull().default(0),
  duration: real('duration').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.malId, t.episode] }),
  index('watch_progress_user_updated_idx').on(t.userId, t.updatedAt),
])

export const providerMappings = sqliteTable('provider_mappings', {
  provider: text('provider').notNull(),
  malId: integer('mal_id').notNull(),
  providerId: integer('provider_id'),
  title: text('title'),
  manual: integer('manual', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
}, (t) => [primaryKey({ columns: [t.provider, t.malId] })])

export const providerReleases = sqliteTable('provider_releases', {
  provider: text('provider').notNull(),
  malId: integer('mal_id').notNull(),
  episode: integer('episode').notNull(),
  kind: text('kind', { enum: ['sub', 'voice'] }).notNull(),
  translationId: integer('translation_id').notNull(),
  author: text('author'),
  releasedAt: text('released_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.provider, t.malId, t.episode, t.kind] }),
  index('provider_releases_anime_idx').on(t.malId),
])

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  malId: integer('mal_id').notNull(),
  episode: integer('episode').notNull(),
  kind: text('kind', { enum: ['sub', 'voice'] }).notNull(),
  author: text('author'),
  createdAt: text('created_at').notNull(),
  readAt: text('read_at'),
}, (t) => [
  index('notifications_user_idx').on(t.userId, t.createdAt),
  uniqueIndex('notifications_unique_idx').on(t.userId, t.malId, t.episode, t.kind),
])

export const oauthStates = sqliteTable('oauth_states', {
  state: text('state').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  codeVerifier: text('code_verifier'),
  createdAt: text('created_at').notNull(),
})

export const imports = sqliteTable('imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  imported: integer('imported').notNull().default(0),
  updated: integer('updated').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  createdAt: text('created_at').notNull(),
})

export const httpCache = sqliteTable('http_cache', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at').notNull(),
})
