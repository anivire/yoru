import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { EXPORT_FORMATS, LIST_STATUSES, type ListEntryWithAnime, type ListStatus } from '@yoru/shared'
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Image, Input, Segmented, Select, cn } from '@yoru/ui'
import { RiCalendar2Fill, RiCloseFill, RiDownload2Fill, RiFileDownloadFill, RiLayoutGridFill, RiLayoutRowFill, RiRepeatFill, RiSearchFill, RiSortDesc, RiTvFill } from '@remixicon/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { AnimeCard, EpisodeCount, PosterGrid, Score } from '../components/anime-cards'
import { ListTableSkeleton, PosterGridSkeleton } from '../components/skeletons'
import { Page, PageHeader } from '../components/app-shell'
import { api } from '../lib/api'
import { formatDate, typeLabel } from '../lib/format'
import { keys } from '../lib/queries'

const ANY = '__any'
const SORTS = ['score', 'updated', 'title', 'progress', 'year', 'added'] as const
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
    <div className="overflow-hidden rounded-xl bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-inset text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('search.title')}</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">{t('search.status')}</th>
            <th className="px-4 py-2.5 font-medium">{t('lists.progress')}</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">{t('lists.score')}</th>
            <th className="hidden px-4 py-2.5 font-medium lg:table-cell">{t('lists.updated')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.malId} className="hover:bg-muted/60">
              <td className="px-4 py-2.5">
                <Link to={`/anime/${e.malId}`} className="flex items-center gap-3">
                  {e.anime.imageUrl ? <Image src={e.anime.imageUrl} alt="" loading="lazy" className="h-12 w-8 shrink-0 rounded object-cover" /> : null}
                  <div className="min-w-0">
                    <div className="truncate font-medium hover:text-accent">{e.anime.title}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {[typeLabel(e.anime.type), e.anime.year].filter(Boolean).join(' · ')}
                      {e.rewatches ? (
                        <span className="inline-flex items-center gap-0.5" title={t('anime.rewatches')}>
                          · <RiRepeatFill className="size-3" />
                          {e.rewatches}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </td>
              <td className="hidden px-4 py-2.5 md:table-cell">
                <Badge size="sm" variant={STATUS_TONE[e.status]}>
                  {t(`status.${e.status}`)}
                </Badge>
              </td>
              <td className="px-4 py-2.5 font-mono text-[0.8125rem]">
                <EpisodeCount current={e.progress} total={e.anime.episodes} />
              </td>
              <td className="hidden px-4 py-2.5 sm:table-cell">
                {e.score ? (
                  <Score value={e.score} className="h-5 px-1.5 text-[0.75rem]" />
                ) : (
                  <span className="text-subtle-foreground">{t('anime.noScore')}</span>
                )}
              </td>
              <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">{formatDate(e.updatedAt)}</td>
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
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'grid' | 'table'>(() => (localStorage.getItem('yoru:list-view') === 'table' ? 'table' : 'grid'))
  const [resetKey, setResetKey] = useState(0)
  const status = (params.get('status') as ListStatus | null) ?? 'all'
  const filters = {
    status: status === 'all' ? undefined : status,
    q: params.get('q') ?? undefined,
    type: params.get('type') ?? undefined,
    year: params.get('year') ?? undefined,
    sort: params.get('sort') ?? 'score',
  }
  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (!value || value === ANY || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
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
            <Button asChild variant="secondary" size="sm">
              <Link to="/settings/import">
                <RiDownload2Fill />
                {t('lists.import')}
              </Link>
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
                      {f === 'mal-xml' ? 'MAL XML' : f.toUpperCase()}
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

      <div className="relative mt-4">
        <RiSearchFill className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
        <Input key={resetKey} defaultValue={filters.q} onChange={(e) => set('q', e.target.value)} placeholder={t('lists.filter')} className="h-11 rounded-xl pl-10 text-[0.9375rem]" />
        {filters.q ? (
          <button
            type="button"
            onClick={() => {
              set('q', undefined)
              setResetKey((k) => k + 1)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-subtle-foreground hover:text-foreground"
          >
            <RiCloseFill className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="mb-8 mt-3 flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          className="w-40"
          icon={<RiTvFill />}
          value={filters.type ?? ANY}
          onValueChange={(v) => set('type', v)}
          options={[{ value: ANY, label: `${t('search.type')}: ${t('common.any')}` }, ...types.map((v) => ({ value: v, label: typeLabel(v) }))]}
        />
        <Select
          size="sm"
          className="w-36"
          icon={<RiCalendar2Fill />}
          value={filters.year ?? ANY}
          onValueChange={(v) => set('year', v)}
          options={[{ value: ANY, label: `${t('lists.year')}: ${t('common.any')}` }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
        />
        <Select
          size="sm"
          className="w-64"
          icon={<RiSortDesc />}
          value={filters.sort}
          onValueChange={(v) => set('sort', v === 'score' ? undefined : v)}
          options={SORTS.map((s) => ({ value: s, label: `${t('lists.sortBy')}: ${t(`order.${s}`).toLowerCase()}` }))}
        />
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
      </div>

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
