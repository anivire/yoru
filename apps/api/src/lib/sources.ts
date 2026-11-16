import type { DataSourceId, ImportProvider } from '@yoru/shared'
import { env } from '../env'
import { getSetting, setSetting } from './settings'

type UrlSource = Exclude<DataSourceId, 'github'>

const DEFAULT_URLS: Record<UrlSource, string> = {
  anime365: env.anime365Url,
  jikan: env.jikanUrl,
  shikimori: env.shikimoriUrl,
  anilist: env.anilistUrl,
  aniskip: env.aniskipUrl,
}

const GITHUB_API = 'https://api.github.com'

function clean(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function defaultSourceUrl(id: DataSourceId): string {
  return id === 'github' ? GITHUB_API : DEFAULT_URLS[id]
}

export function customSourceUrl(id: DataSourceId): string | null {
  return getSetting(`source.${id}.url`)
}

export function sourceUrl(id: DataSourceId): string {
  return clean(customSourceUrl(id) || defaultSourceUrl(id))
}

export function setSourceUrl(id: DataSourceId, url: string | null) {
  setSetting(`source.${id}.url`, url ? clean(url) : null)
}

export function sourceEnabled(id: DataSourceId): boolean {
  if (id === 'anime365') return true
  const value = getSetting(`source.${id}.enabled`)
  if (id === 'jikan' && value === null) return (getSetting('metadata_source') ?? env.metadataSource) !== 'anime365'
  return value !== 'false'
}

export function setSourceEnabled(id: DataSourceId, enabled: boolean) {
  if (id === 'anime365') return
  setSetting(`source.${id}.enabled`, enabled ? (id === 'jikan' ? 'true' : null) : 'false')
}

export function githubConfig() {
  return {
    repo: getSetting('github.repo') || env.githubRepo,
    branch: getSetting('github.branch') || env.githubBranch,
    token: getSetting('github.token') || env.githubToken,
  }
}

export function oauthConfig(provider: ImportProvider) {
  const id = getSetting(`oauth.${provider}.clientId`)
  const secret = getSetting(`oauth.${provider}.clientSecret`)
  return {
    clientId: id || env.oauth[provider].clientId,
    clientSecret: secret || env.oauth[provider].clientSecret,
    fromEnv: !id && !secret && Boolean(env.oauth[provider].clientId),
  }
}
