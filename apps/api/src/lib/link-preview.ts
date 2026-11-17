import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { db } from '../db/client'
import { users } from '../db/schema'
import { env } from '../env'
import { getAnimeRow } from '../services/anime'

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
  },
  en: {
    description: 'Anime tracker and player for you and your friends',
    invite: 'An invite to yoru',
    inviteDescription: 'Open the link to create an account',
    list: (name: string) => `${name}'s anime list`,
    listDescription: 'Statuses, scores and stats',
  },
}

function escape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function clip(text: string, max = 200) {
  const plain = text.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain
}

function preview(pathname: string, lang: keyof typeof TEXT): Preview {
  const text = TEXT[lang]
  const base: Preview = { title: 'yoru', description: text.description, image: `${env.appUrl}/og.jpg`, large: true }
  const anime = pathname.match(/^\/anime\/(\d+)/)
  if (anime) {
    const row = getAnimeRow(Number(anime[1]))
    if (!row) return base
    return {
      title: row.title,
      description: row.synopsis ? clip(row.synopsis) : base.description,
      image: row.imageUrl ?? base.image,
      large: !row.imageUrl,
      pageTitle: `${row.title} · yoru`,
    }
  }
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
  if (p.large) meta.push(['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'])
  const tags = meta.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escape(value)}" />`).join('\n    ')
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escape(p.pageTitle ?? 'yoru')}</title>\n    ${tags}`)
}
