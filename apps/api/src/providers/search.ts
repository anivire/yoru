import type { Genre, SearchResult } from '@yoru/shared'
import { cards } from '../services/cards'
import { activeProviders } from './chain'
import type { SearchQuery } from './types'

let genresFrom: string | null = null

export async function searchGenres(): Promise<Genre[]> {
  for (const provider of activeProviders('search')) {
    if (!provider.genres || !provider.features.includes('genres')) continue
    try {
      const genres = await provider.genres()
      genresFrom = provider.id
      return genres
    } catch {
      continue
    }
  }
  return []
}

export async function searchAnime(query: SearchQuery): Promise<SearchResult> {
  if (query.genres.length && !genresFrom) await searchGenres()
  let lastError: unknown = null
  for (const provider of activeProviders('search')) {
    if (!provider.accepts(query) || (query.genres.length && provider.id !== genresFrom)) continue
    try {
      const page = await provider.search(query)
      return { items: await cards(page.items), pagination: { page: query.page, hasNextPage: page.hasNextPage, total: page.total }, provider: provider.id, features: provider.features }
    } catch (error) {
      lastError = error
    }
  }
  if (lastError) throw lastError
  return { items: [], pagination: { page: query.page, hasNextPage: false, total: 0 }, provider: '', features: [] }
}
