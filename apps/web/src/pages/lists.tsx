import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { EXPORT_FORMATS, LIST_STATUSES, type ListEntryWithAnime, type ListStatus } from '@yoru/shared'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Image, Progress, Segmented, StatusDot, cn } from '@yoru/ui'
import { RiDownload2Fill, RiFileDownloadFill, RiLayoutGridFill, RiLayoutRowFill, RiRepeatFill, RiStarFill } from '@remixicon/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimeCard, EpisodeCount, PosterGrid, scoreColor } from '../components/anime-cards'
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

const TABLE_COLS =
  'grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_5.5rem] @md:grid-cols-[minmax(0,1fr)_6rem_3.5rem] @2xl:grid-cols-[minmax(0,1fr)_8.5rem_6.5rem_3.5rem] @4xl:grid-cols-[minmax(0,1fr)_8.5rem_7rem_3.5rem_7.5rem]'

function ListTable({ items }: { items: ListEntryWithAnime[] }) {
  const { t } = useTranslation()
  return (
    <div className="@container rounded-2xl bg-surface p-1.5">
      <div className={cn(TABLE_COLS, 'px-3 pb-1.5 pt-2 text-xs font-medium text-subtle-foreground')}>
        <span>{t('lists.name')}</span>
        <span className="hidden @2xl:block">{t('search.status')}</span>
        <span>{t('lists.progress')}</span>
        <span className="hidden @md:block">{t('lists.score')}</span>
        <span className="hidden text-right @4xl:block">{t('lists.updated')}</span>
      </div>
      <div className="flex flex-col">
        {items.map((e) => (
          <TLink key={e.malId} to={`/anime/${e.malId}`} className={cn(TABLE_COLS, 'group rounded-xl px-3 py-2 transition-colors hover:bg-field-hover')}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {e.anime.imageUrl ? <Image src={e.anime.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium transition-colors group-hover:text-accent">{e.anime.title}</div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                  {[typeLabel(e.anime.type), e.anime.year].filter(Boolean).join(' · ')}
                  {e.rewatches ? (
                    <span className="inline-flex items-center gap-0.5" title={t('anime.rewatches')}>
                      · <RiRepeatFill className="size-3" />
                      {e.rewatches}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <span className="hidden min-w-0 items-center gap-2 text-[0.8125rem] text-muted-foreground @2xl:flex">
              <StatusDot tone={STATUS_TONE[e.status]} />
              <span className="truncate">{t(`status.${e.status}`)}</span>
            </span>
            <div className="flex flex-col gap-1.5">
              <EpisodeCount current={e.progress} total={e.anime.episodes} className="text-[0.8125rem] font-medium" />
              {e.anime.episodes ? <Progress value={e.progress / e.anime.episodes} tone={e.progress >= e.anime.episodes ? 'foreground' : 'accent'} className="h-0.5 bg-field" /> : null}
            </div>
            <span className="hidden @md:block">
              {e.score ? (
                <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold tabular-nums">
                  <RiStarFill className="size-3.5" style={{ color: scoreColor(e.score) }} />
                  {e.score}
                </span>
              ) : (
                <span className="text-[0.8125rem] text-subtle-foreground">{t('anime.noScore')}</span>
              )}
            </span>
            <span className="hidden text-right text-xs text-muted-foreground @4xl:block" title={formatDate(e.updatedAt, { dateStyle: 'long', timeStyle: 'short' })}>
              {formatDate(e.updatedAt)}
            </span>
          </TLink>
        ))}
      </div>
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
