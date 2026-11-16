import { anilibriaRelease } from '../services/anilibria'
import { listTranslations, providerEpisodes, resolveMatch, streamTranslation } from '../services/provider'
import { badRequest } from '../lib/http'
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
  available: () => true,
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
    return { translationId: String(episode), author: 'AniLibria', sources: found.sources, subtitlesUrl: null }
  },
}

export const builtinVideo: VideoProvider[] = [anime365Video, anilibriaVideo]
