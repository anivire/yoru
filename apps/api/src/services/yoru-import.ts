import { LIST_STATUSES, type ListStatus } from '@yoru/shared'
import { badRequest } from '../lib/http'
import type { ImportItem } from './importers'

interface YoruEntry {
  malId?: unknown
  title?: unknown
  titleEnglish?: unknown
  type?: unknown
  episodes?: unknown
  status?: unknown
  progress?: unknown
  score?: unknown
  rewatches?: unknown
  notes?: unknown
  startedAt?: unknown
  completedAt?: unknown
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

export interface YoruProgress {
  malId: number
  episode: number
  position: number
  duration: number
  updatedAt: string
}

export function parseYoruExport(buffer: Buffer): { items: ImportItem[]; progress: YoruProgress[] } {
  let data: unknown
  try {
    data = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''))
  } catch {
    badRequest('YORU_INVALID')
  }
  const envelope = data as { format?: unknown; entries?: unknown; watchProgress?: unknown }
  const entries = Array.isArray(data) ? data : envelope?.format === 'yoru-list' && Array.isArray(envelope.entries) ? envelope.entries : null
  if (!entries) badRequest('YORU_INVALID')
  const items = (entries as YoruEntry[]).flatMap((e): ImportItem[] => {
    const malId = num(e.malId)
    const status = LIST_STATUSES.includes(e.status as ListStatus) ? (e.status as ListStatus) : null
    if (!malId || !status) return []
    return [
      {
        malId,
        title: str(e.title) ?? `#${malId}`,
        titleEnglish: str(e.titleEnglish),
        type: str(e.type),
        episodes: num(e.episodes),
        status,
        progress: Math.max(0, Math.trunc(num(e.progress) ?? 0)),
        score: num(e.score),
        rewatches: Math.max(0, Math.trunc(num(e.rewatches) ?? 0)),
        notes: str(e.notes),
        startedAt: date(e.startedAt),
        completedAt: date(e.completedAt),
      },
    ]
  })
  if (!items.length) badRequest('YORU_EMPTY')
  const known = new Set(items.map((i) => i.malId))
  const progress = (Array.isArray(envelope?.watchProgress) ? (envelope.watchProgress as Record<string, unknown>[]) : []).flatMap((p): YoruProgress[] => {
    const malId = num(p.malId)
    const episode = num(p.episode)
    if (!malId || !episode || !known.has(malId)) return []
    return [{ malId, episode, position: Math.max(0, num(p.position) ?? 0), duration: Math.max(0, num(p.duration) ?? 0), updatedAt: str(p.updatedAt) ?? new Date().toISOString() }]
  })
  return { items, progress }
}
