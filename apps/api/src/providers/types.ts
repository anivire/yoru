import type { AnimeSummary, Genre, ProviderCategory, SearchFeature } from '@yoru/shared'
import type { anime } from '../db/schema'

export type AnimeData = typeof anime.$inferInsert

export interface SearchQuery {
  q: string
  page: number
  type?: string
  status?: string
  genres: number[]
  params: Record<string, string>
}

export interface SearchPage {
  items: AnimeSummary[]
  hasNextPage: boolean
  total: number | null
}

interface ProviderBase {
  id: string
  name: string
  builtin: boolean
  available(): boolean
}

export interface MetadataProvider extends ProviderBase {
  anime(malId: number): Promise<AnimeData | null>
}

export interface SearchProvider extends ProviderBase {
  features: SearchFeature[]
  accepts(query: SearchQuery): boolean
  search(query: SearchQuery): Promise<SearchPage>
  genres?(): Promise<Genre[]>
}

export interface ProviderMap {
  metadata: MetadataProvider
  search: SearchProvider
}

export type ChainCategory = Extract<ProviderCategory, keyof ProviderMap>
