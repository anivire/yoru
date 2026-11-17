import { z } from 'zod'

export const LIST_STATUSES = ['watching', 'planning', 'completed', 'rewatching', 'paused', 'dropped'] as const
export type ListStatus = (typeof LIST_STATUSES)[number]

export const ANIME_TYPES = ['tv', 'movie', 'ova', 'ona', 'special', 'music', 'tv_special', 'cm', 'pv'] as const
export type AnimeType = (typeof ANIME_TYPES)[number]

export const STREAM_KINDS = ['sub', 'voice', 'subEn', 'voiceEn', 'raw'] as const
export type StreamKind = (typeof STREAM_KINDS)[number]

export const IMPORT_PROVIDERS = ['anilist', 'shikimori', 'mal'] as const
export type ImportProvider = (typeof IMPORT_PROVIDERS)[number]
export type ImportSource = ImportProvider | 'seanime' | 'yoru'

export const EXPORT_FORMATS = ['yoru', 'json', 'csv', 'mal-xml'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const METADATA_SOURCES = ['jikan', 'anime365'] as const
export const DATA_SOURCES = ['anime365', 'jikan', 'shikimori', 'anilist', 'kitsu', 'anilibria', 'kodik', 'aniskip', 'github'] as const
export type DataSourceId = (typeof DATA_SOURCES)[number]
export type MetadataSource = (typeof METADATA_SOURCES)[number]

export const FEATURES = ['discover', 'screenshots', 'russianTitles', 'related', 'skip', 'updates'] as const
export type FeatureId = (typeof FEATURES)[number]

export const FEATURE_SOURCES: Record<FeatureId, DataSourceId> = {
  discover: 'shikimori',
  screenshots: 'shikimori',
  russianTitles: 'shikimori',
  related: 'anilist',
  skip: 'aniskip',
  updates: 'github',
}

export const PROVIDER_CATEGORIES = ['metadata', 'search', 'video'] as const
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number]

export const PROVIDER_GROUPS = ['primary', 'video'] as const
export type ProviderGroup = (typeof PROVIDER_GROUPS)[number]

export interface ProviderEntryInfo {
  id: string
  name: string
  roles: ProviderCategory[]
  source: DataSourceId | null
  extension: string | null
  enabled: boolean
  available: boolean
}

export type ProvidersSettings = Record<ProviderGroup, ProviderEntryInfo[]>

export const providerOrderSchema = z.object({
  entries: z.array(z.object({ id: z.string().min(1).max(64), enabled: z.boolean() })).max(50),
})

export const EXTENSION_TYPES = ['metadata-provider', 'search-provider', 'video-provider'] as const
export type ExtensionType = (typeof EXTENSION_TYPES)[number]

export interface ExtensionSettingField {
  key: string
  label: string
  type: 'text' | 'password'
}

export interface ExtensionLog {
  at: string
  level: 'log' | 'warn' | 'error'
  line: string
}

export interface ExtensionInfo {
  id: string
  name: string
  version: string
  type: ExtensionType
  author: string | null
  description: string | null
  manifestUrl: string | null
  enabled: boolean
  settings: { field: ExtensionSettingField; value: string | null; set: boolean }[]
  lastError: string | null
  lastErrorAt: string | null
  installedAt: string
  updatedAt: string
  logs: ExtensionLog[]
}

export interface ExtensionUpdateResult {
  id: string
  version: string
  updated: boolean
}

export const extensionInstallSchema = z
  .object({
    url: z.string().trim().url().max(2000).optional(),
    manifest: z.string().max(2_000_000).optional(),
  })
  .refine((v) => Boolean(v.url || v.manifest), { message: 'EXTENSION_SOURCE_MISSING' })

export const extensionPatchSchema = z.object({
  enabled: z.boolean().optional(),
  settings: z.record(z.string(), z.string().max(4000).nullable()).optional(),
})

export const SEARCH_FEATURES = ['sort', 'upcoming', 'genres'] as const
export type SearchFeature = (typeof SEARCH_FEATURES)[number]

