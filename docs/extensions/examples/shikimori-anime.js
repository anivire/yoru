const STATUS = { ongoing: 'airing', released: 'finished', anons: 'upcoming' }

function baseUrl() {
  return ($settings.baseUrl || 'https://shikimori.io').replace(/\/+$/, '')
}

class Provider {
  async anime(malId) {
    const res = await fetch(`${baseUrl()}/api/animes/${malId}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Shikimori answered ${res.status}`)
    const a = await res.json()
    return {
      title: a.name,
      titleEnglish: a.english?.[0] ?? null,
      titleJapanese: a.japanese?.[0] ?? null,
      titleRussian: a.russian || null,
      synonyms: a.synonyms ?? [],
      imageUrl: a.image?.original ? `${baseUrl()}${a.image.original}` : null,
      type: a.kind ?? null,
      episodes: a.episodes || null,
      status: STATUS[a.status] ?? null,
      year: a.aired_on ? Number(a.aired_on.slice(0, 4)) : null,
      score: Number(a.score) || null,
      genres: (a.genres ?? []).map((g) => g.name),
      studios: (a.studios ?? []).map((s) => s.name),
      synopsis: a.description ? a.description.replace(/\[[^\]]*\]/g, '') : null,
      airedFrom: a.aired_on ?? null,
      airedTo: a.released_on ?? null,
    }
  }
}
