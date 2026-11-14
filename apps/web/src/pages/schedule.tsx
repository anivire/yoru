import { useQuery } from '@tanstack/react-query'
import type { ScheduleItem } from '@yoru/shared'
import { Button, EmptyState, Image, Segmented, cn } from '@yoru/ui'
import { RiArrowLeftSFill, RiArrowRightSFill } from '@remixicon/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AnimeHoverCard } from '../components/anime-hover'
import { Page, PageHeader } from '../components/app-shell'
import { ScheduleSkeleton } from '../components/skeletons'
import { api } from '../lib/api'
import { i18n } from '../lib/i18n'

const DAY = 86_400_000
const COLUMNS = 7
const CELL_ITEMS = 4

interface Cell {
  day: Date
  items: ScheduleItem[]
  first: boolean
  joinPrev: boolean
  joinNext: boolean
  total: number
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function monthRange(month: Date) {
  const days: Date[] = []
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= last; d++) days.push(new Date(month.getFullYear(), month.getMonth(), d))
  return { start: days[0]!, end: new Date(days[days.length - 1]!.getTime() + DAY - 1), days }
}

function buildCells(days: Date[], byDay: Map<string, ScheduleItem[]>): Cell[] {
  const cells: Cell[] = []
  for (const day of days) {
    const items = byDay.get(dayKey(day)) ?? []
    const chunks = Math.max(1, Math.ceil(items.length / CELL_ITEMS))
    for (let c = 0; c < chunks; c++) {
      const col = cells.length % COLUMNS
      cells.push({
        day,
        items: items.slice(c * CELL_ITEMS, (c + 1) * CELL_ITEMS),
        first: c === 0,
        joinPrev: c > 0 && col !== 0,
        joinNext: false,
        total: items.length,
      })
    }
  }
  for (let i = 0; i < cells.length - 1; i++) cells[i]!.joinNext = cells[i + 1]!.joinPrev
  return cells
}

function statusTone(item: ScheduleItem) {
  if (item.available) return { bar: 'bg-success', row: 'bg-success-soft hover:bg-success/25' }
  if (item.aired) return { bar: 'bg-warning', row: 'bg-warning-soft hover:bg-warning/25' }
  return { bar: 'bg-transparent', row: 'hover:bg-field' }
}

