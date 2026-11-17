import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { db } from '../db/client'
import { users } from '../db/schema'
import { env } from '../env'
import { type AnimeRow, getAnimeRow } from '../services/anime'
import type { AniListStaff } from '../services/anilist'
import { cachePeek } from './http'

interface Preview {
  title: string
  description: string
  image: string
  large: boolean
  pageTitle?: string
}

const TEXT = {
  ru: {
    description: 'Трекер и плеер аниме для вас и ваших друзей',
    invite: 'Приглашение в yoru',
    inviteDescription: 'Откройте ссылку, чтобы создать аккаунт',
    list: (name: string) => `Список аниме ${name}`,
    listDescription: 'Статусы, оценки и статистика',
    types: { tv: 'TV', movie: 'Фильм', ova: 'OVA', ona: 'ONA', special: 'Спешл', music: 'Клип' } as Record<string, string>,
    episodes: (n: number) => `${n} эп.`,
    seasons: { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' } as Record<string, string>,
    seiyuu: 'Сэйю',
    born: 'Родились',
    roles: 'Роли',
  },
  en: {
    description: 'Anime tracker and player for you and your friends',
    invite: 'An invite to yoru',
    inviteDescription: 'Open the link to create an account',
    list: (name: string) => `${name}'s anime list`,
    listDescription: 'Statuses, scores and stats',
    types: { tv: 'TV', movie: 'Movie', ova: 'OVA', ona: 'ONA', special: 'Special', music: 'Music' } as Record<string, string>,
    episodes: (n: number) => `${n} ep`,
    seasons: { winter: 'Winter', spring: 'Spring', summer: 'Summer', fall: 'Fall' } as Record<string, string>,
    seiyuu: 'Voice actor',
    born: 'Born',
    roles: 'Roles',
  },
}

const EMBED_COLOR = '#c6befa'

function escape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function clip(text: string, max = 200) {
  const plain = text.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain
}

type Lang = keyof typeof TEXT

function animeInfo(row: AnimeRow, lang: Lang) {
  const text = TEXT[lang]
  const season = row.season && row.year ? `${text.seasons[row.season] ?? row.season} ${row.year}` : row.year ? String(row.year) : null
  return [row.type ? (text.types[row.type] ?? row.type.toUpperCase()) : null, row.episodes && row.type !== 'movie' ? text.episodes(row.episodes) : null, season, row.score ? `★ ${row.score.toFixed(2)}` : null]
    .filter(Boolean)
    .join(' · ')
}

function birthday(date: AniListStaff['dateOfBirth'], lang: Lang) {
  if (!date?.month) return date?.year ? String(date.year) : null
  return new Date(Date.UTC(date.year ?? 2000, date.month - 1, date.day ?? 1)).toLocaleDateString(lang, { day: date.day ? 'numeric' : undefined, month: 'long', year: date.year ? 'numeric' : undefined, timeZone: 'UTC' })
}

function seiyuuPreview(id: number, lang: Lang): Preview | null {
  const staff = cachePeek<{ staff: AniListStaff | null }>(`anilist:staff:${id}:1`)?.staff
  if (!staff?.name.full) return null
  const text = TEXT[lang]
  const born = birthday(staff.dateOfBirth, lang)
  const roles = staff.characterMedia.edges
    .filter((e) => e.node.type === 'ANIME')
    .flatMap((e) => e.characters.map((c) => (c?.name.full ? `${c.name.full} (${e.node.title.romaji ?? e.node.title.english})` : null)))
    .filter((r): r is string => Boolean(r))
    .filter((r, i, all) => all.indexOf(r) === i)
    .slice(0, 3)
  const lines = [[text.seiyuu, born ? `${text.born} ${born}` : null, staff.homeTown].filter(Boolean).join(' · '), roles.length ? `${text.roles}: ${roles.join(', ')}` : null]
  const title = staff.name.native ? `${staff.name.full} (${staff.name.native})` : staff.name.full
  return {
    title,
    description: lines.filter(Boolean).join('\n'),
    image: staff.image?.large ?? `${env.appUrl}/og.jpg`,
    large: !staff.image?.large,
    pageTitle: `${staff.name.full} · yoru`,
  }
}

function preview(pathname: string, lang: Lang): Preview {
  const text = TEXT[lang]
  const base: Preview = { title: 'yoru', description: text.description, image: `${env.appUrl}/og.jpg`, large: true }
  const anime = pathname.match(/^\/anime\/(\d+)/)
  if (anime) {
    const row = getAnimeRow(Number(anime[1]))
    if (!row) return base
    const title = (lang === 'ru' && row.titleRussian) || row.title
    return {
      title,
      description: [animeInfo(row, lang), row.synopsis ? clip(row.synopsis, 160) : null].filter(Boolean).join('\n'),
      image: row.imageUrl ?? base.image,
      large: !row.imageUrl,
      pageTitle: `${title} · yoru`,
    }
  }
  const seiyuu = pathname.match(/^\/seiyuu\/(\d+)/)
  if (seiyuu) return seiyuuPreview(Number(seiyuu[1]), lang) ?? base
  const share = pathname.match(/^\/share\/([^/]+)/)
  if (share && share[1]!.length >= 16) {
    const owner = db.select({ username: users.username, displayName: users.displayName, list: users.shareList, stats: users.shareStats }).from(users).where(eq(users.shareToken, share[1]!)).get()
    if (!owner || (!owner.list && !owner.stats)) return base
    const title = text.list(owner.displayName || owner.username)
    return { ...base, title, description: text.listDescription, pageTitle: `${title} · yoru` }
  }
  if (pathname.startsWith('/invite/')) return { ...base, title: text.invite, description: text.inviteDescription, pageTitle: text.invite }
  return base
}

export function withPreview(c: Context, html: string) {
  const lang = /^ru\b/i.test(c.req.header('accept-language') ?? '') ? 'ru' : 'en'
  const pathname = new URL(c.req.url).pathname
  let p: Preview
  try {
    p = preview(pathname, lang)
  } catch {
    return html
  }
  const meta: [string, string, string][] = [
    ['name', 'description', p.description],
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'yoru'],
    ['property', 'og:title', p.title],
    ['property', 'og:description', p.description],
    ['property', 'og:url', `${env.appUrl}${pathname}`],
    ['property', 'og:image', p.image],
    ['name', 'twitter:card', p.large ? 'summary_large_image' : 'summary'],
  ]
  if (p.large) meta.push(['property', 'og:image:width', '2400'], ['property', 'og:image:height', '1260'])
  const tags = meta.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escape(value)}" />`).join('\n    ')
  const page = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(p.pageTitle ?? 'yoru')}</title>\n    ${tags}`)
  if (!/discordbot/i.test(c.req.header('user-agent') ?? '')) return page
  return page.replace(/<meta name="theme-color" content="[^"]*"/, `<meta name="theme-color" content="${EMBED_COLOR}"`)
}
