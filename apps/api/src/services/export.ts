import type { ExportFormat, ListEntryWithAnime, ListStatus } from '@yoru/shared'

const MAL_STATUS: Record<ListStatus, string> = {
  watching: 'Watching',
  rewatching: 'Watching',
  completed: 'Completed',
  paused: 'On-Hold',
  dropped: 'Dropped',
  planning: 'Plan to Watch',
}

const MAL_TYPE: Record<string, string> = {
  tv: 'TV',
  movie: 'Movie',
  ova: 'OVA',
  ona: 'ONA',
  special: 'Special',
  tv_special: 'TV Special',
  music: 'Music',
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function cdata(value: string | null | undefined): string {
  return `<![CDATA[${(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function malDate(value: string | null): string {
  return value ? value.slice(0, 10) : '0000-00-00'
}

export interface ExportProgress {
  malId: number
  episode: number
  position: number
  duration: number
  updatedAt: string
}

function entryJson(e: ListEntryWithAnime) {
  return {
    malId: e.malId,
    title: e.anime.title,
    titleEnglish: e.anime.titleEnglish,
    imageUrl: e.anime.imageUrl,
    type: e.anime.type,
    episodes: e.anime.episodes,
    status: e.status,
    progress: e.progress,
    score: e.score,
    rewatches: e.rewatches,
    notes: e.notes,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    updatedAt: e.updatedAt,
  }
}

function toYoru(items: ListEntryWithAnime[], username: string, progress: ExportProgress[]): string {
  return JSON.stringify(
    {
      format: 'yoru-list',
      version: 2,
      exportedAt: new Date().toISOString(),
      user: username,
      entries: items.map(entryJson),
      watchProgress: progress,
    },
    null,
    2,
  )
}

function toJson(items: ListEntryWithAnime[]): string {
  return JSON.stringify(items.map(entryJson), null, 2)
}

function toCsv(items: ListEntryWithAnime[]): string {
  const header = ['mal_id', 'title', 'title_english', 'type', 'episodes', 'status', 'progress', 'score', 'rewatches', 'started_at', 'completed_at', 'notes', 'updated_at']
  const rows = items.map((e) =>
    [e.malId, e.anime.title, e.anime.titleEnglish, e.anime.type, e.anime.episodes, e.status, e.progress, e.score, e.rewatches, e.startedAt, e.completedAt, e.notes, e.updatedAt]
      .map(csvCell)
      .join(','),
  )
  return '﻿' + [header.join(','), ...rows].join('\r\n')
}

function toMalXml(items: ListEntryWithAnime[], username: string): string {
  const count = (s: string) => items.filter((e) => MAL_STATUS[e.status] === s).length
  const entries = items.map(
    (e) => `  <anime>
    <series_animedb_id>${e.malId}</series_animedb_id>
    <series_title>${cdata(e.anime.title)}</series_title>
    <series_type>${MAL_TYPE[e.anime.type ?? ''] ?? 'Unknown'}</series_type>
    <series_episodes>${e.anime.episodes ?? 0}</series_episodes>
    <my_id>0</my_id>
    <my_watched_episodes>${e.progress}</my_watched_episodes>
    <my_start_date>${malDate(e.startedAt)}</my_start_date>
    <my_finish_date>${malDate(e.completedAt)}</my_finish_date>
    <my_rated></my_rated>
    <my_score>${Math.round(e.score ?? 0)}</my_score>
    <my_storage></my_storage>
    <my_storage_value>0.00</my_storage_value>
    <my_status>${MAL_STATUS[e.status]}</my_status>
    <my_comments>${cdata(e.notes)}</my_comments>
    <my_times_watched>${e.rewatches}</my_times_watched>
    <my_rewatch_value></my_rewatch_value>
    <my_priority>LOW</my_priority>
    <my_tags>${cdata('')}</my_tags>
    <my_rewatching>${e.status === 'rewatching' ? 1 : 0}</my_rewatching>
    <my_rewatching_ep>0</my_rewatching_ep>
    <my_discuss>1</my_discuss>
    <my_sns>default</my_sns>
    <update_on_import>1</update_on_import>
  </anime>`,
  )
  return `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo>
    <user_id>0</user_id>
    <user_name>${cdata(username)}</user_name>
    <user_export_type>1</user_export_type>
    <user_total_anime>${items.length}</user_total_anime>
    <user_total_watching>${count('Watching')}</user_total_watching>
    <user_total_completed>${count('Completed')}</user_total_completed>
    <user_total_onhold>${count('On-Hold')}</user_total_onhold>
    <user_total_dropped>${count('Dropped')}</user_total_dropped>
    <user_total_plantowatch>${count('Plan to Watch')}</user_total_plantowatch>
  </myinfo>
${entries.join('\n')}
</myanimelist>
`
}

export function exportList(format: ExportFormat, items: ListEntryWithAnime[], username: string, progress: ExportProgress[] = []) {
  const stamp = new Date().toISOString().slice(0, 10)
  switch (format) {
    case 'yoru':
      return { body: toYoru(items, username, progress), type: 'application/json', filename: `yoru-${username}-${stamp}.yoru.json` }
    case 'json':
      return { body: toJson(items), type: 'application/json', filename: `yoru-${username}-${stamp}.json` }
    case 'csv':
      return { body: toCsv(items), type: 'text/csv; charset=utf-8', filename: `yoru-${username}-${stamp}.csv` }
    case 'mal-xml':
      return { body: toMalXml(items, username), type: 'application/xml', filename: `yoru-${username}-${stamp}-mal.xml` }
  }
}
