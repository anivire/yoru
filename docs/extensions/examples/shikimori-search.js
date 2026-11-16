const STATUS = { airing: 'ongoing', complete: 'released', upcoming: 'anons' }
const PAGE_SIZE = 24

class Provider {
  async search(query) {
    const params = new URLSearchParams({ page: String(query.page), limit: String(PAGE_SIZE), censored: 'true' })
    if (query.q) params.set('search', query.q)
    else params.set('order', 'popularity')
    if (query.type) params.set('kind', query.type)
    if (query.status && STATUS[query.status]) params.set('status', STATUS[query.status])
    const res = await fetch(`https://shikimori.io/api/animes?${params}`)
    if (!res.ok) throw new Error(`Shikimori answered ${res.status}`)
    const rows = await res.json()
    return {
      items: rows.map((a) => ({
        malId: a.id,
        title: a.name,
        titleRussian: a.russian || null,
        imageUrl: a.image?.original ? `https://shikimori.io${a.image.original}` : null,
        type: a.kind ?? null,
        episodes: a.episodes || null,
        year: a.aired_on ? Number(a.aired_on.slice(0, 4)) : null,
        score: Number(a.score) || null,
      })),
      hasNextPage: rows.length === PAGE_SIZE,
    }
  }
}
