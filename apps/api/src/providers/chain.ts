import { env } from '../env'
import { getSetting, setSetting } from '../lib/settings'
import { builtinMetadata, builtinSearch } from './builtin'
import { builtinVideo } from './video'
import type { ChainCategory, ProviderMap } from './types'

export interface ChainEntry {
  id: string
  enabled: boolean
}

type ProviderLists = { [K in ChainCategory]: ProviderMap[K][] }

const external: ProviderLists = { metadata: [], search: [], video: [] }

export function setExternalProviders<K extends ChainCategory>(category: K, providers: ProviderMap[K][]) {
  ;(external as Record<ChainCategory, unknown[]>)[category] = providers
}

export function knownProviders<K extends ChainCategory>(category: K): ProviderMap[K][] {
  const builtin: ProviderLists = { metadata: builtinMetadata, search: builtinSearch, video: builtinVideo }
  return [...builtin[category], ...external[category]] as ProviderMap[K][]
}

export type ChainGroup = 'primary' | 'video'

export function groupOf(category: ChainCategory): ChainGroup {
  return category === 'video' ? 'video' : 'primary'
}

export function groupProviderIds(group: ChainGroup): string[] {
  const ids = group === 'video' ? knownProviders('video').map((p) => p.id) : [...knownProviders('metadata'), ...knownProviders('search')].map((p) => p.id)
  return [...new Set(ids)]
}

function defaultOrder(group: ChainGroup): string[] {
  if (group === 'video') return ['anime365', 'anilibria', 'kodik']
  const legacyAnime365 = (getSetting('metadata_source') ?? env.metadataSource) === 'anime365'
  return legacyAnime365 ? ['anime365', 'jikan', 'anilist', 'shikimori', 'kitsu'] : ['jikan', 'anilist', 'shikimori', 'kitsu', 'anime365']
}

function storedEntries(group: ChainGroup): ChainEntry[] {
  try {
    const parsed: unknown = JSON.parse(getSetting(`providers.${group}`) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e): e is ChainEntry => typeof e?.id === 'string' && typeof e?.enabled === 'boolean')
  } catch {
    return []
  }
}

export function groupEntries(group: ChainGroup): ChainEntry[] {
  const ids = groupProviderIds(group)
  const stored = storedEntries(group)
  const defaults = defaultOrder(group).map((id, index) => ({ id, enabled: group === 'video' || index === 0 }))
  const entries = (stored.length ? stored : defaults).filter((e) => ids.includes(e.id))
  for (const id of ids) if (!entries.some((e) => e.id === id)) entries.push({ id, enabled: group === 'video' })
  return entries
}

export function setGroupEntries(group: ChainGroup, entries: ChainEntry[]) {
  const ids = groupProviderIds(group)
  setSetting(`providers.${group}`, JSON.stringify(entries.filter((e) => ids.includes(e.id))))
}

export function chainEntries(category: ChainCategory): ChainEntry[] {
  const ids = new Set(knownProviders(category).map((p) => p.id))
  return groupEntries(groupOf(category)).filter((e) => ids.has(e.id))
}

export function activeProviders<K extends ChainCategory>(category: K): ProviderMap[K][] {
  const byId = new Map(knownProviders(category).map((p) => [p.id, p]))
  return chainEntries(category)
    .filter((e) => e.enabled)
    .map((e) => byId.get(e.id))
    .filter((p): p is ProviderMap[K] => Boolean(p?.available()))
}

export function isActive(category: ChainCategory, id: string): boolean {
  return activeProviders(category).some((p) => p.id === id)
}

export function primaryProvider(category: ChainCategory): string | null {
  return activeProviders(category)[0]?.id ?? null
}

export function chainSignature(category: ChainCategory): string {
  return activeProviders(category)
    .map((p) => p.id)
    .join(',')
}
