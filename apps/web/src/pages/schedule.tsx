import { useQuery } from '@tanstack/react-query'
import type { ScheduleItem } from '@yoru/shared'
import { Button, EmptyState, Image, Segmented, cn } from '@yoru/ui'
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

function EntryRow({ item }: { item: ScheduleItem }) {
  const { t } = useTranslation()
  const time = new Date(item.airingAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  const state = item.available ? t('schedule.availableHint') : item.aired ? t('schedule.awaitingHint') : null
  return (
    <Link
      to={`/anime/${item.anime.malId}${item.available ? `?episode=${item.episode}` : ''}`}
      title={[item.anime.title, state, item.estimated ? t('schedule.estimatedHint') : null].filter(Boolean).join(' · ')}
      className={cn('group flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-field', item.aired && !item.available && 'opacity-70')}
    >
      <div className="relative aspect-[2/3] w-7 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.anime.imageUrl ? <Image src={item.anime.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1">
          {item.listStatus ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
          <span className="truncate text-xs font-medium group-hover:text-accent">{item.anime.title}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="font-mono">
            {item.estimated ? '~' : ''}
            {time}
          </span>
          <span>·</span>
          <span className="truncate">{t('schedule.episodeShort', { episode: item.episode })}</span>
          {item.available ? <Check className="size-3 shrink-0 text-success" /> : item.aired ? <Clock className="size-3 shrink-0 text-warning" /> : null}
        </div>
      </div>
    </Link>
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
                    <div className={cn('flex flex-col gap-0.5', !inMonth && 'opacity-60')}>
                      {items.map((item) => (
                        <EntryRow key={`${item.anime.malId}-${item.episode}`} item={item} />
                      ))}
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

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent" />
              {t('schedule.inListHint')}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3 text-success" />
              {t('schedule.availableHint')}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3 text-warning" />
              {t('schedule.awaitingHint')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono">~</span>
              {t('schedule.estimatedHint')}
            </span>
          </div>
        </>
      )}
    </Page>
  )
}