export const LOCALES = ['ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export type UserRole = 'admin' | 'user'

export interface User {
  id: number
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarCrop: AvatarCrop | null
  role: UserRole
  locale: Locale
  notifySub: boolean
  notifyVoice: boolean
  notifyPremieres: boolean
  notifyAired: boolean
  notifySource: TranslationSource | null
  premiereSource: TranslationSource | null
  airedSource: CalendarSource | null
  notifyFriends: boolean
  notifyComments: boolean
  notifyReactions: boolean
  notifyRecommendations: boolean
  notifyRooms: boolean
  hasOwnAnime365Token: boolean
  hasSharedAnime365Token: boolean
  russianTitles: boolean
  createdAt: string
}

export interface SessionInfo {
  id: string
  current: boolean
  createdAt: string
  lastSeenAt: string | null
  userAgent: string | null
  ip: string | null
}

export interface AccountInfo {
  invitedBy: string | null
  lastLoginAt: string | null
  activeSessions: number
}

export const TITLE_LANGUAGES = ['romaji', 'english', 'japanese', 'russian'] as const
export type TitleLanguage = (typeof TITLE_LANGUAGES)[number]

export interface AnimeTitles {
  title: string
  titleEnglish: string | null
  titleJapanese: string | null
  titleRussian: string | null
}

export interface AnimeSummary extends AnimeTitles {
  malId: number
  imageUrl: string | null
  type: string | null
  episodes: number | null
  status: string | null
  airing: boolean
  year: number | null
  season: string | null
  score: number | null
  genres: string[]
}

export interface Broadcast {
  day: string | null
  time: string | null
  timezone: string | null
}

export interface AnimeDetails extends AnimeSummary {
  synopsis: string | null
  synonyms: string[]
  studios: string[]
  duration: string | null
  rating: string | null
  airedFrom: string | null
  airedTo: string | null
  broadcast: Broadcast
  trailerUrl: string | null
  latestEpisode: number | null
  nextAiringAt: string | null
}

export interface ListEntry {
  malId: number
  status: ListStatus
  progress: number
  score: number | null
  rewatches: number
  notes: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
}

export interface ListEntryWithAnime extends ListEntry {
  anime: AnimeSummary
  latestEpisode: number | null
}

export interface AnimePage {
  anime: AnimeDetails
  entry: ListEntry | null
}

export interface Episode {
  number: number
  title: string | null
  titleJapanese: string | null
  aired: string | null
  filler: boolean
  recap: boolean
  imageUrl: string | null
  available: boolean
  watched: boolean
  position: number | null
  duration: number | null
}

export interface Pagination {
  page: number
  hasNextPage: boolean
  total: number | null
}

export interface SearchResult {
  items: AnimeSummary[]
  pagination: Pagination
  provider: string
  features: SearchFeature[]
}

export interface RelatedAnime {
  relation: string
  anime: AnimeSummary
}

export interface AnimeCharacter {
  id: number
  name: string
  imageUrl: string | null
  role: 'main' | 'supporting' | 'background'
  voiceActor: { name: string; imageUrl: string | null } | null
}

export interface AnimeExtras {
  relations: RelatedAnime[]
  characters: AnimeCharacter[]
  recommendations: AnimeSummary[]
}

export interface Screenshot {
  thumb: string
  full: string
}

export interface Genre {
  id: number
  name: string
  count: number
}

export interface ProviderMatch {
  provider: 'anime365'
  providerId: number | null
  title: string | null
  manual: boolean
}

export const ANIME_SERVICES = ['mal', 'shikimori', 'anilist', 'anidb', 'crunchyroll'] as const
export type AnimeService = (typeof ANIME_SERVICES)[number]

export interface AnimeLink {
  service: AnimeService
  url: string
}

export interface ProviderCandidate {
  providerId: number
  title: string
  year: number | null
  type: string | null
  episodes: number | null
  malId: number | null
  posterUrl: string | null
}

export interface Translation {
  id: string
  kind: StreamKind
  author: string
  priority: number
  qualityType: string | null
  height: number | null
}

export interface StreamSource {
  url: string
  type: 'mp4' | 'm3u8'
  height: number
}

export interface AnilibriaEpisode {
  number: number
  name: string | null
  sources: StreamSource[]
}

export interface AnilibriaRelease {
  releaseId: number | null
  title: string | null
  episodes: AnilibriaEpisode[]
}

export interface VideoProviderInfo {
  id: string
  name: string
  kinds: StreamKind[]
  manualMatch: boolean
}

export interface VideoEpisodes {
  matched: boolean
  title: string | null
  episodes: number[]
}

export interface StreamResult {
  translationId: string
  author: string
  sources: StreamSource[]
  subtitlesUrl: string | null
  embedUrl: string | null
}

export interface ContinueItem {
  anime: AnimeSummary
  episode: number
  episodeTitle: string | null
  episodeImageUrl: string | null
  position: number
  duration: number
  updatedAt: string
  fresh: boolean
  pending: boolean
}

export interface UpcomingItem {
  anime: AnimeSummary
  episode: number | null
  airingAt: string
  bannerUrl: string | null
}

export interface ScheduleItem {
  anime: AnimeSummary
  episode: number
  airingAt: string
  listStatus: ListStatus | null
  aired: boolean
  available: boolean
  estimated: boolean
}

export interface RecentItem {
  anime: AnimeSummary
  episode: number
  at: string
  kind: StreamKind
  author: string | null
}

export interface StatsBucket {
  name: string
  count: number
  minutes: number
  meanScore: number | null
}

export interface UserStats {
  totals: {
    titles: number
    completed: number
    episodes: number
    minutes: number
    meanScore: number | null
    scored: number
    rewatches: number
  }
  statuses: Record<ListStatus, number>
  scores: { score: number; count: number }[]
  genres: StatsBucket[]
  studios: StatsBucket[]
  types: StatsBucket[]
  years: { year: number; count: number }[]
  seasons: { season: string; count: number }[]
  months: { month: string; episodes: number }[]
}

export interface ActivityData {
  days: { date: string; count: number }[]
  total: number
  currentStreak: number
  longestStreak: number
  today: string
}

export interface HomeData {
  continueWatching: ContinueItem[]
  upcoming: UpcomingItem[]
  watching: ListEntryWithAnime[]
}

export interface Notification {
  id: number
  type: 'episode' | 'premiere' | 'aired'
  malId: number
  episode: number
  kind: StreamKind | 'raw'
  source: string | null
  author: string | null
  animeTitle: string
  titles: AnimeTitles
  imageUrl: string | null
  createdAt: string
  readAt: string | null
}

export type SocialNotificationType = 'friend_request' | 'friend_accepted' | 'recommendation' | 'comment' | 'reaction' | 'room_invite' | 'invite_accepted'

export interface SocialNotification {
  id: number
  type: SocialNotificationType
  actor: UserCard
  malId: number | null
  titles: AnimeTitles | null
  imageUrl: string | null
  refId: number | null
  text: string | null
  createdAt: string
  readAt: string | null
}

export interface NotificationList {
  items: Notification[]
  social: SocialNotification[]
  unread: number
}

export interface Invite {
  id: number
  code: string
  note: string | null
  createdAt: string
  expiresAt: string | null
  usedAt: string | null
  usedBy: string | null
  multiUse: boolean
  uses: number
}

export type ReleaseChannel = 'stable' | 'edge'

export interface VersionInfo {
  version: string
  commit: string | null
  commitUrl: string | null
  channel: ReleaseChannel
  repoUrl: string
  latest: { commit: string | null; version: string | null; message: string; date: string | null; url: string } | null
  behindBy: number | null
  updateAvailable: boolean
  compareUrl: string | null
}

export type ChangeType = 'feat' | 'fix' | 'perf' | 'style' | 'refactor' | 'docs' | 'chore' | 'build' | 'revert' | 'other'

export interface ChangelogEntry {
  sha: string
  type: ChangeType
  scope: string | null
  subject: string
  release: string | null
  date: string | null
  url: string
}

export interface Changelog {
  entries: ChangelogEntry[]
  current: string | null
  channel: ReleaseChannel
  nextPage: number | null
}

export interface AdminUser {
  id: number
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarCrop: AvatarCrop | null
  role: UserRole
  createdAt: string
  entries: number
  friends: number
  comments: number
}

export type SkipKind = 'op' | 'ed' | 'recap'

export interface SkipTime {
  kind: SkipKind
  start: number
  end: number
}

export const RELEASE_SOURCES = ['anime365', 'anilibria', 'kodik', 'shikimori'] as const
export type ReleaseSource = (typeof RELEASE_SOURCES)[number]
export const TRANSLATION_SOURCES = ['anime365', 'anilibria', 'kodik'] as const
export type TranslationSource = (typeof TRANSLATION_SOURCES)[number]
export const CALENDAR_SOURCES = ['shikimori'] as const
export type CalendarSource = (typeof CALENDAR_SOURCES)[number]

export interface NotificationSources {
  translations: TranslationSource[]
  calendars: CalendarSource[]
}

export interface ReleaseSourceStatus {
  id: ReleaseSource
  checkedAt: string | null
  error: string | null
  lastFoundAt: string | null
  lastNotifiedAt: string | null
  notified24h: number
}

export interface ReleaseStatus {
  intervalMinutes: number
  lastRunAt: string | null
  nextRunAt: string | null
  sources: ReleaseSourceStatus[]
}

export interface DataSourceInfo {
  id: DataSourceId
  enabled: boolean
  url: string
  defaultUrl: string
  customUrl: boolean
  reachable: boolean | null
}

export interface OAuthProviderInfo {
  configured: boolean
  clientId: string
  hasSecret: boolean
  fromEnv: boolean
  redirectUri: string
}

export interface AdminSettings {
  hasAnime365Token: boolean
  hasKodikToken: boolean
  features: Record<FeatureId, boolean>
  importProviders: Record<ImportProvider, boolean>
  metadataSource: MetadataSource
  sources: DataSourceInfo[]
  github: { repo: string; branch: string; defaultRepo: string; defaultBranch: string; hasToken: boolean }
  oauth: Record<ImportProvider, OAuthProviderInfo>
}

export interface ImportResult {
  provider: ImportSource
  imported: number
  updated: number
  skipped: number
}

export interface ImportStatus {
  providers: Record<ImportProvider, boolean>
  last: (ImportResult & { createdAt: string }) | null
}

export interface ListCounts {
  all: number
  byStatus: Record<ListStatus, number>
}

export interface ListResponse {
  items: ListEntryWithAnime[]
  counts: ListCounts
  total: number
  offset: number
  facets: { years: number[]; types: string[] }
}

export interface ShareInfo {
  token: string | null
  list: boolean
  stats: boolean
}

export type ShareKind = 'list' | 'stats'

export interface PublicShareInfo {
  username: string
  list: boolean
  stats: boolean
}

export const shareUpdateSchema = z.object({ list: z.boolean().optional(), stats: z.boolean().optional() })

export interface PublicStatsResponse extends UserStats {
  username: string
}

export interface PublicListResponse extends ListResponse {
  username: string
}

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
})

