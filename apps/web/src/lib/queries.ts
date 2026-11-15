import { type InfiniteData, QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnimePage, ListEntry, ListEntryInput, ListResponse, User } from '@yoru/shared'
import { toast } from '@yoru/ui'
import { useTranslation } from 'react-i18next'
import { ApiError, api } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})

export const keys = {
  me: ['me'] as const,
  home: ['home'] as const,
  stats: ['stats'] as const,
  anime: (id: number) => ['anime', id] as const,
  episodes: (id: number) => ['episodes', id] as const,
  match: (id: number) => ['match', id] as const,
  links: (id: number) => ['links', id] as const,
  extras: (id: number) => ['extras', id] as const,
  screenshots: (id: number) => ['screenshots', id] as const,
  list: (params: object) => ['list', params] as const,
  listStatuses: ['list-statuses'] as const,
  notifications: ['notifications'] as const,
}

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    retry: true,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    staleTime: Infinity,
  })
}

export function useUser(): User {
  const { data } = useMe()
  if (!data) throw new Error('useUser outside of auth gate')
  return data
}

const SAVE_DELAY_MS = 700

interface PendingSave {
  input: ListEntryInput
  previous: AnimePage | undefined
  timer: ReturnType<typeof setTimeout>
  flush: () => void
}

const pendingSaves = new Map<number, PendingSave>()
const inFlight = new Map<number, number>()

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') for (const pending of [...pendingSaves.values()]) pending.flush()
  })
}

export function patchListEntry(client: QueryClient, malId: number, patch: Partial<ListEntry> | null) {
  client.setQueriesData<InfiniteData<ListResponse>>({ queryKey: ['list'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: patch ? page.items.map((e) => (e.malId === malId ? { ...e, ...patch } : e)) : page.items.filter((e) => e.malId !== malId),
          })),
        }
      : data,
  )
  void client.invalidateQueries({ queryKey: ['list'], refetchType: 'none' })
  void client.invalidateQueries({ queryKey: keys.listStatuses })
}

function definedFields<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<T>
}

function useEntryCache(malId: number) {
  const client = useQueryClient()
  const snapshot = () => {
    void client.cancelQueries({ queryKey: keys.anime(malId) })
    return client.getQueryData<AnimePage>(keys.anime(malId))
  }
  const setEntry = (update: (entry: ListEntry | null) => ListEntry | null) =>
    client.setQueryData<AnimePage>(keys.anime(malId), (page) => (page ? { ...page, entry: update(page.entry) } : page))
  const run = async <T,>(request: () => Promise<T>): Promise<T> => {
    inFlight.set(malId, (inFlight.get(malId) ?? 0) + 1)
    try {
      return await request()
    } finally {
      inFlight.set(malId, (inFlight.get(malId) ?? 1) - 1)
      if (!inFlight.get(malId) && !pendingSaves.has(malId)) {
        void client.invalidateQueries({ queryKey: keys.anime(malId) })
        void client.invalidateQueries({ queryKey: ['list'], refetchType: 'none' })
        void client.invalidateQueries({ queryKey: keys.listStatuses })
        void client.invalidateQueries({ queryKey: keys.home })
        void client.invalidateQueries({ queryKey: keys.episodes(malId) })
      }
    }
  }
  const restore = (previous: AnimePage | undefined) => {
    if (previous) client.setQueryData(keys.anime(malId), previous)
    void client.invalidateQueries({ queryKey: ['list'] })
    void client.invalidateQueries({ queryKey: keys.listStatuses })
  }
  return { client, snapshot, setEntry, run, restore }
}

export function useSaveEntry(malId: number) {
  const { t } = useTranslation()
  const cache = useEntryCache(malId)
  const mutate = (input: ListEntryInput) => {
    const existing = pendingSaves.get(malId)
    const previous = existing ? existing.previous : cache.snapshot()
    cache.setEntry((entry) => ({
      malId,
      progress: 0,
      score: null,
      rewatches: 0,
      notes: null,
      startedAt: null,
      completedAt: null,
      ...entry,
      ...definedFields(input),
      status: input.status,
      updatedAt: new Date().toISOString(),
    }))
    patchListEntry(cache.client, malId, { ...definedFields(input), status: input.status })
    if (existing) clearTimeout(existing.timer)
    const merged: ListEntryInput = { ...existing?.input, ...definedFields(input), status: input.status }
    const flush = () => {
      const pending = pendingSaves.get(malId)
      if (!pending) return
      clearTimeout(pending.timer)
      pendingSaves.delete(malId)
      cache
        .run(() => api.saveEntry(malId, pending.input))
        .then((entry) => {
          if (!pendingSaves.has(malId)) patchListEntry(cache.client, malId, entry)
        })
        .catch((e: unknown) => {
          cache.restore(pending.previous)
          toast.error(e instanceof Error ? e.message : t('common.error'))
        })
    }
    pendingSaves.set(malId, { input: merged, previous, timer: setTimeout(flush, SAVE_DELAY_MS), flush })
  }
  return { mutate }
}

export function useDeleteEntry(malId: number) {
  const { t } = useTranslation()
  const cache = useEntryCache(malId)
  return useMutation({
    mutationFn: () => cache.run(() => api.deleteEntry(malId)),
    onMutate: () => {
      const pending = pendingSaves.get(malId)
      if (pending) {
        clearTimeout(pending.timer)
        pendingSaves.delete(malId)
      }
      const previous = pending?.previous ?? cache.snapshot()
      cache.setEntry(() => null)
      patchListEntry(cache.client, malId, null)
      return { previous }
    },
    onError: (e, _input, context) => {
      cache.restore(context?.previous)
      toast.error(e instanceof Error ? e.message : t('common.error'))
    },
  })
}

export function errorMessage(error: unknown, t: (key: string) => string): string {
  if (!(error instanceof Error)) return t('common.error')
  const map: Record<string, string> = {
    ANIME365_TOKEN_MISSING: 'player.tokenMissing',
    ANIME365_TOKEN_INVALID: 'player.tokenInvalid',
    NO_SOURCES: 'player.noSources',
    INVALID_CREDENTIALS: 'auth.invalid',
    INVITE_INVALID: 'auth.inviteInvalid',
    USERNAME_TAKEN: 'auth.usernameTaken',
    SEANIME_INVALID: 'settings.seanime.invalid',
    SEANIME_EMPTY: 'settings.seanime.empty',
    SEANIME_NO_FILE: 'settings.seanime.invalid',
    SEANIME_TOO_LARGE: 'settings.seanime.tooLarge',
    YORU_INVALID: 'settings.yoruFile.invalid',
    YORU_EMPTY: 'settings.seanime.empty',
    INVALID_PASSWORD: 'settings.danger.wrongPassword',
    LAST_ADMIN: 'settings.danger.lastAdmin',
  }
  return map[error.message] ? t(map[error.message]!) : error.message
}
