import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  locale: text('locale', { enum: ['ru', 'en'] }).notNull().default('ru'),
  notifySub: integer('notify_sub', { mode: 'boolean' }).notNull().default(true),
  notifyVoice: integer('notify_voice', { mode: 'boolean' }).notNull().default(true),
  notifyPremieres: integer('notify_premieres', { mode: 'boolean' }).notNull().default(true),
  notifyFriends: integer('notify_friends', { mode: 'boolean' }).notNull().default(true),
  notifyComments: integer('notify_comments', { mode: 'boolean' }).notNull().default(true),
  notifyReactions: integer('notify_reactions', { mode: 'boolean' }).notNull().default(true),
  notifyRecommendations: integer('notify_recommendations', { mode: 'boolean' }).notNull().default(true),
  notifyRooms: integer('notify_rooms', { mode: 'boolean' }).notNull().default(true),
  anime365Token: text('anime365_token'),
  shareToken: text('share_token'),
  shareList: integer('share_list', { mode: 'boolean' }).notNull().default(true),
  shareStats: integer('share_stats', { mode: 'boolean' }).notNull().default(false),
  displayName: text('display_name'),
  bio: text('bio'),
  avatarVersion: integer('avatar_version'),
  bannerMalId: integer('banner_mal_id'),
  favorites: text('favorites', { mode: 'json' }).$type<number[]>().notNull().default([]),
  profileVisibility: text('profile_visibility', { enum: ['everyone', 'friends'] }).notNull().default('everyone'),
  listVisibility: text('list_visibility', { enum: ['everyone', 'friends', 'private'] }).notNull().default('everyone'),
  statsVisibility: text('stats_visibility', { enum: ['everyone', 'friends', 'private'] }).notNull().default('everyone'),
  shareActivity: integer('share_activity', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('users_username_idx').on(t.username), uniqueIndex('users_share_token_idx').on(t.shareToken)])

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  userAgent: text('user_agent'),
  ip: text('ip'),
  lastSeenAt: text('last_seen_at'),
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
  titleRussian: text('title_russian'),
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

export const activity = sqliteTable('activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  malId: integer('mal_id').notNull(),
  episode: integer('episode').notNull(),
  source: text('source', { enum: ['watch', 'list'] }).notNull().default('watch'),
  createdAt: text('created_at').notNull(),
}, (t) => [index('activity_user_created_idx').on(t.userId, t.createdAt)])

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
  type: text('type', { enum: ['episode', 'premiere'] }).notNull().default('episode'),
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

export const animeNotes = sqliteTable('anime_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  malId: integer('mal_id').notNull(),
  episode: integer('episode'),
  text: text('text').notNull(),
  private: integer('private', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [index('anime_notes_anime_idx').on(t.malId, t.createdAt), index('anime_notes_user_idx').on(t.userId)])

export const feedEvents = sqliteTable('feed_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  malId: integer('mal_id').notNull(),
  type: text('type', { enum: ['added', 'status', 'score', 'episodes', 'note'] }).notNull(),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: text('created_at').notNull(),
}, (t) => [index('feed_events_created_idx').on(t.createdAt), index('feed_events_user_idx').on(t.userId, t.createdAt)])

export const friendships = sqliteTable('friendships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: integer('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'accepted'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  acceptedAt: text('accepted_at'),
}, (t) => [uniqueIndex('friendships_pair_idx').on(t.userId, t.friendId), index('friendships_friend_idx').on(t.friendId)])

export const blocks = sqliteTable('blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: integer('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('blocks_pair_idx').on(t.userId, t.blockedId), index('blocks_blocked_idx').on(t.blockedId)])

export const reactions = sqliteTable('reactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull().references(() => feedEvents.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('reactions_user_event_idx').on(t.userId, t.eventId), index('reactions_event_idx').on(t.eventId)])

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: text('target_type', { enum: ['event', 'note'] }).notNull(),
  targetId: integer('target_id').notNull(),
  text: text('text').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [index('comments_target_idx').on(t.targetType, t.targetId, t.createdAt), index('comments_user_idx').on(t.userId)])

export const recommendations = sqliteTable('recommendations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: integer('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  malId: integer('mal_id').notNull(),
  message: text('message'),
  createdAt: text('created_at').notNull(),
}, (t) => [index('recommendations_friend_idx').on(t.friendId, t.createdAt)])

export const socialNotifications = sqliteTable('social_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorId: integer('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['friend_request', 'friend_accepted', 'recommendation', 'comment', 'reaction', 'room_invite'] }).notNull(),
  malId: integer('mal_id'),
  refId: integer('ref_id'),
  text: text('text'),
  createdAt: text('created_at').notNull(),
  readAt: text('read_at'),
}, (t) => [index('social_notifications_user_idx').on(t.userId, t.createdAt)])
