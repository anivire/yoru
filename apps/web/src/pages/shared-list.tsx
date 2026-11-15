import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { LIST_STATUSES } from '@yoru/shared'
import { EmptyState, Logo, Segmented, cn } from '@yoru/ui'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { AnimeCard, PosterGrid } from '../components/anime-cards'
import { useHeader } from '../components/app-shell'
import { Footer } from '../components/footer'
import { PosterGridSkeleton } from '../components/skeletons'
import { api } from '../lib/api'
import { useDocumentTitle } from '../lib/title'
import { AppearancePopover } from '../components/appearance-panel'
import { ListTable, ViewToggle, useListView } from '../components/list-table'
import { ListTableSkeleton } from '../components/skeletons'
import { ListFilterBar, useListParams } from '../components/list-filters'

const PAGE_SIZE = 48

export function SharedListPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const header = useHeader()
  const { status, filters, set } = useListParams()
  const [view, setView] = useListView()
  const query = useInfiniteQuery({
    queryKey: ['public-list', token, filters],
    queryFn: ({ pageParam }) => api.publicList(token, { ...filters, offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const { isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const first = query.data?.pages[0]
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  const sentinel = useRef<HTMLDivElement>(null)

  useDocumentTitle(first ? t('share.title', { name: first.username }) : null)

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header ref={header.ref} className="sticky top-0 z-40 pt-2">
        <div className="mx-auto max-w-(--page-max) px-4 sm:px-6">
          <div
            className={cn(
              'flex h-12 items-center -mx-2 rounded-full px-2 transition-[background-color,backdrop-filter] duration-300 sm:h-14 sm:-mx-4 sm:px-4',
              header.scrolled ? 'bg-background/55 backdrop-blur-2xl backdrop-saturate-150' : 'bg-transparent',
            )}
          >
            <Logo className="[&>span]:text-[0.9375rem] [&_svg]:size-6 sm:[&>span]:text-[17px] sm:[&_svg]:size-7" />
            <AppearancePopover className="ml-auto" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-(--page-max) flex-1 px-4 pb-8 pt-4 sm:px-6 sm:pt-8">
        {isError ? (
          <EmptyState mood="error" title={t('share.notFound')} description={t('share.notFoundHint')} />
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">{first ? t('share.title', { name: first.username }) : ' '}</h1>
              <p className="mt-1 text-[0.9375rem] text-muted-foreground">{t('share.hint')}</p>
            </div>
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
              <ListTable items={items} external />
            ) : (
              <PosterGrid>
                {items.map((e) => (
                  <AnimeCard
                    key={e.malId}
                    anime={e.anime}
                    progress={e.progress}
                    status={e.status}
                    rewatches={e.rewatches}
                    userScore={e.score}
                    coloredScore
                    href={`https://myanimelist.net/anime/${e.malId}`}
                  />
                ))}
              </PosterGrid>
            )}
            {hasNextPage ? (
              <div ref={sentinel} className="mt-6">
                {isFetchingNextPage ? view === 'table' ? <ListTableSkeleton rows={4} /> : <PosterGridSkeleton count={6} /> : <div className="h-px" />}
              </div>
            ) : null}
          </>
        )}
      </main>
      <Footer scope="public" />
    </div>
  )
}
