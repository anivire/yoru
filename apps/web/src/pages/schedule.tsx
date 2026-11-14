import { useQuery } from '@tanstack/react-query'
import type { ScheduleItem } from '@yoru/shared'
import { EmptyState, Image, Segmented, cn } from '@yoru/ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Page, PageHeader } from '../components/app-shell'
import { ScheduleSkeleton } from '../components/skeletons'
import { api } from '../lib/api'
import { i18n } from '../lib/i18n'

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dayTitle(date: Date, t: (key: string) => string) {
  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const label = date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })
  if (dayKey(date) === dayKey(today)) return `${t('schedule.today')} · ${label}`
  if (dayKey(date) === dayKey(tomorrow)) return `${t('schedule.tomorrow')} · ${label}`
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function Entry({ item }: { item: ScheduleItem }) {
  const { t } = useTranslation()
  const at = new Date(item.airingAt)
  const aired = at.getTime() < Date.now()
  return (
    <Link
      to={`/anime/${item.anime.malId}`}
      className={cn('group flex items-center gap-4 rounded-xl bg-surface p-2.5 pr-4 transition-colors hover:bg-field', aired && 'opacity-60')}
    >
      <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.anime.imageUrl ? <Image src={item.anime.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[15px] font-medium leading-snug">{item.anime.title}</div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
          <span>
            {t('common.episode')} {item.episode}
          </span>
          {item.listStatus ? <span className="truncate text-accent">· {t(`status.${item.listStatus}`)}</span> : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm">{at.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}</div>
        {aired ? <div className="text-[11px] text-subtle-foreground">{t('schedule.aired')}</div> : null}
      </div>
    </Link>
  )
}

export function SchedulePage() {
  const { t } = useTranslation()
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const { data, isPending, isError } = useQuery({ queryKey: ['schedule'], queryFn: api.schedule, staleTime: 15 * 60_000 })

  const days = useMemo(() => {
    const items = (data ?? []).filter((i) => scope === 'all' || i.listStatus)
    const groups = new Map<string, { date: Date; items: ScheduleItem[] }>()
    for (const item of items) {
      const date = new Date(item.airingAt)
      const key = dayKey(date)
      const group = groups.get(key) ?? { date, items: [] }
      group.items.push(item)
      groups.set(key, group)
    }
    return [...groups.values()]
  }, [data, scope])

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
      {isPending ? (
        <ScheduleSkeleton />
      ) : isError ? (
        <EmptyState mood="error" title={t('schedule.empty')} />
      ) : !days.length ? (
        <EmptyState mood="sleepy" title={scope === 'mine' ? t('schedule.emptyMine') : t('schedule.empty')} />
      ) : (
        <div className="flex flex-col gap-8">
          {days.map((day) => (
            <section key={dayKey(day.date)}>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">{dayTitle(day.date, t)}</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 wide:2xl:grid-cols-4">
                {day.items.map((item) => (
                  <Entry key={`${item.anime.malId}-${item.episode}`} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  )
}
