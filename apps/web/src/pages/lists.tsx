import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { EXPORT_FORMATS, LIST_STATUSES, type ListEntryWithAnime, type ListStatus } from '@yoru/shared'
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Image, Segmented, cn } from '@yoru/ui'
import { RiDownload2Fill, RiFileDownloadFill, RiLayoutGridFill, RiLayoutRowFill, RiRepeatFill } from '@remixicon/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimeCard, EpisodeCount, PosterGrid, Score } from '../components/anime-cards'
import { ListTableSkeleton, PosterGridSkeleton } from '../components/skeletons'
import { Page, PageHeader } from '../components/app-shell'
import { ShareListButton } from '../components/share-list'
import { api } from '../lib/api'
import { exportFormatName, formatDate, typeLabel } from '../lib/format'
import { keys } from '../lib/queries'
import { TLink } from '../components/transition-link'
import { useDocumentTitle } from '../lib/title'
import { ListFilterBar, useListParams } from '../components/list-filters'

const STATUS_TONE: Record<ListStatus, 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  watching: 'accent',
  rewatching: 'accent',
  planning: 'info',
  completed: 'success',
  paused: 'warning',
  dropped: 'danger',
}

function ListTable({ items }: { items: ListEntryWithAnime[] }) {
  const { t } = useTranslation()
  return (
    <div className="@container overflow-hidden rounded-xl bg-surface">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-inset text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('lists.name')}</th>
            <th className="hidden w-36 px-4 py-2.5 font-medium @2xl:table-cell">{t('search.status')}</th>
            <th className="w-24 px-4 py-2.5 font-medium">{t('lists.progress')}</th>
            <th className="hidden w-24 px-4 py-2.5 font-medium @md:table-cell">{t('lists.score')}</th>
            <th className="hidden w-40 px-4 py-2.5 font-medium @4xl:table-cell">{t('lists.updated')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.malId} className="even:bg-field/60 hover:bg-muted">
              <td className="px-4 py-2.5">
                <TLink to={`/anime/${e.malId}`} className="flex min-w-0 items-center gap-3">
                  {e.anime.imageUrl ? <Image src={e.anime.imageUrl} alt="" loading="lazy" className="h-12 w-8 shrink-0 rounded object-cover" /> : null}
                  <div className="min-w-0">
                    <div className="truncate font-medium hover:text-accent">{e.anime.title}</div>
                    <div className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                      {[typeLabel(e.anime.type), e.anime.year].filter(Boolean).join(' · ')}
                      {e.rewatches ? (
                        <span className="inline-flex items-center gap-0.5" title={t('anime.rewatches')}>
                          · <RiRepeatFill className="size-3" />
                          {e.rewatches}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </TLink>
              </td>
              <td className="hidden px-4 py-2.5 @2xl:table-cell">
                <Badge size="sm" variant={STATUS_TONE[e.status]}>
                  {t(`status.${e.status}`)}
                </Badge>
              </td>
              <td className="px-4 py-2.5 font-mono text-[0.8125rem]">
                <EpisodeCount current={e.progress} total={e.anime.episodes} />
              </td>
              <td className="hidden px-4 py-2.5 @md:table-cell">
                {e.score ? (
                  <Score value={e.score} colored className="h-5 px-1.5 text-[0.75rem] shadow-none" />
                ) : (
                  <span className="text-subtle-foreground">{t('anime.noScore')}</span>
                )}
              </td>
              <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground @4xl:table-cell">{formatDate(e.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PAGE_SIZE = 48

export function ListsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('lists.title'))
  const { status: rawStatus, filters, set } = useListParams()
  const status = rawStatus as ListStatus | 'all'
  const [view, setView] = useState<'grid' | 'table'>(() => (localStorage.getItem('yoru:list-view') === 'table' ? 'table' : 'grid'))
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

  const switchView = (v: 'grid' | 'table') => {
    setView(v)
    localStorage.setItem('yoru:list-view', v)
  }

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
        value={status}
        onChange={(v) => set('status', v)}
        options={[
          { value: 'all', label: t('common.all'), count: first?.counts.all },
          ...LIST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), count: first?.counts.byStatus[s] })),
        ]}
      />

      <ListFilterBar filters={filters} set={set} years={years} types={types}>
        <div className="ml-auto flex rounded-lg bg-inset p-0.5">
          {(['grid', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-label={t(`lists.${v}`)}
              onClick={() => switchView(v)}
              className={cn('cursor-pointer rounded-md p-1.5', view === v ? 'bg-raised text-foreground shadow-sm shadow-black/20' : 'text-muted-foreground')}
            >
              {v === 'grid' ? <RiLayoutGridFill className="size-4" /> : <RiLayoutRowFill className="size-4" />}
            </button>
          ))}
        </div>
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
        <PosterGrid>
          {items.map((e) => (
            <AnimeCard
              key={e.malId}
              anime={e.anime}
              progress={e.progress}
              status={status === 'all' ? e.status : undefined}
              rewatches={e.rewatches}
              userScore={e.score}
              coloredScore
              newEpisodes={(e.status === 'watching' || e.status === 'rewatching') && e.latestEpisode && e.latestEpisode > e.progress ? e.latestEpisode - e.progress : undefined}
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
