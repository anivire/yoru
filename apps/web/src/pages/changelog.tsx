import { useInfiniteQuery } from '@tanstack/react-query'
import type { ChangeType, ChangelogEntry, ReleaseChannel } from '@yoru/shared'
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

interface Release {
  key: string
  version: string | null
  date: Date | null
  current: boolean
  sections: Partial<Record<Section, ChangelogEntry[]>>
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function buildReleases(entries: ChangelogEntry[], current: string | null, channel: ReleaseChannel): Release[] {
  const releases: Release[] = []
  let release: Release | undefined
  for (const entry of entries) {
    if (entry.release || !release) {
      release = { key: entry.release ?? 'next', version: entry.release, date: entry.release && entry.date ? new Date(entry.date) : null, current: false, sections: {} }
      releases.push(release)
    }
    if (entry.sha === current) release.current = true
    const section = SECTION_OF[entry.type]
    if (section) (release.sections[section] ??= []).push(entry)
  }
  return releases.filter((r) => (r.version || channel === 'edge') && (r.current || SECTIONS.some((s) => r.sections[s]?.length)))
}

function ReleaseDate({ date }: { date: Date }) {
  const { t, i18n } = useTranslation()
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const relative = dayKey(date) === dayKey(today) ? t('feed.today') : dayKey(date) === dayKey(yesterday) ? t('feed.yesterday') : null
  return relative ?? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }).format(date)
}

function ReleaseBlock({ release }: { release: Release }) {
  const { t } = useTranslation()
  return (
    <section className="relative pb-10 pl-8 last:pb-0 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-8 sm:pl-0">
      <span aria-hidden className={cn('absolute left-0 top-1.5 size-3 rounded-full ring-4 ring-background sm:left-[9.5rem]', release.current ? 'bg-accent' : 'bg-border')} />
      <div className="mb-3 sm:mb-0 sm:text-right">
        <div className="text-[0.9375rem] font-semibold">{release.version ? `v${release.version}` : t('changelog.next')}</div>
        <div className="text-[0.8125rem] text-muted-foreground">{release.date ? <ReleaseDate date={release.date} /> : t('changelog.nextHint')}</div>
        {release.current ? <span className="mt-1.5 inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{t('changelog.current')}</span> : null}
      </div>
      <div className="flex flex-col gap-4 sm:pl-6">
        {SECTIONS.map((section) => {
          const items = release.sections[section]
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
    <div className="skeleton-fill relative">
      <span aria-hidden className="absolute bottom-0 left-1.5 top-2 w-px bg-border sm:left-[9.875rem]" />
      {[3, 2, 2, 4, 1, 3, 2, 3, 2, 1].map((count, i) => (
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
  const first = log.data?.pages[0]
  const releases = buildReleases(entries, first?.current ?? null, first?.channel ?? 'edge')

  return (
    <Page>
      <div className="grow-empty w-full max-w-3xl">
        <PageHeader title={t('changelog.title')} description={t('changelog.description')} />
        {log.isPending ? (
          <ChangelogSkeleton />
        ) : log.isError ? (
          <EmptyState mood="error" title={t('common.error')} description={log.error.message} action={<Button onClick={() => log.refetch()}>{t('common.retry')}</Button>} />
        ) : !releases.length ? (
          <EmptyState mood="sleepy" title={t('changelog.empty')} />
        ) : (
          <div className="relative">
            <span aria-hidden className="absolute bottom-0 left-1.5 top-2 w-px bg-border sm:left-[9.875rem]" />
            {releases.map((release) => (
              <ReleaseBlock key={release.key} release={release} />
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
