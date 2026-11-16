import { cacheGet } from '../lib/http'
import { featureEnabled } from '../lib/features'

interface CalendarEntry {
  next_episode: number
  next_episode_at: string
  anime: { id: number; episodes_aired?: number | null }
}

const TTL = 60_000
let memo: { at: number; map: Map<number, number> } | null = null

function calendarAired(): Map<number, number> {
  if (memo && Date.now() - memo.at < TTL) return memo.map
  const map = new Map<number, number>()
  if (featureEnabled('discover')) {
    for (const e of cacheGet<CalendarEntry[]>('shiki:calendar') ?? []) {
      const byNext = Date.parse(e.next_episode_at) > Date.now() ? e.next_episode - 1 : e.next_episode
      const aired = Math.max(e.anime.episodes_aired ?? 0, byNext)
      if (aired > 0) map.set(e.anime.id, aired)
    }
  }
  memo = { at: Date.now(), map }
  return map
}

export function airedEpisode(malId: number, available: number | null): number | null {
  const scheduled = calendarAired().get(malId) ?? 0
  const value = Math.max(available ?? 0, scheduled)
  return value > 0 ? value : available
}
