const API = 'https://api.anilibria.app/api/v1'

function normalize(value) {
  return (value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

async function json(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`AniLibria answered ${res.status}`)
  return res.json()
}

async function findRelease(anime) {
  const titles = [anime.titleRussian, anime.title, anime.titleEnglish, ...anime.synonyms].filter(Boolean)
  const names = new Set(titles.map(normalize))
  for (const title of titles.slice(0, 4)) {
    const rows = await json(`/app/search/releases?query=${encodeURIComponent(title)}`)
    const found = rows.find((r) => {
      const yearOk = !anime.year || !r.year || Math.abs(r.year - anime.year) <= 1
      const nameOk = [r.name?.main, r.name?.english, r.name?.alternative].some((n) => n && names.has(normalize(n)))
      return yearOk && nameOk
    })
    if (found) return found
  }
  return null
}

async function episodesOf(anime) {
  const found = await findRelease(anime)
  if (!found) return null
  const release = await json(`/anime/releases/${found.id}`)
  return { title: release.name?.main ?? null, episodes: release.episodes ?? [] }
}

function sources(episode) {
  return [
    episode.hls_1080 && { url: episode.hls_1080, type: 'm3u8', height: 1080 },
    episode.hls_720 && { url: episode.hls_720, type: 'm3u8', height: 720 },
    episode.hls_480 && { url: episode.hls_480, type: 'm3u8', height: 480 },
  ].filter(Boolean)
}

class Provider {
  async episodes(anime) {
    const release = await episodesOf(anime)
    if (!release) return { matched: false, title: null, episodes: [] }
    const numbers = release.episodes.filter((e) => sources(e).length).map((e) => Math.round(Number(e.ordinal)))
    return { matched: true, title: release.title, episodes: numbers.filter((n) => Number.isInteger(n) && n > 0) }
  }

  async translations(anime, episode, kind) {
    if (kind !== 'voice') return []
    const release = await episodesOf(anime)
    const found = release?.episodes.find((e) => Math.round(Number(e.ordinal)) === episode)
    if (!found || !sources(found).length) return []
    return [{ id: String(episode), kind: 'voice', author: 'AniLibria', height: sources(found)[0].height }]
  }

  async stream(anime, episode) {
    const release = await episodesOf(anime)
    const found = release?.episodes.find((e) => Math.round(Number(e.ordinal)) === episode)
    if (!found) throw new Error('Episode not found')
    return { sources: sources(found) }
  }
}
