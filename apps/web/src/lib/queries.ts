import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ListEntryInput, User } from '@yoru/shared'
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

export function useSaveEntry(malId: number) {
  const client = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (input: ListEntryInput) => api.saveEntry(malId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.anime(malId) })
      void client.invalidateQueries({ queryKey: ['list'] })
      void client.invalidateQueries({ queryKey: keys.home })
      void client.invalidateQueries({ queryKey: keys.episodes(malId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('common.error')),
  })
}

export function useDeleteEntry(malId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.deleteEntry(malId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.anime(malId) })
      void client.invalidateQueries({ queryKey: ['list'] })
      void client.invalidateQueries({ queryKey: keys.home })
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
  }
  return map[error.message] ? t(map[error.message]!) : error.message
}
