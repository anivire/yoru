import { useInfiniteQuery } from '@tanstack/react-query'
import type { ChangeType, ChangelogEntry } from '@yoru/shared'
import { Button, EmptyState, Skeleton, cn } from '@yoru/ui'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader } from '../components/app-shell'
import { api } from '../lib/api'
import { useDocumentTitle } from '../lib/title'

type Section = 'feat' | 'improve' | 'fix'

const SECTION_OF: Partial<Record<ChangeType, Section>> = { feat: 'feat', perf: 'improve', style: 'improve', fix: 'fix' }
const SECTIONS: Section[] = ['feat', 'improve', 'fix']
const SECTION_TONE: Record<Section, string> = {
  feat: 'bg-accent-soft text-accent',
  improve: 'bg-warning-soft text-warning',
  fix: 'bg-success-soft text-success',
}

interface Day {
  key: string
  date: Date
  current: boolean
  sections: Partial<Record<Section, ChangelogEntry[]>>
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function buildDays(entries: ChangelogEntry[], current: string | null): Day[] {
  const days: Day[] = []
  for (const entry of entries) {
    const date = entry.date ? new Date(entry.date) : new Date(0)
    const key = dayKey(date)
    let day = days[days.length - 1]
    if (day?.key !== key) {
      day = { key, date, current: false, sections: {} }
      days.push(day)
    }
    if (entry.sha === current) day.current = true
    const section = SECTION_OF[entry.type]
    if (section) (day.sections[section] ??= []).push(entry)
  }
  return days.filter((day) => day.current || SECTIONS.some((s) => day.sections[s]?.length))
}

function DayBlock({ day }: { day: Day }) {
  const { t, i18n } = useTranslation()
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const relative = dayKey(day.date) === dayKey(today) ? t('feed.today') : dayKey(day.date) === dayKey(yesterday) ? t('feed.yesterday') : null
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', ...(day.date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }).format(day.date)
  return (
    <section className="relative pb-10 pl-8 last:pb-0 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-8 sm:pl-0">
      <span aria-hidden className={cn('absolute left-0 top-1.5 size-3 rounded-full ring-4 ring-background sm:left-[9.5rem]', day.current ? 'bg-accent' : 'bg-border')} />
      <div className="mb-3 sm:mb-0 sm:text-right">
        <div className="text-[0.9375rem] font-semibold">{relative ?? date}</div>
        {relative ? <div className="text-[0.8125rem] text-muted-foreground">{date}</div> : null}
        {day.current ? <span className="mt-1.5 inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{t('changelog.current')}</span> : null}
      </div>
      <div className="flex flex-col gap-4 sm:pl-6">
        {SECTIONS.map((section) => {
          const items = day.sections[section]
          if (!items?.length) return null
          return (
            <div key={section}>
              <span className={cn('mb-2 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold', SECTION_TONE[section])}>{t(`changelog.sections.${section}`)}</span>
              <ul className="flex flex-col gap-1.5">
                {items.map((entry) => (
                  <li key={entry.sha} className="flex gap-2.5 text-[0.9375rem] leading-relaxed">
                    <span aria-hidden className="mt-[0.7em] size-1 shrink-0 rounded-full bg-subtle-foreground" />
                    <span className="min-w-0">
                      {entry.subject.charAt(0).toUpperCase() + entry.subject.slice(1)}{' '}
                      <a href={entry.url} target="_blank" rel="noreferrer" className="whitespace-nowrap font-mono text-xs text-subtle-foreground transition-colors hover:text-foreground">
                        {entry.sha.slice(0, 7)}
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const LINE_WIDTHS = ['w-full', 'w-11/12', 'w-5/6']

function ChangelogSkeleton() {
  return (
    <div className="relative">
      <span aria-hidden className="absolute bottom-0 left-1.5 top-2 w-px bg-border sm:left-[9.875rem]" />
      {[3, 2, 2].map((count, i) => (
        <section key={i} className="relative pb-10 pl-8 last:pb-0 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-8 sm:pl-0">
          <span aria-hidden className="absolute left-0 top-1.5 size-3 rounded-full bg-muted ring-4 ring-background sm:left-[9.5rem]" />
          <div className="mb-3 flex flex-col gap-1.5 sm:mb-0 sm:items-end">
            <Skeleton className="h-5 w-36 max-w-full rounded-md" />
            <Skeleton className="h-4 w-32 max-w-full rounded-md" />
          </div>
          <div className="flex flex-col gap-2 sm:pl-6">
            <Skeleton className="h-5 w-32 rounded-md" />
            {Array.from({ length: count }, (_, j) => (
              <Skeleton key={j} className={cn('h-5 rounded-md', LINE_WIDTHS[j % LINE_WIDTHS.length])} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function ChangelogPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('changelog.title'))
  const log = useInfiniteQuery({
    queryKey: ['changelog'],
    queryFn: ({ pageParam }) => api.changelog(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage,
    staleTime: 15 * 60_000,
  })
  const entries = log.data?.pages.flatMap((p) => p.entries) ?? []
  const days = buildDays(entries, log.data?.pages[0]?.current ?? null)

  return (
    <Page>
      <div className="grow-empty w-full max-w-3xl">
        <PageHeader title={t('changelog.title')} description={t('changelog.description')} />
        {log.isPending ? (
          <ChangelogSkeleton />
        ) : log.isError ? (
          <EmptyState mood="error" title={t('common.error')} description={log.error.message} action={<Button onClick={() => log.refetch()}>{t('common.retry')}</Button>} />
        ) : !days.length ? (
          <EmptyState mood="sleepy" title={t('changelog.empty')} />
        ) : (
          <div className="relative">
            <span aria-hidden className="absolute bottom-0 left-1.5 top-2 w-px bg-border sm:left-[9.875rem]" />
            {days.map((day) => (
              <DayBlock key={day.key} day={day} />
            ))}
            {log.hasNextPage ? (
              <div className="relative flex justify-center pt-10">
                <Button variant="secondary" loading={log.isFetchingNextPage} onClick={() => log.fetchNextPage()}>
                  {t('search.more')}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Page>
  )
}
