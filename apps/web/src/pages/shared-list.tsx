import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { LIST_STATUSES, type ListResponse, type ShareKind } from '@yoru/shared'
import { RiBarChart2Fill, RiBookShelfFill } from '@remixicon/react'
import { EmptyState, Segmented } from '@yoru/ui'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router'
import { AnimeCard, PosterGrid } from '../components/anime-cards'
import { PublicShell } from '../components/public-shell'
import { PosterGridSkeleton } from '../components/skeletons'
import { api } from '../lib/api'
import { useDocumentTitle } from '../lib/title'
import { ListTable, ViewToggle, useListView } from '../components/list-table'
import { ListTableSkeleton } from '../components/skeletons'
import { ListFilterBar, useListParams } from '../components/list-filters'
import { StatsSkeleton, StatsView } from './stats'

const PAGE_SIZE = 48

export function ListBrowser({ queryKey, fetchPage, external = false }: { queryKey: readonly unknown[]; fetchPage: (params: Record<string, string | number | undefined>) => Promise<ListResponse>; external?: boolean }) {
  const { t } = useTranslation()
  const { status, filters, set } = useListParams()
  const [view, setView] = useListView()
  const query = useInfiniteQuery({
    queryKey: [...queryKey, filters],
    queryFn: ({ pageParam }) => fetchPage({ ...filters, offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const { isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const first = query.data?.pages[0]
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '800px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length])

  if (isError) return <EmptyState mood="error" title={t('share.notFound')} description={t('share.notFoundHint')} />
  return (
    <div className="grow-empty">
      <Segmented
        className="[&_button]:h-9"
        value={status}
        onChange={(v) => set('status', v)}
        options={[
          { value: 'all', label: t('common.all'), count: first?.counts.all },
          ...LIST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), count: first?.counts.byStatus[s] })),
        ]}
      />
      <ListFilterBar filters={filters} set={set} years={first?.facets.years ?? []} types={first?.facets.types ?? []}>
        <ViewToggle view={view} onChange={setView} />
      </ListFilterBar>
      {isPending ? (
        view === 'table' ? (
          <ListTableSkeleton />
        ) : (
          <PosterGridSkeleton />
        )
      ) : !items.length ? (
        <EmptyState mood="sleepy" title={t('lists.empty')} />
      ) : view === 'table' ? (
        <ListTable items={items} external={external} />
      ) : (
        <PosterGrid fullRows={hasNextPage}>
          {items.map((e) => (
            <AnimeCard
              key={e.malId}
              anime={e.anime}
              progress={e.progress}
              status={e.status}
              rewatches={e.rewatches}
              userScore={e.score}
              coloredScore
              href={external ? `https://myanimelist.net/anime/${e.malId}` : undefined}
            />
          ))}
        </PosterGrid>
      )}
      {hasNextPage ? (
        <div ref={sentinel} className="mt-6">
          {isFetchingNextPage ? view === 'table' ? <ListTableSkeleton rows={4} /> : <PosterGridSkeleton count={6} /> : <div className="h-px" />}
        </div>
      ) : null}
    </div>
  )
}

function SharedStats({ token }: { token: string }) {
  const { t } = useTranslation()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const stats = useQuery({ queryKey: ['public-stats', token], queryFn: () => api.publicStats(token, tz), retry: false })
  if (stats.isError) return <EmptyState mood="error" title={t('share.notFound')} description={t('share.notFoundHint')} />
  if (stats.isPending) return <StatsSkeleton />
  return stats.data.totals.titles ? <StatsView stats={stats.data} /> : <EmptyState mood="sleepy" title={t('stats.empty')} />
}

export function SharedListPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const share = useQuery({ queryKey: ['public-share', token], queryFn: () => api.publicShare(token), retry: false })
  const info = share.data
  const requested = params.get('tab') === 'stats' ? 'stats' : 'list'
  const tab: ShareKind = info && !info[requested] ? (info.list ? 'list' : 'stats') : requested
  const title = info ? t(tab === 'stats' ? 'stats.shared.title' : 'share.title', { name: info.username }) : null
  useDocumentTitle(title)
  const setTab = (next: ShareKind) => {
    const updated = new URLSearchParams(next === 'stats' ? { tab: 'stats' } : {})
    setParams(updated, { replace: true })
  }

  return (
    <PublicShell>
      {share.isError ? (
        <EmptyState mood="error" title={t('share.notFound')} description={t('share.notFoundHint')} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title ?? '\u00a0'}</h1>
              <p className="mt-1 text-[0.9375rem] text-muted-foreground">{t(tab === 'stats' ? 'stats.shared.hint' : 'share.hint')}</p>
            </div>
            {info ? (
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'list', label: t('share.tabs.list'), icon: <RiBookShelfFill />, disabled: !info.list, title: info.list ? undefined : t('share.tabs.hidden') },
                  { value: 'stats', label: t('share.tabs.stats'), icon: <RiBarChart2Fill />, disabled: !info.stats, title: info.stats ? undefined : t('share.tabs.hidden') },
                ]}
              />
            ) : null}
          </div>
          {!info ? <PosterGridSkeleton /> : tab === 'stats' ? <SharedStats token={token} /> : <ListBrowser queryKey={['public-list', token]} fetchPage={(params) => api.publicList(token, params)} external />}
        </>
      )}
    </PublicShell>
  )
}
