import { useQuery } from '@tanstack/react-query'
import { type AdminSettings, type ProvidersSettings, RELEASE_SOURCES, type ReleaseSource } from '@yoru/shared'
import { Badge, Skeleton, StatusDot, cn } from '@yoru/ui'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { Group } from './admin-group'
import { SOURCE_NAMES, SourceIcon } from './source-logo'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-subtle-foreground">{label}</span>
      <span className="font-medium text-muted-foreground">{value}</span>
    </span>
  )
}

export function ReleasesSection({ settings, providers }: { settings: AdminSettings | undefined; providers: ProvidersSettings | undefined }) {
  const { t } = useTranslation()
  const status = useQuery({ queryKey: ['admin', 'releases'], queryFn: api.admin.releases, refetchInterval: 60_000 })
  const stateOf = (id: ReleaseSource) => {
    if (id === 'shikimori') return settings?.features.discover ? 'polled' : 'notPolled'
    const entry = providers?.video.find((e) => e.id === id)
    if (!entry?.enabled) return 'notPolled'
    return entry.available ? 'polled' : 'noToken'
  }
  const data = status.data
  return (
    <Group title={t('admin.releases.title')} hint={t('admin.releases.hint')}>
      {data ? (
        <p className="text-xs text-muted-foreground">
          {[
            t('admin.releases.interval', { count: data.intervalMinutes }),
            data.lastRunAt ? t('admin.releases.lastRun', { time: relativeTime(data.lastRunAt) }) : t('admin.releases.neverRun'),
            data.nextRunAt ? t('admin.releases.nextRun', { time: relativeTime(data.nextRunAt) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : (
        <Skeleton className="h-4 w-64 max-w-full rounded-md" />
      )}
      <div className="-mx-3 flex flex-col">
        {RELEASE_SOURCES.map((id) => {
          const state = stateOf(id)
          const info = data?.sources.find((s) => s.id === id)
          return (
            <div key={id} className="flex min-w-0 items-start gap-3 rounded-lg py-2 pl-3 pr-3">
              <SourceIcon id={id} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn('truncate text-sm font-medium', state !== 'polled' && 'text-muted-foreground')}>{SOURCE_NAMES[id]}</span>
                  <Badge variant={state === 'polled' ? (info?.error ? 'danger' : 'success') : 'neutral'} className="shrink-0">
                    {state === 'polled' ? <StatusDot tone={info?.error ? 'danger' : 'success'} /> : null}
                    {t(`admin.releases.${state}`)}
                  </Badge>
                </span>
                {info?.error ? (
                  <span className="mt-0.5 block truncate text-xs text-danger" title={info.error}>
                    {t('admin.releases.error', { message: info.error })}
                  </span>
                ) : (
                  <span className="mt-0.5 block truncate text-xs text-subtle-foreground">
                    {[t(`admin.releases.what.${id}`), info?.checkedAt ? t('admin.releases.checked', { time: relativeTime(info.checkedAt) }) : null].filter(Boolean).join(' · ')}
                  </span>
                )}
                {info && (info.checkedAt || info.lastNotifiedAt) ? (
                  <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <Stat label={t('admin.releases.lastNotified')} value={info.lastNotifiedAt ? relativeTime(info.lastNotifiedAt) : t('admin.releases.none')} />
                    <Stat label={t('admin.releases.lastFound')} value={info.lastFoundAt ? relativeTime(info.lastFoundAt) : t('admin.releases.none')} />
                    <Stat label={t('admin.releases.notified24h')} value={String(info.notified24h)} />
                  </span>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
    </Group>
  )
}
