import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { EXPORT_FORMATS, LIST_STATUSES, type ListStatus } from '@yoru/shared'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Segmented } from '@yoru/ui'
import { RiDownload2Fill, RiFileDownloadFill } from '@remixicon/react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimeCard, PosterGrid } from '../components/anime-cards'
import { ListTableSkeleton, PosterGridSkeleton } from '../components/skeletons'
import { Page, PageHeader } from '../components/app-shell'
import { ShareListButton } from '../components/share-list'
import { api } from '../lib/api'
import { exportFormatName } from '../lib/format'
import { keys } from '../lib/queries'
import { TLink } from '../components/transition-link'
import { useDocumentTitle } from '../lib/title'
import { ListFilterBar, useListParams } from '../components/list-filters'
import { ListTable, ViewToggle, useListView } from '../components/list-table'

const PAGE_SIZE = 48

export function ListsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('lists.title'))
  const { status: rawStatus, filters, set } = useListParams()
  const status = rawStatus as ListStatus | 'all'
  const [view, setView] = useListView()
  const query = useInfiniteQuery({
    queryKey: keys.list(filters),
    queryFn: ({ pageParam }) => api.list({ ...filters, offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined),
    placeholderData: keepPreviousData,
  })
  const { isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const first = query.data?.pages[0]
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  const years = first?.facets.years ?? []
  const types = first?.facets.types ?? []
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

  return (
    <Page>
      <PageHeader
        title={t('lists.title')}
        actions={
          <>
            <ShareListButton />
            <Button asChild variant="secondary" size="sm">
              <TLink to="/settings/import">
                <RiDownload2Fill />
                {t('lists.import')}
              </TLink>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <RiFileDownloadFill />
                  {t('lists.export')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {EXPORT_FORMATS.map((f) => (
                  <DropdownMenuItem key={f} asChild>
                    <a href={api.exportUrl(f)} download>
                      {exportFormatName(f)}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Segmented
        className="[&_button]:h-9"
        value={status}
        onChange={(v) => set('status', v)}
        options={[
          { value: 'all', label: t('common.all'), count: first?.counts.all },
          ...LIST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), count: first?.counts.byStatus[s] })),
        ]}
      />

      <ListFilterBar filters={filters} set={set} years={years} types={types}>
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
        <ListTable items={items} />
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
            />
          ))}
        </PosterGrid>
      )}
      {hasNextPage ? (
        <div ref={sentinel} className="mt-6">
          {isFetchingNextPage ? view === 'table' ? <ListTableSkeleton rows={4} /> : <PosterGridSkeleton count={6} /> : <div className="h-px" />}
        </div>
      ) : null}
    </Page>
  )
}