export const registerSchema = z.object({
  code: z.string().trim().min(1),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(256),
})

export const confirmPasswordSchema = z.object({
  password: z.string().min(1).max(256),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(256),
})

export const listEntryInputSchema = z.object({
  status: z.enum(LIST_STATUSES),
  progress: z.number().int().min(0).max(100000).optional(),
  score: z.number().min(0).max(10).nullable().optional(),
  rewatches: z.number().int().min(0).max(1000).optional(),
  notes: z.string().max(4000).nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
})
export type ListEntryInput = z.infer<typeof listEntryInputSchema>

export const progressInputSchema = z.object({
  position: z.number().min(0),
  duration: z.number().min(0),
  threshold: z.number().min(0.5).max(1).optional(),
})

export const inviteInputSchema = z.object({
  note: z.string().trim().max(200).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
  multiUse: z.boolean().optional(),
})

export const userSettingsSchema = z.object({
  locale: z.enum(LOCALES).optional(),
  notifySub: z.boolean().optional(),
  notifyVoice: z.boolean().optional(),
  notifyPremieres: z.boolean().optional(),
  notifyAired: z.boolean().optional(),
  notifySource: z.enum(TRANSLATION_SOURCES).nullable().optional(),
  premiereSource: z.enum(TRANSLATION_SOURCES).nullable().optional(),
  airedSource: z.enum(CALENDAR_SOURCES).nullable().optional(),
  notifyFriends: z.boolean().optional(),
  notifyComments: z.boolean().optional(),
  notifyReactions: z.boolean().optional(),
  notifyRecommendations: z.boolean().optional(),
  notifyRooms: z.boolean().optional(),
  anime365Token: z.string().trim().max(512).nullable().optional(),
})

