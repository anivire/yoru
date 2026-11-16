import { env } from '../env'
import { getSetting, setSetting } from '../lib/settings'
import { builtinMetadata, builtinSearch } from './builtin'
import type { ChainCategory, ProviderMap } from './types'

export interface ChainEntry {
  id: string
  enabled: boolean
}

type ProviderLists = { [K in ChainCategory]: ProviderMap[K][] }

const external: ProviderLists = { metadata: [], search: [] }

export function setExternalProviders<K extends ChainCategory>(category: K, providers: ProviderMap[K][]) {
  ;(external as Record<ChainCategory, unknown[]>)[category] = providers
}

export function knownProviders<K extends ChainCategory>(category: K): ProviderMap[K][] {
  const builtin: ProviderLists = { metadata: builtinMetadata, search: builtinSearch }
  return [...builtin[category], ...external[category]] as ProviderMap[K][]
}

function defaultOrder(category: ChainCategory): string[] {
  const legacyAnime365 = (getSetting('metadata_source') ?? env.metadataSource) === 'anime365'
  if (category === 'metadata') return legacyAnime365 ? ['anime365', 'jikan'] : ['jikan', 'anime365']
  return ['jikan', 'shikimori', 'anime365']
}

function storedEntries(category: ChainCategory): ChainEntry[] {
  try {
    const parsed: unknown = JSON.parse(getSetting(`providers.${category}`) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e): e is ChainEntry => typeof e?.id === 'string' && typeof e?.enabled === 'boolean')
  } catch {
    return []
  }
}

export function chainEntries(category: ChainCategory): ChainEntry[] {
  const ids = new Set(knownProviders(category).map((p) => p.id))
  const stored = storedEntries(category)
  const entries = (stored.length ? stored : defaultOrder(category).map((id) => ({ id, enabled: true }))).filter((e) => ids.has(e.id))
  for (const id of ids) if (!entries.some((e) => e.id === id)) entries.push({ id, enabled: true })
  return entries
}

export function setChainEntries(category: ChainCategory, entries: ChainEntry[]) {
  setSetting(`providers.${category}`, JSON.stringify(entries))
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
