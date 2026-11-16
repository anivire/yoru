import type {
  AvatarCrop,
  Changelog,
  PersonCard,
  FriendTitles,
  FriendWatching,
  ModerationComment,
  ModerationNote,
  ModerationProfile,
  Comment,
  CommentTarget,
  FriendEntry,
  Reaction,
  FriendsOverview,
  ProfileSettings,
  ProfileUpdate,
  Relation,
  UserProfile,
  SkipTime,
  AccountInfo,
  ActivityData,
  UserStats,
  AdminSettings,
  AdminSettingsInput,
  AdminUser,
  AnimeLink,
  AnimePage,
  AnimeSummary,
  Episode,
  Genre,
  HomeData,
  ImportResult,
  ImportStatus,
  Invite,
  ListEntry,
  ListEntryInput,
  ListResponse,
  ListStatus,
  NotificationList,
  ProviderCandidate,
  ProviderMatch,
  PublicListResponse,
  RecentItem,
  ScheduleItem,
  SearchResult,
  SessionInfo,
  ShareInfo,
  PublicShareInfo,
  RoomInfo,
  RoomListItem,
  AnimeNote,
  FeedPage,
  NoteInput,
  RoomMedia,
  PublicStatsResponse,
  StreamKind,
  StreamResult,
  Translation,
  User,
  VersionInfo, AnimeExtras, Screenshot, VideoEpisodes, VideoProviderInfo, ProviderCategory, ProvidersSettings } from '@yoru/shared'
import type { FeedScope } from './appearance'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const form = body instanceof FormData
  const blob = body instanceof Blob
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined || form ? undefined : { 'Content-Type': blob ? body.type : 'application/json' },
    body: body === undefined ? undefined : form || blob ? body : JSON.stringify(body),
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      message = ((await res.json()) as { error?: string }).error ?? message
    } catch {}
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

const get = <T>(path: string) => request<T>('GET', path)

