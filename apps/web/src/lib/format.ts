import type { AnimeSummary } from '@yoru/shared'
import { i18n } from './i18n'

export function exportFormatName(format: string): string {
  if (format === 'mal-xml') return 'MAL XML'
  if (format === 'yoru') return 'yoru'
  return format.toUpperCase()
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function relativeTime(iso: string): string {
  const diff = Date.parse(iso) - Date.now()
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60_000) return i18n.t('time.now')
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), 'day')
  return rtf.format(Math.round(diff / (30 * 86_400_000)), 'month')
}

export function formatDate(iso: string | null, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(i18n.language, opts).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

export function typeLabel(type: string | null): string {
  if (!type) return ''
  return i18n.exists(`type.${type}`) ? i18n.t(`type.${type}`) : type.toUpperCase()
}

export function seasonLabel(a: Pick<AnimeSummary, 'season' | 'year'>): string {
  if (!a.year) return ''
  return a.season && i18n.exists(`season.${a.season}`) ? `${i18n.t(`season.${a.season}`)} ${a.year}` : String(a.year)
}

export function episodesLabel(progress: number | null, total: number | null): string {
  const p = progress ?? 0
  return `${p} / ${total ?? '?'}`
}
