import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnimePage, ListEntry, ListEntryInput, User } from '@yoru/shared'
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
  anime: (id: number) => ['anime', id] as const,
  episodes: (id: number) => ['episodes', id] as const,
  match: (id: number) => ['match', id] as const,
  links: (id: number) => ['links', id] as const,
  list: (params: object) => ['list', params] as const,
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
    staleTime: Infinity,
  })
}

export function useUser(): User {
  const { data } = useMe()
  if (!data) throw new Error('useUser outside of auth gate')
  return data
}

function entryMutationKey(malId: number) {
  return ['entry', malId] as const
}

function useEntryCache(malId: number) {
  const client = useQueryClient()
  const snapshot = async () => {
    await client.cancelQueries({ queryKey: keys.anime(malId) })
    return client.getQueryData<AnimePage>(keys.anime(malId))
  }
  const setEntry = (update: (entry: ListEntry | null) => ListEntry | null) =>
    client.setQueryData<AnimePage>(keys.anime(malId), (page) => (page ? { ...page, entry: update(page.entry) } : page))
  const settle = () => {
    if (client.isMutating({ mutationKey: entryMutationKey(malId) }) > 1) return
    void client.invalidateQueries({ queryKey: keys.anime(malId) })
    void client.invalidateQueries({ queryKey: ['list'] })
    void client.invalidateQueries({ queryKey: keys.home })
    void client.invalidateQueries({ queryKey: keys.episodes(malId) })
  }
  return { client, snapshot, setEntry, settle }
}

export function useSaveEntry(malId: number) {
  const { t } = useTranslation()
  const cache = useEntryCache(malId)
  return useMutation({
    mutationKey: entryMutationKey(malId),
    mutationFn: (input: ListEntryInput) => api.saveEntry(malId, input),
    onMutate: async (input) => {
      const previous = await cache.snapshot()
      cache.setEntry((entry) => ({
        malId,
        progress: 0,
        score: null,
        rewatches: 0,
        notes: null,
        startedAt: null,
        completedAt: null,
        ...entry,
        ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
        status: input.status,
        updatedAt: new Date().toISOString(),
      }))
      return { previous }
    },
    onError: (e, _input, context) => {
      if (context?.previous) cache.client.setQueryData(keys.anime(malId), context.previous)
      toast.error(e instanceof Error ? e.message : t('common.error'))
    },
    onSettled: cache.settle,
  })
}

export function useDeleteEntry(malId: number) {
  const { t } = useTranslation()
  const cache = useEntryCache(malId)
  return useMutation({
    mutationKey: entryMutationKey(malId),
    mutationFn: () => api.deleteEntry(malId),
    onMutate: async () => {
      const previous = await cache.snapshot()
      cache.setEntry(() => null)
      return { previous }
    },
    onError: (e, _input, context) => {
      if (context?.previous) cache.client.setQueryData(keys.anime(malId), context.previous)
      toast.error(e instanceof Error ? e.message : t('common.error'))
    },
    onSettled: cache.settle,
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
  }
  return map[error.message] ? t(map[error.message]!) : error.message
}
