import { env } from '../env'
import { randomToken } from '../lib/crypto'
import { UpstreamError, notFound } from '../lib/http'

interface Target {
  url: string
  headers: Record<string, string>
  expires: number
}

const TTL_MS = 6 * 3_600_000
const LIMIT = 20_000
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']
const targets = new Map<string, Target>()

export function proxyUrl(url: string, headers: Record<string, string>): string {
  const token = randomToken(16)
  targets.set(token, { url, headers, expires: Date.now() + TTL_MS })
  while (targets.size > LIMIT) targets.delete(targets.keys().next().value!)
  return `/api/stream/proxy/${token}`
}

function rewritePlaylist(text: string, base: string, headers: Record<string, string>): string {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${proxyUrl(new URL(uri, base).href, headers)}"`)
      return proxyUrl(new URL(trimmed, base).href, headers)
    })
    .join('\n')
}

export async function proxyResponse(token: string, range: string | undefined): Promise<Response> {
  const target = targets.get(token)
  if (!target || target.expires < Date.now()) notFound('PROXY_EXPIRED')
  let res: Response
  try {
    res = await fetch(target.url, {
      headers: { 'User-Agent': env.userAgent, ...target.headers, ...(range ? { Range: range } : {}) },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (error) {
    throw new UpstreamError('extension', 0, `Video source unreachable: ${(error as Error).message}`)
  }
  const type = res.headers.get('content-type') ?? ''
  if (/mpegurl/i.test(type) || /\.m3u8($|[?#])/i.test(target.url)) {
    const body = rewritePlaylist(await res.text(), res.url || target.url, target.headers)
    return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'private, max-age=30' } })
  }
  const headers = new Headers({ 'Cache-Control': 'private, max-age=3600' })
  for (const name of PASS_HEADERS) {
    const value = res.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(res.body, { status: res.status, headers })
}
