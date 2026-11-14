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

export function parseYoruExport(buffer: Buffer): ImportItem[] {
  let data: { format?: unknown; entries?: unknown }
  try {
    data = JSON.parse(buffer.toString('utf8').replace(/^﻿/, ''))
  } catch {
    badRequest('YORU_INVALID')
  }
  if (data?.format !== 'yoru-list' || !Array.isArray(data.entries)) badRequest('YORU_INVALID')
  const items = (data.entries as YoruEntry[]).flatMap((e): ImportItem[] => {
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
  return items
}
