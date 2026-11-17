import type { AnimeSummary, Genre, ProviderCategory, SearchFeature, StreamKind, StreamResult, Translation, VideoEpisodes } from '@yoru/shared'
import type { anime } from '../db/schema'
import type { UserRow } from '../lib/auth'

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
  many?(malIds: number[]): Promise<AnimeData[]>
}

export interface SearchProvider extends ProviderBase {
  features: SearchFeature[]
  accepts(query: SearchQuery): boolean
  search(query: SearchQuery): Promise<SearchPage>
  genres?(): Promise<Genre[]>
}

export interface VideoProvider extends ProviderBase {
  kinds: StreamKind[]
  manualMatch: boolean
  episodes(malId: number): Promise<VideoEpisodes>
  translations(malId: number, episode: number, kind: StreamKind): Promise<Translation[]>
  stream(user: UserRow, malId: number, episode: number, translationId: string, author: string): Promise<StreamResult>
}

export interface ProviderMap {
  metadata: MetadataProvider
  search: SearchProvider
  video: VideoProvider
}

export type ChainCategory = Extract<ProviderCategory, keyof ProviderMap>