function EntryRow({ item }: { item: ScheduleItem }) {
  const { t } = useTranslation()
  const time = new Date(item.airingAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  const state = item.available ? t('schedule.availableHint') : item.aired ? t('schedule.awaitingHint') : null
  const tone = statusTone(item)
  const day = new Date(item.airingAt).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
  const footer = (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
        item.available ? 'bg-success-soft text-success' : item.aired ? 'bg-warning-soft text-warning' : 'bg-field text-muted-foreground',
      )}
    >
      <span className={cn('h-4 w-1 shrink-0 rounded-full', item.available ? 'bg-success' : item.aired ? 'bg-warning' : 'bg-subtle-foreground')} />
      <span className="font-semibold">{t('schedule.episodeShort', { episode: item.episode })}</span>
      <span className="opacity-80">
        {day}, {item.estimated ? '~' : ''}
        {time}
      </span>
      {state ? <span className="ml-auto text-right font-medium">{state}</span> : null}
    </div>
  )
  return (
    <AnimeHoverCard anime={item.anime} footer={footer}>
      <Link
        to={`/anime/${item.anime.malId}${item.available ? `?episode=${item.episode}` : ''}`}
        className={cn('group flex items-stretch gap-2 rounded-lg p-1 pl-1 transition-colors', tone.row)}
      >
        <span className={cn('w-1 shrink-0 rounded-full', tone.bar)} />
        <div className="aspect-[2/3] w-7 shrink-0 self-center overflow-hidden rounded-md bg-muted">
          {item.anime.imageUrl ? <Image src={item.anime.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1 self-center leading-tight">
          <div className={cn('truncate text-xs', item.listStatus ? 'font-semibold text-accent' : 'font-medium group-hover:text-accent')}>{item.anime.title}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="font-mono">
              {item.estimated ? '~' : ''}
              {time}
            </span>
            <span>·</span>
            <span className="truncate">{t('schedule.episodeShort', { episode: item.episode })}</span>
          </div>
        </div>
      </Link>
    </AnimeHoverCard>
  )
}

function DayHeader({ day, total, today }: { day: Date; total: number; today: boolean }) {
  return (
    <div className="flex h-7 items-center gap-2 px-1">
      <span className={cn('grid size-6 place-items-center rounded-full text-xs font-semibold', today ? 'bg-accent text-accent-foreground' : 'text-foreground')}>
        {day.getDate()}
      </span>
      <span className={cn('text-xs first-letter:uppercase', today ? 'font-medium text-accent' : 'text-subtle-foreground')}>
        {day.toLocaleDateString(i18n.language, { weekday: 'short' })}
      </span>
      {total ? <span className="ml-auto text-[11px] text-subtle-foreground">{total}</span> : null}
    </div>
  )
}

export function SchedulePage() {
  const { t } = useTranslation()
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const range = useMemo(() => monthRange(month), [month])
  const { data, isPending, isError } = useQuery({
    queryKey: ['schedule', range.start.toISOString(), range.end.toISOString()],
    queryFn: () => api.schedule(range.start.toISOString(), range.end.toISOString()),
    staleTime: 15 * 60_000,
  })

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const item of data ?? []) {
      if (scope === 'mine' && !item.listStatus) continue
      const key = dayKey(new Date(item.airingAt))
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [data, scope])

  const cells = useMemo(() => buildCells(range.days, byDay), [range, byDay])
  const today = startOfDay(new Date())
  const monthTitle = month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
  const shift = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const busyDays = range.days.filter((d) => byDay.get(dayKey(d))?.length)

  return (
    <Page>
      <PageHeader
        title={t('schedule.title')}
        description={t('schedule.hint')}
        actions={
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'mine', label: t('schedule.mine') },
              { value: 'all', label: t('schedule.all') },
            ]}
          />
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-semibold tracking-tight first-letter:uppercase">{monthTitle}</h2>
        <Button variant="secondary" size="sm" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
          {t('schedule.today')}
        </Button>
        <Button variant="secondary" size="icon-sm" aria-label={t('schedule.prevMonth')} onClick={() => shift(-1)}>
          <RiArrowLeftSFill />
        </Button>
        <Button variant="secondary" size="icon-sm" aria-label={t('schedule.nextMonth')} onClick={() => shift(1)}>
          <RiArrowRightSFill />
        </Button>
      </div>

      {isPending ? (
        <ScheduleSkeleton />
      ) : isError ? (
        <EmptyState mood="error" title={t('schedule.empty')} />
      ) : (
        <>
          <div className="hidden grid-cols-7 gap-2 md:grid">
            {cells.map((cell, i) => {
              const isToday = cell.day.getTime() === today.getTime()
              return (
                <div
                  key={`${dayKey(cell.day)}-${i}`}
                  className={cn(
                    'flex min-h-28 min-w-0 flex-col gap-0.5 rounded-xl p-1.5',
                    isToday ? 'bg-accent-soft' : 'bg-surface',
                    cell.joinPrev && '-ml-2 rounded-l-none pl-3.5',
                    cell.joinNext && 'rounded-r-none',
                  )}
                >
                  {cell.first ? <DayHeader day={cell.day} total={cell.total} today={isToday} /> : <div className="h-7" />}
                  {cell.items.map((item) => (
                    <EntryRow key={`${item.anime.malId}-${item.episode}`} item={item} />
                  ))}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-6 md:hidden">
            {busyDays.length ? (
              busyDays.map((day) => {
                const isToday = day.getTime() === today.getTime()
                return (
                  <section key={dayKey(day)}>
                    <h3 className={cn('mb-2 text-sm font-semibold first-letter:uppercase', isToday && 'text-accent')}>
                      {day.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <div className="flex flex-col gap-0.5 rounded-xl bg-surface p-1.5">
                      {byDay.get(dayKey(day))!.map((item) => (
                        <EntryRow key={`${item.anime.malId}-${item.episode}`} item={item} />
                      ))}
                    </div>
                  </section>
                )
              })
            ) : (
              <EmptyState mood="sleepy" title={scope === 'mine' ? t('schedule.emptyMine') : t('schedule.empty')} />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-field px-3 font-semibold text-accent">{t('schedule.inListHint')}</span>
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-success-soft pl-1.5 pr-3 text-success">
              <span className="h-4 w-1 rounded-full bg-success" />
              {t('schedule.availableHint')}
            </span>
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-warning-soft pl-1.5 pr-3 text-warning">
              <span className="h-4 w-1 rounded-full bg-warning" />
              {t('schedule.awaitingHint')}
            </span>
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-field px-3 text-muted-foreground">
              <span className="font-mono text-foreground">~</span>
              {t('schedule.estimatedHint')}
            </span>
          </div>
        </>
      )}
    </Page>
  )
}