export type UserSettingsInput = z.infer<typeof userSettingsSchema>

const sourcePatchSchema = z.object({
  enabled: z.boolean().optional(),
  url: z
    .string()
    .trim()
    .max(300)
    .regex(/^https?:\/\/\S+$/)
    .nullable()
    .optional(),
})

const oauthPatchSchema = z.object({
  clientId: z.string().trim().max(300).nullable().optional(),
  clientSecret: z.string().trim().max(500).nullable().optional(),
})

export const adminSettingsSchema = z.object({
  anime365Token: z.string().trim().max(512).nullable().optional(),
  kodikToken: z.string().trim().max(512).nullable().optional(),
  features: z.partialRecord(z.enum(FEATURES), z.boolean()).optional(),
  metadataSource: z.enum(METADATA_SOURCES).optional(),
  sources: z
    .object({ anime365: sourcePatchSchema, jikan: sourcePatchSchema, shikimori: sourcePatchSchema, anilist: sourcePatchSchema, kitsu: sourcePatchSchema, anilibria: sourcePatchSchema, kodik: sourcePatchSchema, aniskip: sourcePatchSchema, github: sourcePatchSchema })
    .partial()
    .optional(),
  github: z
    .object({
      repo: z
        .string()
        .trim()
        .regex(/^[\w.-]+\/[\w.-]+$/)
        .nullable()
        .optional(),
      branch: z.string().trim().max(100).nullable().optional(),
      token: z.string().trim().max(300).nullable().optional(),
    })
    .optional(),
  oauth: z.object({ anilist: oauthPatchSchema, shikimori: oauthPatchSchema, mal: oauthPatchSchema }).partial().optional(),
})

