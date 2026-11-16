import { useQuery } from '@tanstack/react-query'
import { LIST_STATUSES, type ListStatus, type StatsBucket, type UserStats } from '@yoru/shared'
import { Button, EmptyState, Skeleton, StarIcon, Tooltip, cn } from '@yoru/ui'
import { RiPlayCircleFill, RiTimeFill, RiBuilding2Fill, RiErrorWarningFill, RiCalendar2Fill, RiHistoryFill, RiPriceTag3Fill, RiSunCloudyFill, RiTv2Fill } from '@remixicon/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, Section } from '../components/app-shell'
import { api } from '../lib/api'
import { typeLabel } from '../lib/format'
import { STATUS_META, StatusIcon, TONE_SOLID } from '../lib/list-status'
import { keys } from '../lib/queries'
import { ShareButton } from '../components/share-list'
import { useDocumentTitle } from '../lib/title'

function useNumber() {
  const { i18n } = useTranslation()
  return (value: number, digits = 0) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: digits }).format(value)
}

function HeroStat({ icon, value, approx, label, hint, tone = 'text-accent', iconFirst = false }: { icon: ReactNode; value: ReactNode; approx?: boolean; label: string; hint?: ReactNode; tone?: string; iconFirst?: boolean }) {
  const mark = <span className={cn('grid shrink-0 place-items-center [&_svg]:size-5 @[15rem]:[&_svg]:size-7', tone)}>{icon}</span>
  return (
    <div className="@container flex min-w-0 flex-col rounded-xl bg-accent-soft p-3.5 sm:p-5">
      <span className="flex min-w-0 items-center gap-1.5 text-2xl font-semibold tracking-tight tabular-nums @[13rem]:text-3xl @[15rem]:gap-2 @[15rem]:text-4xl">
        {iconFirst ? mark : null}
        {approx ? <span className="text-lg font-medium text-muted-foreground @[15rem]:text-2xl">≈</span> : null}
        {value}
        {iconFirst ? null : mark}
      </span>
      <span className="mt-1 text-[0.8125rem] font-medium text-foreground/80 sm:text-sm">{label}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

function StatusStrip({ statuses }: { statuses: UserStats['statuses'] }) {
  const { t } = useTranslation()
  const total = LIST_STATUSES.reduce((sum, s) => sum + statuses[s], 0)
  if (!total) return null
  const present = LIST_STATUSES.filter((s) => statuses[s])
  const percent = (s: ListStatus) => Math.max(1, Math.round((statuses[s] / total) * 100))
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-accent-soft p-3.5 sm:p-5">
      <div className="flex h-3 gap-1.5">
        {present.map((s) => (
          <Tooltip key={s} content={`${t(`status.${s}`)}: ${statuses[s]} · ${percent(s)}%`}>
            <span className={cn('h-full min-w-3 rounded-full transition-opacity hover:opacity-80', TONE_SOLID[STATUS_META[s].tone])} style={{ flexGrow: statuses[s], flexBasis: 0 }} />
          </Tooltip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 @xl:grid-cols-3 @6xl:grid-cols-6">
        {LIST_STATUSES.map((s) => (
          <div key={s} className="flex min-w-0 items-center gap-2.5 rounded-lg bg-raised px-3 py-2">
            <StatusIcon status={s} className="size-4" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-muted-foreground">{t(`status.${s}`)}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold tabular-nums">{statuses[s]}</span>
                {statuses[s] ? <span className="text-xs tabular-nums text-muted-foreground">{percent(s)}%</span> : null}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Column {
  key: string
  label: string
  value: number
  tip: ReactNode
}

function ColumnChart({ columns, labelEvery = 1, height = 'h-36 sm:h-44' }: { columns: Column[]; labelEvery?: number; height?: string }) {
  const max = Math.max(1, ...columns.map((c) => c.value))
  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className={cn('flex items-end gap-[2px] border-b border-border', height)}>
        {columns.map((c) => (
          <Tooltip key={c.key} content={c.tip}>
            <div className="group flex h-full min-w-0 flex-1 cursor-default items-end" aria-label={`${c.label}: ${c.value}`}>
              <div
                className={cn('w-full rounded-t-[4px] transition-opacity', c.value ? 'bg-accent group-hover:opacity-80' : '')}
                style={{ height: c.value ? `max(3px, ${(c.value / max) * 100}%)` : 0 }}
              />
            </div>
          </Tooltip>
        ))}
      </div>
      <div className="flex gap-[2px] text-[0.6875rem] text-subtle-foreground tabular-nums">
        {columns.map((c, i) => (
          <span key={c.key} className={cn('min-w-0 flex-1 whitespace-nowrap text-center', labelEvery === 1 && columns.length > 10 && i % 2 === 1 && 'max-sm:invisible')}>
            {i % labelEvery === 0 ? c.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function BarList({ rows }: { rows: { key: string; label: ReactNode; value: number; tip?: ReactNode }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const row = (
          <li key={r.key} className="flex cursor-default flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="text-[0.8125rem] font-semibold tabular-nums">{r.value}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </span>
          </li>
        )
        return r.tip ? (
          <Tooltip key={r.key} content={r.tip}>
            {row}
          </Tooltip>
        ) : (
          row
        )
      })}
    </ul>
  )
}

function BucketTip({ bucket }: { bucket: StatsBucket }) {
  const { t } = useTranslation()
  const n = useNumber()
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{bucket.name}</span>
      <span>{t('stats.titlesCount', { count: bucket.count })}</span>
      <span>{t('stats.hoursShort', { value: n(bucket.minutes / 60) })}</span>
      {bucket.meanScore ? <span>{t('stats.meanScoreShort', { value: n(bucket.meanScore, 2) })}</span> : null}
    </span>
  )
}

function BucketList({ buckets, label = (b: StatsBucket) => b.name }: { buckets: StatsBucket[]; label?: (b: StatsBucket) => string }) {
  return <BarList rows={buckets.map((b) => ({ key: b.name, label: label(b), value: b.count, tip: <BucketTip bucket={{ ...b, name: label(b) }} /> }))} />
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col rounded-xl bg-surface p-4 sm:p-5">{children}</div>
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 py-6 text-center">
      <span className="grid size-10 place-items-center rounded-xl bg-foreground/[0.06] text-muted-foreground">
        <RiErrorWarningFill className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-52 rounded-xl" />
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

export function StatsView({ stats }: { stats: UserStats }) {
  const { t, i18n } = useTranslation()
  const n = useNumber()
  const { totals } = stats
  const hours = totals.minutes / 60
  const monthShort = new Intl.DateTimeFormat(i18n.language, { month: 'short' })
  const monthLong = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' })
  const topCount = Math.max(...stats.scores.map((s) => s.count))
  const topScore = stats.scores.find((s) => s.count === topCount && s.count > 0)
  const yearEvery = Math.max(1, Math.ceil(stats.years.length / 10))
  const seasonTotal = stats.seasons.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="@container flex flex-col">
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 @5xl:grid-cols-4">
          <HeroStat icon={<RiTimeFill />} approx value={n(hours)} label={t('stats.hours')} hint={t('stats.days', { count: Math.round(hours / 24) })} />
          <HeroStat icon={<RiPlayCircleFill />} value={n(totals.episodes)} label={t('stats.episodes')} hint={totals.rewatches ? t('stats.rewatchesHint', { count: totals.rewatches }) : undefined} />
          <HeroStat icon={<RiTv2Fill />} value={n(totals.titles)} label={t('stats.titles')} hint={t('stats.completedOf', { count: totals.completed })} />
          <HeroStat
            icon={<StarIcon />}
            tone="text-amber-500"
            iconFirst
            value={totals.meanScore ? n(totals.meanScore, 2) : '-'}
            label={t('stats.meanScore')}
            hint={t('stats.scoredOf', { count: totals.scored })}
          />
        </div>
        <StatusStrip statuses={stats.statuses} />
      </div>

      <Section title={t('stats.monthly')} hint={t('stats.monthlyHint')} icon={<RiCalendar2Fill />}>
        <Panel>
          <ColumnChart
            height="h-36 sm:h-48"
            columns={stats.months.map((m) => {
              const date = new Date(`${m.month}-15T12:00:00Z`)
              return { key: m.month, label: monthShort.format(date), value: m.episodes, tip: `${monthLong.format(date)}: ${t('stats.episodesCount', { count: m.episodes })}` }
            })}
          />
        </Panel>
      </Section>

      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-8 sm:mt-10 sm:gap-y-10 @4xl:grid-cols-2 [&>section]:mt-0 [&>section]:min-w-0 [&>section]:flex [&>section]:flex-col">
        <Section title={t('stats.scores')} hint={topScore ? t('stats.scoresHint', { score: topScore.score }) : undefined} icon={<StarIcon />}>
          <Panel>
            <ColumnChart columns={stats.scores.map((s) => ({ key: String(s.score), label: String(s.score), value: s.count, tip: t('stats.scoreTip', { score: s.score, count: s.count }) }))} />
          </Panel>
        </Section>
        <Section title={t('stats.genres')} hint={t('stats.genresHint')} icon={<RiPriceTag3Fill />}>
          <Panel>
            {stats.genres.length ? <BucketList buckets={stats.genres.slice(0, 6)} /> : <Muted>{t('stats.noData')}</Muted>}
          </Panel>
        </Section>
        <Section title={t('stats.studios')} hint={t('stats.genresHint')} icon={<RiBuilding2Fill />}>
          <Panel>
            {stats.studios.length ? <BucketList buckets={stats.studios.slice(0, 6)} /> : <Muted>{t('stats.noStudios')}</Muted>}
          </Panel>
        </Section>
        <Section title={t('stats.formats')} hint={t('stats.formatsHint')} icon={<RiTv2Fill />}>
          <Panel>
            <BucketList buckets={stats.types.slice(0, 6)} label={(b) => typeLabel(b.name)} />
          </Panel>
        </Section>
        <Section title={t('stats.years')} hint={t('stats.yearsHint')} icon={<RiHistoryFill />}>
          <Panel>
            <ColumnChart
              labelEvery={yearEvery}
              columns={stats.years.map((y) => ({ key: String(y.year), label: String(y.year), value: y.count, tip: `${y.year}: ${t('stats.titlesCount', { count: y.count })}` }))}
            />
          </Panel>
        </Section>
        <Section title={t('stats.seasons')} hint={t('stats.seasonsHint')} icon={<RiSunCloudyFill />}>
          <Panel>
            <div className="grid grid-cols-2 gap-3">
              {stats.seasons.map((s) => (
                <div key={s.season} className="flex flex-col gap-0.5 rounded-lg bg-foreground/[0.04] px-4 py-3">
                  <span className="text-[0.8125rem] text-muted-foreground">{t(`season.${s.season}`)}</span>
                  <span className="text-2xl font-semibold tabular-nums">{s.count}</span>
                  <span className="text-xs text-subtle-foreground">{seasonTotal ? `${n((s.count / seasonTotal) * 100)}%` : ''}</span>
                </div>
              ))}
            </div>
          </Panel>
        </Section>
      </div>
      <p className="mt-10 text-xs text-subtle-foreground">{t('stats.estimateNote')}</p>
    </div>
  )
}

export function StatsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('stats.title'))
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const stats = useQuery({ queryKey: keys.stats, queryFn: () => api.stats(tz) })
  return (
    <Page>
      <PageHeader title={t('stats.title')} description={t('stats.description')} actions={<ShareButton kind="stats" />} />
      {stats.isPending ? (
        <StatsSkeleton />
      ) : stats.isError ? (
        <EmptyState mood="error" title={t('common.error')} description={stats.error.message} action={<Button onClick={() => stats.refetch()}>{t('common.retry')}</Button>} />
      ) : !stats.data.totals.titles ? (
        <EmptyState mood="sleepy" title={t('stats.empty')} description={t('stats.emptyHint')} />
      ) : (
        <StatsView stats={stats.data} />
      )}
    </Page>
  )
}
