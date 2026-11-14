import type {
  AdminSettings,
  AdminUser,
  AnimePage,
  Episode,
  Genre,
  HomeData,
  ImportStatus,
  Invite,
  ListEntry,
  ListEntryInput,
  ListResponse,
  MetadataSource,
  NotificationList,
  ProviderCandidate,
  ProviderMatch,
  SearchResult,
  StreamKind,
  StreamResult,
  Translation,
  User,
} from '@yoru/shared'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
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
  login: (username: string, password: string) => request<User>('POST', '/auth/login', { username, password }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  invite: (code: string) => get<{ valid: boolean; role: string | null }>(`/auth/invite/${encodeURIComponent(code)}`),
  register: (code: string, username: string, password: string) => request<User>('POST', '/auth/register', { code, username, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/password', { currentPassword, newPassword }),
  updateSettings: (patch: Partial<Pick<User, 'locale' | 'notifySub' | 'notifyVoice'>> & { anime365Token?: string | null }) =>
    request<User>('PATCH', '/me/settings', patch),

  home: () => get<HomeData>('/home'),
  search: (params: Record<string, string | number | undefined>) => get<SearchResult>(`/anime/search${qs(params)}`),
  genres: () => get<Genre[]>('/anime/genres'),
  anime: (malId: number) => get<AnimePage>(`/anime/${malId}`),
  episodes: (malId: number) => get<Episode[]>(`/anime/${malId}/episodes`),
  match: (malId: number) => get<ProviderMatch>(`/anime/${malId}/match`),
  setMatch: (malId: number, providerId: number | null) => request<ProviderMatch>('PUT', `/anime/${malId}/match`, { providerId }),
  matchSearch: (q: string) => get<ProviderCandidate[]>(`/anime/match/search${qs({ q })}`),

  list: (params: Record<string, string | number | undefined>) => get<ListResponse>(`/list${qs(params)}`),
  saveEntry: (malId: number, input: ListEntryInput) => request<ListEntry>('PUT', `/list/${malId}`, input),
  deleteEntry: (malId: number) => request<{ ok: true }>('DELETE', `/list/${malId}`),
  exportUrl: (format: string) => `/api/list/export?format=${format}`,

  saveProgress: (malId: number, episode: number, position: number, duration: number) =>
    request<{ ok: true }>('PUT', `/progress/${malId}/${episode}`, { position, duration }),

  translations: (malId: number, episode: number, kind: StreamKind) =>
    get<Translation[]>(`/stream/${malId}/translations${qs({ episode, kind })}`),
  stream: (translationId: number, author: string) => get<StreamResult>(`/stream/translation/${translationId}${qs({ author })}`),

  notifications: () => get<NotificationList>('/notifications'),
  readNotifications: (ids?: number[]) => request<{ ok: true }>('POST', '/notifications/read', { ids }),
  clearNotifications: () => request<{ ok: true }>('DELETE', '/notifications'),

  importStatus: () => get<ImportStatus>('/import/status'),
  importStartUrl: (provider: string) => `/api/import/${provider}/start`,

  admin: {
    invites: () => get<Invite[]>('/admin/invites'),
    createInvite: (note: string | null, expiresInDays: number | null) => request<Invite[]>('POST', '/admin/invites', { note, expiresInDays }),
    deleteInvite: (id: number) => request<Invite[]>('DELETE', `/admin/invites/${id}`),
    users: () => get<AdminUser[]>('/admin/users'),
    deleteUser: (id: number) => request<{ ok: true }>('DELETE', `/admin/users/${id}`),
    settings: () => get<AdminSettings>('/admin/settings'),
    saveSettings: (patch: { anime365Token?: string | null; metadataSource?: MetadataSource }) => request<{ ok: true }>('PUT', '/admin/settings', patch),
  },
}
