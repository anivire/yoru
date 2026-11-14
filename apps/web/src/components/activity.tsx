import { useQuery } from '@tanstack/react-query'
import { Skeleton, cn } from '@yoru/ui'
import { RiPulseFill } from '@remixicon/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Section } from './app-shell'
import { api } from '../lib/api'
import { i18n } from '../lib/i18n'

const WEEKS = 53
const DAY = 86_400_000
const LEVELS = ['bg-field', 'bg-accent/25', 'bg-accent/50', 'bg-accent/75', 'bg-accent']

function level(count: number) {
  if (!count) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

function parse(date: string) {
  return new Date(`${date}T00:00:00Z`)
}

function key(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function ActivityHeatmap() {
  const { t } = useTranslation()
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const { data } = useQuery({ queryKey: ['activity', zone], queryFn: () => api.activity(zone) })
  const scroller = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ count: string; date: string; x: number; y: number } | null>(null)

  const grid = useMemo(() => {
    if (!data) return null
    const counts = new Map(data.days.map((d) => [d.date, d.count]))
    const today = parse(data.today)
    const weekday = (today.getUTCDay() + 6) % 7
    const start = new Date(today.getTime() - (weekday + (WEEKS - 1) * 7) * DAY)
    const weeks: { date: string; count: number; future: boolean }[][] = []
    const months: { index: number; label: string }[] = []
    for (let w = 0; w < WEEKS; w++) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start.getTime() + (w * 7 + d) * DAY)
        const k = key(date)
        week.push({ date: k, count: counts.get(k) ?? 0, future: date > today })
        if (date.getUTCDate() === 1 && w > 0) months.push({ index: w, label: date.toLocaleDateString(i18n.language, { month: 'short', timeZone: 'UTC' }) })
      }
      weeks.push(week)
    }
    return { weeks, months }
  }, [data])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [grid])

  const weekdays = useMemo(() => {
    const monday = new Date(Date.UTC(2024, 0, 1))
    return [0, 2, 4].map((d) => ({ row: d, label: new Date(monday.getTime() + d * DAY).toLocaleDateString(i18n.language, { weekday: 'short', timeZone: 'UTC' }) }))
  }, [])

  return (
    <Section
      title={t('home.activity')}
      icon={<RiPulseFill />}
      hint={data ? t('home.activityHint', { count: data.total }) : undefined}
    >
      {!grid ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : (
        <div ref={box} className="relative rounded-xl bg-surface p-4">
          <div ref={scroller} className="overflow-x-auto scrollbar-none" onScroll={() => setTip(null)} onMouseLeave={() => setTip(null)}>
            <div className="grid min-w-[44rem] grid-cols-[auto_1fr] gap-x-2">
              <div />
              <div className="relative mb-1.5 h-4 text-[0.6875rem] text-muted-foreground">
                {grid.months.map((m) => (
                  <span key={m.index} className="absolute" style={{ left: `${(m.index / WEEKS) * 100}%` }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="grid grid-rows-7 gap-[0.1875rem] text-[0.6875rem] text-muted-foreground">
                {Array.from({ length: 7 }, (_, row) => (
                  <span key={row} className="flex items-center leading-none">
                    {weekdays.find((w) => w.row === row)?.label ?? ''}
                  </span>
                ))}
              </div>
              <div className="grid grid-flow-col grid-rows-7 gap-[0.1875rem]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
                {grid.weeks.flat().map((cell) => (
                  <span
                    key={cell.date}
                    onMouseEnter={(e) => {
                      if (cell.future || !box.current) return
                      const outer = box.current.getBoundingClientRect()
                      const r = e.currentTarget.getBoundingClientRect()
                      setTip({
                        count: cell.count ? t('home.episodes', { count: cell.count }) : t('home.noEpisodes'),
                        date: parse(cell.date).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
                        x: r.left - outer.left + r.width / 2,
                        y: r.top - outer.top,
                      })
                    }}
                    className={cn('aspect-square rounded-[0.1875rem] transition-shadow', cell.future ? 'opacity-0' : cn(LEVELS[level(cell.count)], 'hover:ring-2 hover:ring-foreground/40'))}
                  />
                ))}
              </div>
            </div>
          </div>
          {tip ? (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-raised px-2.5 py-1.5 text-xs shadow-xl shadow-black/30 [--muted:var(--raised-muted)]"
              style={{ left: tip.x, top: tip.y - 6 }}
            >
              <div className="font-semibold">{tip.count}</div>
              <div className="text-muted-foreground">{tip.date}</div>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.6875rem] text-muted-foreground">
            <span>{data && !data.total ? t('home.activityEmpty') : null}</span>
            <span className="flex items-center gap-1.5">
              {t('home.less')}
              {LEVELS.map((c) => (
                <span key={c} className={cn('size-2.5 rounded-[0.1875rem]', c)} />
              ))}
              {t('home.more')}
            </span>
          </div>
        </div>
      )}
    </Section>
  )
}