function qs(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const api = {
  me: () => get<User>('/auth/me'),
  account: () => get<AccountInfo>('/me/account'),
  sessions: () => get<SessionInfo[]>('/me/sessions'),
  revokeSession: (id: string) => request<{ ok: true; signedOut: boolean }>('DELETE', '/me/sessions/' + encodeURIComponent(id)),
  revokeOtherSessions: () => request<{ ok: true }>('DELETE', '/me/sessions'),
  login: (username: string, password: string) => request<User>('POST', '/auth/login', { username, password }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  invite: (code: string) => get<{ valid: boolean; role: string | null; inviter: { username: string; displayName: string | null } | null }>(`/auth/invite/${encodeURIComponent(code)}`),
  register: (code: string, username: string, password: string) => request<User>('POST', '/auth/register', { code, username, password }),
  clearData: (password: string) => request<{ ok: true }>('POST', '/me/clear', { password }),
  deleteAccount: (password: string) => request<{ ok: true }>('POST', '/me/delete', { password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/password', { currentPassword, newPassword }),
  updateSettings: (patch: Partial<Pick<User, 'locale' | 'notifySub' | 'notifyVoice'>> & { anime365Token?: string | null }) =>
    request<User>('PATCH', '/me/settings', patch),

  home: () => get<HomeData>('/home'),
  activity: (tz: string) => get<ActivityData>(`/home/activity${qs({ tz })}`),
  stats: (tz: string) => get<UserStats>(`/stats${qs({ tz })}`),
  version: () => get<VersionInfo>('/version'),
  changelog: (page: number) => get<Changelog>(`/version/changelog${qs({ page })}`),
  discoverCollection: (name: 'hero' | 'top' | 'anons') => get<AnimeSummary[]>(`/discover/${name}`),
  discoverRecent: () => get<RecentItem[]>('/discover/recent'),
  trending: (genre: number | null) => get<AnimeSummary[]>(`/discover/trending${qs({ genre: genre ?? undefined })}`),
  discoverGenres: () => get<Genre[]>('/discover/genres'),
  schedule: (from: string, to: string) => get<ScheduleItem[]>(`/schedule${qs({ from, to })}`),
  banner: (malId: number) => get<{ url: string | null }>(`/anime/${malId}/banner`),
  search: (params: Record<string, string | number | undefined>) => get<SearchResult>(`/anime/search${qs(params)}`),
  genres: () => get<Genre[]>('/anime/genres'),
  anime: (malId: number) => get<AnimePage>(`/anime/${malId}`),
  episodes: (malId: number) => get<Episode[]>(`/anime/${malId}/episodes`),
  match: (malId: number) => get<ProviderMatch>(`/anime/${malId}/match`),
  links: (malId: number) => get<AnimeLink[]>(`/anime/${malId}/links`),
  extras: (malId: number) => get<AnimeExtras>(`/anime/${malId}/extras`),
  screenshots: (malId: number) => get<Screenshot[]>(`/anime/${malId}/screenshots`),
  setMatch: (malId: number, providerId: number | null) => request<ProviderMatch>('PUT', `/anime/${malId}/match`, { providerId }),
  matchSearch: (q: string) => get<ProviderCandidate[]>(`/anime/match/search${qs({ q })}`),

  list: (params: Record<string, string | number | undefined>) => get<ListResponse>(`/list${qs(params)}`),
  skipTimes: (malId: number, episode: number, length: number) => get<SkipTime[]>(`/anime/${malId}/skip/${episode}?length=${Math.round(length)}`),
  listStatuses: () => get<Record<number, ListStatus>>('/list/statuses'),
  share: () => get<ShareInfo>('/me/share'),
  createShare: (flags: Partial<Pick<ShareInfo, 'list' | 'stats'>>) => request<ShareInfo>('POST', '/me/share', flags),
  updateShare: (flags: Partial<Pick<ShareInfo, 'list' | 'stats'>>) => request<ShareInfo>('PATCH', '/me/share', flags),
  deleteShare: () => request<ShareInfo>('DELETE', '/me/share'),
  createRoom: (body: { malId: number; media: RoomMedia }) => request<RoomInfo>('POST', '/rooms', body),
  rooms: () => get<RoomListItem[]>('/rooms'),
  feed: (params: { before?: string; scope?: FeedScope }) => get<FeedPage>(`/feed${qs(params)}`),
  searchUsers: (q: string) => get<PersonCard[]>(`/users${qs({ q })}`),
  profile: (username: string) => get<UserProfile>(`/users/${encodeURIComponent(username)}`),
  profileList: (username: string, params: Record<string, string | number | undefined>) => get<ListResponse>(`/users/${encodeURIComponent(username)}/list${qs(params)}`),
  profileStats: (username: string, tz: string) => get<UserStats>(`/users/${encodeURIComponent(username)}/stats${qs({ tz })}`),
  profileFriends: (username: string) => get<PersonCard[]>(`/users/${encodeURIComponent(username)}/friends`),
  profileFeed: (username: string, before?: string) => get<FeedPage>(`/users/${encodeURIComponent(username)}/feed${qs({ before })}`),
  blockUser: (id: number) => request<{ ok: boolean }>('POST', `/users/${id}/block`),
  unblockUser: (id: number) => request<{ ok: boolean }>('DELETE', `/users/${id}/block`),
  moderateUser: (id: number, body: { avatar?: boolean; bio?: boolean; displayName?: boolean }) => request<{ ok: boolean }>('POST', `/users/${id}/moderate`, body),
  myProfile: () => get<ProfileSettings>('/me/profile'),
  updateProfile: (body: ProfileUpdate) => request<ProfileSettings>('PATCH', '/me/profile', body),
  uploadAvatar: ({ image, crop }: { image: Blob; crop: AvatarCrop | null }) => request<User>('PUT', `/me/avatar${crop ? qs({ crop: [crop.x, crop.y, crop.w, crop.h].join(',') }) : ''}`, image),
  deleteAvatar: () => request<User>('DELETE', '/me/avatar'),
  blocks: () => get<PersonCard[]>('/me/blocks'),
  friends: () => get<FriendsOverview>('/friends'),
  addFriend: (id: number) => request<{ relation: Relation }>('POST', `/friends/${id}`),
  removeFriend: (id: number) => request<{ relation: Relation }>('DELETE', `/friends/${id}`),
  friendEntries: (malId: number) => get<FriendEntry[]>(`/friends/anime/${malId}`),
  friendTitles: () => get<FriendTitles>('/friends/titles'),
  friendsWatching: () => get<FriendWatching[]>('/friends/watching'),
  inviteToRoom: (roomId: string, friendIds: number[]) => request<{ sent: number }>('POST', '/friends/invite', { roomId, friendIds }),
  moderationComments: () => get<ModerationComment[]>('/admin/moderation/comments'),
  moderationNotes: () => get<ModerationNote[]>('/admin/moderation/notes'),
  moderationProfiles: () => get<ModerationProfile[]>('/admin/moderation/profiles'),
  moderateDeleteComment: (id: number) => request<{ ok: boolean }>('DELETE', `/admin/moderation/comments/${id}`),
  moderateDeleteNote: (id: number) => request<{ ok: boolean }>('DELETE', `/admin/moderation/notes/${id}`),
  recommend: (body: { malId: number; friendIds: number[]; message: string | null }) => request<{ sent: number }>('POST', '/friends/recommend', body),
  toggleReaction: (eventId: number, emoji: Reaction) => request<{ ok: boolean }>('POST', `/feed/${eventId}/reaction`, { emoji }),
  comments: (target: CommentTarget, id: number) => get<Comment[]>(`/comments${qs({ target, id })}`),
  addComment: (target: CommentTarget, id: number, text: string) => request<Comment>('POST', '/comments', { target, id, text }),
  editComment: (id: number, text: string) => request<Comment>('PATCH', `/comments/${id}`, { text }),
  deleteComment: (id: number) => request<{ ok: boolean }>('DELETE', `/comments/${id}`),
  notes: (malId: number) => get<AnimeNote[]>(`/notes/anime/${malId}`),
  createNote: (malId: number, body: NoteInput) => request<AnimeNote>('POST', `/notes/anime/${malId}`, body),
  updateNote: (id: number, body: NoteInput) => request<AnimeNote>('PATCH', `/notes/${id}`, body),
  deleteNote: (id: number) => request<{ ok: boolean }>('DELETE', `/notes/${id}`),
  room: (id: string) => get<RoomInfo>(`/rooms/${encodeURIComponent(id)}`),
  publicShare: (token: string) => get<PublicShareInfo>(`/public/share/${encodeURIComponent(token)}`),
  publicStats: (token: string, tz: string) => get<PublicStatsResponse>(`/public/stats/${encodeURIComponent(token)}${qs({ tz })}`),
  publicList: (token: string, params: Record<string, string | number | undefined>) => get<PublicListResponse>(`/public/lists/${encodeURIComponent(token)}${qs(params)}`),
  saveEntry: (malId: number, input: ListEntryInput) => request<ListEntry>('PUT', `/list/${malId}`, input),
  deleteEntry: (malId: number) => request<{ ok: true }>('DELETE', `/list/${malId}`),
  exportUrl: (format: string) => `/api/list/export?format=${format}`,

  saveProgress: (malId: number, episode: number, position: number, duration: number, threshold?: number) =>
    request<{ ok: true }>('PUT', `/progress/${malId}/${episode}`, { position, duration, threshold }),

  translations: (malId: number, provider: string, episode: number, kind: StreamKind) =>
    get<Translation[]>(`/stream/${malId}/${provider}/translations${qs({ episode, kind })}`),
  stream: (malId: number, provider: string, episode: number, translation: string, author: string) =>
    get<StreamResult>(`/stream/${malId}/${provider}/stream${qs({ episode, translation, author })}`),
  videoProviders: () => get<VideoProviderInfo[]>('/stream/providers'),
  videoEpisodes: (malId: number, provider: string) => get<VideoEpisodes>(`/stream/${malId}/${provider}/episodes`),

  notifications: () => get<NotificationList>('/notifications'),
  readNotifications: (body: { ids?: number[]; socialIds?: number[] } = {}) => request<{ ok: true }>('POST', '/notifications/read', body),
  clearNotifications: () => request<{ ok: true }>('DELETE', '/notifications'),

  importStatus: () => get<ImportStatus>('/import/status'),
  importStartUrl: (provider: string) => `/api/import/${provider}/start`,
  importSeanime: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<ImportResult>('POST', '/import/seanime', form)
  },
  importYoru: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<ImportResult>('POST', '/import/yoru', form)
  },

  admin: {
    invites: () => get<Invite[]>('/admin/invites'),
    createInvite: (note: string | null, expiresInDays: number | null, multiUse: boolean) => request<Invite[]>('POST', '/admin/invites', { note, expiresInDays, multiUse }),
    deleteInvite: (id: number) => request<Invite[]>('DELETE', `/admin/invites/${id}`),
    users: () => get<AdminUser[]>('/admin/users'),
    deleteUser: (id: number) => request<{ ok: true }>('DELETE', `/admin/users/${id}`),
    settings: () => get<AdminSettings>('/admin/settings'),
    saveSettings: (patch: AdminSettingsInput) => request<{ ok: true }>('PUT', '/admin/settings', patch),
    providers: () => get<ProvidersSettings>('/admin/providers'),
    saveProviders: (category: ProviderCategory, entries: { id: string; enabled: boolean }[]) => request<{ ok: true }>('PUT', `/admin/providers/${category}`, { entries }),
  },
}