export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>

export const providerMatchSchema = z.object({
  providerId: z.number().int().positive().nullable(),
})


export const roomMediaSchema = z.object({
  episode: z.number().int().positive().nullable(),
  source: z.string().min(1).max(64),
  kind: z.enum(STREAM_KINDS),
  author: z.string().max(300).nullable(),
})
export type RoomMedia = z.infer<typeof roomMediaSchema>

export const roomPlaybackInputSchema = z.object({
  playing: z.boolean(),
  position: z.number().min(0).max(1e6),
  rate: z.number().min(0.25).max(4),
})
export type RoomPlaybackInput = z.infer<typeof roomPlaybackInputSchema>

export interface RoomPlayback extends RoomPlaybackInput {
  at: number
}

export interface RoomMember {
  id: number
  username: string
}

export const roomCreateSchema = z.object({ malId: z.number().int().positive(), media: roomMediaSchema })

export interface RoomInfo {
  id: string
  malId: number
}

export interface RoomListItem {
  id: string
  anime: AnimeSummary
  episode: number | null
  playing: boolean
  members: RoomMember[]
}

export const roomClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('media'), media: roomMediaSchema }),
  z.object({ type: z.literal('playback'), playback: roomPlaybackInputSchema }),
  z.object({ type: z.literal('ping') }),
])
export type RoomClientMessage = z.infer<typeof roomClientMessageSchema>

export type RoomServerMessage =
  | { type: 'snapshot'; room: RoomInfo; media: RoomMedia; playback: RoomPlayback; members: RoomMember[]; now: number }
  | { type: 'media'; media: RoomMedia; playback: RoomPlayback; by: RoomMember; now: number }
  | { type: 'playback'; playback: RoomPlayback; by: RoomMember; now: number }
  | { type: 'members'; members: RoomMember[] }
  | { type: 'pong'; now: number }

export interface AvatarCrop {
  x: number
  y: number
  w: number
  h: number
}

export interface UserCard {
  id: number
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarCrop: AvatarCrop | null
}

export type FeedUser = UserCard

export const VISIBILITIES = ['everyone', 'friends', 'private'] as const
export type Visibility = (typeof VISIBILITIES)[number]
export type ProfileVisibility = Exclude<Visibility, 'private'>
export type Relation = 'self' | 'friend' | 'outgoing' | 'incoming' | 'none'

export interface ProfileSettings {
  displayName: string | null
  bio: string | null
  profileVisibility: ProfileVisibility
  listVisibility: Visibility
  statsVisibility: Visibility
  friendsVisibility: Visibility
  shareActivity: boolean
  bannerMalId: number | null
  favorites: AnimeSummary[]
}

