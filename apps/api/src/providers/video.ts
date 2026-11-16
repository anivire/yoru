import { anilibriaRelease } from '../services/anilibria'
import { kodik, kodikAvailable, kodikEmbed, kodikEpisodes } from '../services/kodik'
import { listTranslations, providerEpisodes, resolveMatch, streamTranslation } from '../services/provider'
import { badRequest } from '../lib/http'
import { sourceEnabled } from '../lib/sources'
import type { VideoProvider } from './types'

const anime365Video: VideoProvider = {
  id: 'anime365',
  name: 'Anime365',
  builtin: true,
  kinds: ['sub', 'voice', 'subEn', 'voiceEn', 'raw'],
  manualMatch: true,
  available: () => true,
  async episodes(malId) {
    const match = await resolveMatch(malId)
    if (!match.providerId) return { matched: false, title: null, episodes: [] }
    const episodes = await providerEpisodes(malId)
    return { matched: true, title: match.title, episodes: episodes.map((e) => Number(e.episodeInt)) }
  },
  translations: (malId, episode, kind) => listTranslations(malId, episode, kind),
  stream: (user, _malId, _episode, translationId, author) => streamTranslation(user, Number(translationId), author),
}

const anilibriaVideo: VideoProvider = {
  id: 'anilibria',
  name: 'AniLibria',
  builtin: true,
  kinds: ['voice'],
  manualMatch: false,
  available: () => sourceEnabled('anilibria'),
  async episodes(malId) {
    const release = await anilibriaRelease(malId)
    return { matched: release.releaseId !== null, title: release.title, episodes: release.episodes.map((e) => e.number) }
  },
  async translations(malId, episode, kind) {
    if (kind !== 'voice') return []
    const found = (await anilibriaRelease(malId)).episodes.find((e) => e.number === episode)
    if (!found) return []
    return [{ id: String(episode), kind: 'voice', author: 'AniLibria', priority: 0, qualityType: null, height: found.sources[0]?.height ?? null }]
  },
  async stream(_user, malId, episode) {
    const found = (await anilibriaRelease(malId)).episodes.find((e) => e.number === episode)
    if (!found) badRequest('NO_SOURCES')
    return { translationId: String(episode), author: 'AniLibria', sources: found.sources, subtitlesUrl: null, embedUrl: null }
  },
}

const KODIK_KIND: Record<string, 'voice' | 'subtitles'> = { voice: 'voice', sub: 'subtitles' }

const kodikVideo: VideoProvider = {
  id: 'kodik',
  name: 'Kodik',
  builtin: true,
  kinds: ['voice', 'sub'],
  manualMatch: false,
  available: kodikAvailable,
  async episodes(malId) {
    const results = await kodik.byMal(malId)
    if (!results.length) return { matched: false, title: null, episodes: [] }
    const episodes = [...new Set(results.flatMap(kodikEpisodes))].sort((a, b) => a - b)
    return { matched: true, title: results[0]!.title, episodes }
  },
  async translations(malId, episode, kind) {
    const type = KODIK_KIND[kind]
    if (!type) return []
    return (await kodik.byMal(malId))
      .filter((r) => r.translation.type === type && kodikEmbed(r, episode))
      .map((r) => ({
        id: r.id,
        kind,
        author: r.translation.title,
        priority: 0,
        qualityType: r.quality,
        height: Number(/(\d{3,4})p/.exec(r.quality ?? '')?.[1]) || null,
      }))
  },
  async stream(_user, malId, episode, translationId, author) {
    const result = (await kodik.byMal(malId)).find((r) => r.id === translationId)
    const embedUrl = result ? kodikEmbed(result, episode) : null
    if (!embedUrl) badRequest('NO_SOURCES')
    return { translationId, author, sources: [], subtitlesUrl: null, embedUrl }
  },
}

export const builtinVideo: VideoProvider[] = [anime365Video, anilibriaVideo, kodikVideo]
