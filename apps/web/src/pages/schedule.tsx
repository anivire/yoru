import { useQuery } from '@tanstack/react-query'
import type { ScheduleItem } from '@yoru/shared'
import { Button, EmptyState, Image, Popover, PopoverContent, PopoverTrigger, Segmented, cn } from '@yoru/ui'
import { Check, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Page, PageHeader } from '../components/app-shell'
import { ScheduleSkeleton } from '../components/skeletons'
import { api } from '../lib/api'
import { i18n } from '../lib/i18n'

const DAY = 86_400_000

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - ((first.getDay() + 6) % 7))
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + (6 - ((last.getDay() + 6) % 7)))
  const days: Date[] = []
  for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(d)
  return { start, end: new Date(end.getTime() + DAY - 1), days }
}

const CELL_LIMIT = 3

function StatusMark({ item }: { item: ScheduleItem }) {
  if (item.available) {
    return (
      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-success text-white">
        <Check className="size-2.5" strokeWidth={3.5} />
      </span>
    )
  }
  if (item.aired) {
    return (
      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-warning text-black">
        <Clock className="size-2.5" strokeWidth={3} />
      </span>
    )
  }
  return null
}

function EntryRow({ item }: { item: ScheduleItem }) {
  const { t } = useTranslation()
  const time = new Date(item.airingAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  const state = item.available ? t('schedule.availableHint') : item.aired ? t('schedule.awaitingHint') : null
  return (
    <Link
      to={`/anime/${item.anime.malId}${item.available ? `?episode=${item.episode}` : ''}`}
      title={[item.anime.title, state, item.estimated ? t('schedule.estimatedHint') : null].filter(Boolean).join(' · ')}
      className={cn(
        'group flex items-center gap-2 rounded-lg p-1 transition-colors',
        item.available ? 'bg-success-soft hover:bg-success/25' : item.aired ? 'bg-warning-soft hover:bg-warning/25' : 'hover:bg-field',
      )}
    >
      <div className="relative shrink-0">
        <div className="aspect-[2/3] w-7 overflow-hidden rounded-md bg-muted">
          {item.anime.imageUrl ? <Image src={item.anime.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
        </div>
        {item.listStatus ? <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-accent shadow-[0_0_0_2px_var(--surface)]" /> : null}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-xs font-medium group-hover:text-accent">{item.anime.title}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="font-mono">
            {item.estimated ? '~' : ''}
            {time}
          </span>
          <span>·</span>
          <span className="truncate">{t('schedule.episodeShort', { episode: item.episode })}</span>
        </div>
      </div>
      <StatusMark item={item} />
    </Link>
  )
}

function DayEntries({ day, items }: { day: Date; items: ScheduleItem[] }) {
  const { t } = useTranslation()
  const visible = items.slice(0, CELL_LIMIT)
  const rest = items.length - visible.length
  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((item) => (
        <EntryRow key={`${item.anime.malId}-${item.episode}`} item={item} />
      ))}
      {rest > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="cursor-pointer rounded-lg px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-field hover:text-foreground">
              {t('schedule.more', { count: rest })}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2">
            <div className="px-1.5 pb-1.5 pt-1 text-xs font-semibold first-letter:uppercase">
              {day.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto">
              {items.map((item) => (
                <EntryRow key={`${item.anime.malId}-${item.episode}`} item={item} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}

export function SchedulePage() {
  const { t } = useTranslation()
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const grid = useMemo(() => monthGrid(month), [month])
  const { data, isPending, isError } = useQuery({
    queryKey: ['schedule', grid.start.toISOString(), grid.end.toISOString()],
    queryFn: () => api.schedule(grid.start.toISOString(), grid.end.toISOString()),
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

  const today = startOfDay(new Date())
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: 'short' })),
    [],
  )
  const monthTitle = month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
  const shift = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const inMonthDays = grid.days.filter((d) => d.getMonth() === month.getMonth() && byDay.get(dayKey(d))?.length)

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
          <ChevronLeft />
        </Button>
        <Button variant="secondary" size="icon-sm" aria-label={t('schedule.nextMonth')} onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
      </div>

      {isPending ? (
        <ScheduleSkeleton />
      ) : isError ? (
        <EmptyState mood="error" title={t('schedule.empty')} />
      ) : (
        <>
          <div className="hidden md:block">
            <div className="mb-2 grid grid-cols-7 gap-2 px-1 text-xs font-medium text-subtle-foreground">
              {weekdays.map((w) => (
                <span key={w} className="first-letter:uppercase">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {grid.days.map((day) => {
                const items = byDay.get(dayKey(day)) ?? []
                const inMonth = day.getMonth() === month.getMonth()
                const isToday = day.getTime() === today.getTime()
                return (
                  <div
                    key={dayKey(day)}
                    className={cn(
                      'flex min-h-28 min-w-0 flex-col gap-0.5 rounded-xl p-1.5',
                      isToday ? 'bg-accent-soft' : inMonth ? 'bg-surface' : 'bg-surface/40',
                    )}
                  >
                    <div className="flex items-center justify-between px-1 pb-0.5">
                      <span
                        className={cn(
                          'grid size-6 place-items-center rounded-full text-xs font-medium',
                          isToday ? 'bg-accent text-accent-foreground' : inMonth ? 'text-foreground' : 'text-subtle-foreground',
                        )}
                      >
                        {day.getDate()}
                      </span>
                      {items.length ? <span className="text-[11px] text-subtle-foreground">{items.length}</span> : null}
                    </div>
                    <div className={cn(!inMonth && 'opacity-60')}>
                      <DayEntries day={day} items={items} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-6 md:hidden">
            {inMonthDays.length ? (
              inMonthDays.map((day) => {
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
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-accent-soft px-3 text-accent">
              <span className="size-2.5 rounded-full bg-accent" />
              {t('schedule.inListHint')}
            </span>
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-success-soft px-3 text-success">
              <span className="grid size-4 place-items-center rounded-full bg-success text-white">
                <Check className="size-2.5" strokeWidth={3.5} />
              </span>
              {t('schedule.availableHint')}
            </span>
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-warning-soft px-3 text-warning">
              <span className="grid size-4 place-items-center rounded-full bg-warning text-black">
                <Clock className="size-2.5" strokeWidth={3} />
              </span>
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