export const PROFILE_FAVORITES_MAX = 5

export const profileUpdateSchema = z.object({
  bannerMalId: z.number().int().positive().nullable().optional(),
  favorites: z.array(z.number().int().positive()).max(PROFILE_FAVORITES_MAX).optional(),
  displayName: z.string().trim().max(40).nullable().optional(),
  bio: z.string().trim().max(300).nullable().optional(),
  profileVisibility: z.enum(['everyone', 'friends']).optional(),
  listVisibility: z.enum(VISIBILITIES).optional(),
  statsVisibility: z.enum(VISIBILITIES).optional(),
  friendsVisibility: z.enum(VISIBILITIES).optional(),
  shareActivity: z.boolean().optional(),
})

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

export interface UserProfile {
  user: UserCard
  bio: string | null
  createdAt: string
  relation: Relation
  blocked: boolean
  restricted: boolean
  canSeeList: boolean
  canSeeStats: boolean
  canSeeFriends: boolean
  canSeeActivity: boolean
  friends: number
  statuses: Record<ListStatus, number> | null
  banner: string | null
  favorites: AnimeSummary[]
}

export type FriendTitles = Record<number, UserCard[]>

export interface FriendWatching {
  user: UserCard
  anime: AnimeSummary
  status: ListStatus
  progress: number
  updatedAt: string
}

export const roomInviteSchema = z.object({
  roomId: z.string().min(1).max(64),
  friendIds: z.array(z.number().int().positive()).min(1).max(50),
})

export interface ModerationComment {
  id: number
  user: UserCard
  text: string
  createdAt: string
  anime: AnimeSummary | null
}

export interface ModerationNote {
  id: number
  user: UserCard
  text: string
  createdAt: string
  anime: AnimeSummary | null
}

export interface ModerationProfile {
  user: UserCard
  bio: string | null
  createdAt: string
}

export interface FriendEntry {
  user: UserCard
  status: ListStatus
  progress: number
  score: number | null
}

export const recommendSchema = z.object({
  malId: z.number().int().positive(),
  friendIds: z.array(z.number().int().positive()).min(1).max(50),
  message: z.string().trim().max(300).nullable().optional(),
})

export interface PersonCard extends UserCard {
  relation: Relation
  banner: string | null
  bio: string | null
  titles: number | null
  watching: number | null
  completed: number | null
  friends: number | null
}

export interface FriendsOverview {
  friends: PersonCard[]
  incoming: PersonCard[]
  outgoing: PersonCard[]
}

export interface AnimeNote {
  id: number
  malId: number
  episode: number | null
  text: string
  private: boolean
  createdAt: string
  updatedAt: string
  user: FeedUser
  comments: number
}

export const noteInputSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  episode: z.number().int().positive().nullable().optional(),
  private: z.boolean().optional(),
})
export type NoteInput = z.infer<typeof noteInputSchema>

export const REACTIONS = ['❤️', '🔥', '😂', '😭', '👀', '👍', '🎉', '😍', '😮', '🤔', '💀', '✨'] as const
export type Reaction = (typeof REACTIONS)[number]

export interface ReactionCount {
  emoji: Reaction
  count: number
  mine: boolean
  users: string[]
}

export type CommentTarget = 'event' | 'note'

export interface Comment {
  id: number
  user: UserCard
  text: string
  createdAt: string
  updatedAt: string
  canEdit: boolean
  canDelete: boolean
}

export const commentInputSchema = z.object({
  target: z.enum(['event', 'note']),
  id: z.number().int().positive(),
  text: z.string().trim().min(1).max(1000),
})

export const reactionInputSchema = z.object({ emoji: z.enum(REACTIONS) })

interface FeedBase {
  id: number
  createdAt: string
  user: FeedUser
  anime: AnimeSummary
  reactions: ReactionCount[]
  comments: number
}

export type FeedItem = FeedBase &
  (
    | { type: 'added'; status: ListStatus }
    | { type: 'status'; from: ListStatus; to: ListStatus }
    | { type: 'score'; score: number }
    | { type: 'episodes'; from: number; to: number }
    | { type: 'note'; note: AnimeNote }
  )

export interface FeedPage {
  items: FeedItem[]
  nextBefore: string | null
}
