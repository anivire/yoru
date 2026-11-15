import { STREAM_KINDS, type StreamKind } from '@yoru/shared'

export type FavoriteGroup = StreamKind | 'any'
export type FavoriteAuthors = Partial<Record<FavoriteGroup, string[]>>

const GROUPS: FavoriteGroup[] = [...STREAM_KINDS, 'any']

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.filter((a): a is string => {
    if (typeof a !== 'string' || !a.trim() || seen.has(a.toLowerCase())) return false
    seen.add(a.toLowerCase())
    return true
  })
}

export function normalizeFavorites(value: unknown): FavoriteAuthors {
  if (Array.isArray(value)) {
    const any = cleanList(value)
    return any.length ? { any } : {}
  }
  if (!value || typeof value !== 'object') return {}
  const result: FavoriteAuthors = {}
  for (const group of GROUPS) {
    const list = cleanList((value as Record<string, unknown>)[group])
    if (list.length) result[group] = list
  }
  return result
}

export function favoritesFor(favorites: FavoriteAuthors, kind: StreamKind) {
  return [...(favorites[kind] ?? []), ...(favorites.any ?? [])]
}

function matches(author: string, favorite: string) {
  return author.toLowerCase().includes(favorite.toLowerCase())
}

export function pickFavorite<T extends { author: string }>(favorites: FavoriteAuthors, kind: StreamKind, items: T[]) {
  for (const favorite of favoritesFor(favorites, kind)) {
    const found = items.find((x) => x.author.toLowerCase() === favorite.toLowerCase()) ?? items.find((x) => matches(x.author, favorite))
    if (found) return found
  }
  return undefined
}

export function isFavorite(favorites: FavoriteAuthors, kind: StreamKind, author: string) {
  return (favorites[kind] ?? []).some((f) => matches(author, f))
}

export function toggleFavorite(favorites: FavoriteAuthors, kind: StreamKind, author: string): FavoriteAuthors {
  const list = favorites[kind] ?? []
  const next = isFavorite(favorites, kind, author) ? list.filter((f) => !matches(author, f)) : [...list, author]
  return { ...favorites, [kind]: next }
}

const REMEMBERED = /^yoru:author:\d+:(\w+)$/

export function rememberedAuthors(kind: StreamKind, exclude: string[]) {
  const counts = new Map<string, number>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const match = key ? REMEMBERED.exec(key) : null
      if (match?.[1] !== kind) continue
      const author = localStorage.getItem(key!)?.trim()
      if (author && !exclude.some((f) => matches(author, f))) counts.set(author, (counts.get(author) ?? 0) + 1)
    }
  } catch {}
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8)
}
