import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { EXPORT_FORMATS, LIST_STATUSES, type ListEntryWithAnime, type ListStatus } from '@yoru/shared'
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Image, Input, Segmented, Select, cn } from '@yoru/ui'
import { Download, FileDown, LayoutGrid, Repeat, Rows3, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { AnimeCard, PosterGrid } from '../components/anime-cards'
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
                          · <Repeat className="size-3" />
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
              <td className="px-4 py-2.5 font-mono text-[13px]">
                {e.progress}/{e.anime.episodes ?? '?'}
              </td>
              <td className="hidden px-4 py-2.5 sm:table-cell">
                {e.score ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[13px]">
                    <Star className="size-3 fill-warning text-warning" />
                    {e.score}
                  </span>
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

export function ListsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'grid' | 'table'>(() => (localStorage.getItem('yoru:list-view') === 'table' ? 'table' : 'grid'))
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
  const { data, isPending } = useQuery({ queryKey: keys.list(filters), queryFn: () => api.list(filters), placeholderData: keepPreviousData })
  const all = useQuery({ queryKey: keys.list({}), queryFn: () => api.list({}) })
  const years = useMemo(
    () => [...new Set((all.data?.items ?? []).map((e) => e.anime.year).filter((y): y is number => Boolean(y)))].sort((a, b) => b - a),
    [all.data],
  )
  const types = useMemo(() => [...new Set((all.data?.items ?? []).map((e) => e.anime.type).filter((v): v is string => Boolean(v)))], [all.data])

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
                <Download />
                {t('lists.import')}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <FileDown />
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
          { value: 'all', label: t('common.all'), count: data?.counts.all },
          ...LIST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), count: data?.counts.byStatus[s] })),
        ]}
      />

      <div className="mb-6 mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input defaultValue={filters.q} onChange={(e) => set('q', e.target.value)} placeholder={t('lists.filter')} className="h-8 pl-9 text-[13px]" />
        </div>
        <Select
          size="sm"
          className="w-36"
          value={filters.type ?? ANY}
          onValueChange={(v) => set('type', v)}
          options={[{ value: ANY, label: `${t('search.type')}: ${t('common.any')}` }, ...types.map((v) => ({ value: v, label: typeLabel(v) }))]}
        />
        <Select
          size="sm"
          className="w-32"
          value={filters.year ?? ANY}
          onValueChange={(v) => set('year', v)}
          options={[{ value: ANY, label: `${t('lists.year')}: ${t('common.any')}` }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
        />
        <Select
          size="sm"
          className="w-52"
          value={filters.sort}
          onValueChange={(v) => set('sort', v === 'score' ? undefined : v)}
          options={SORTS.map((s) => ({ value: s, label: t(`order.${s}`) }))}
        />
        <div className="flex rounded-lg bg-inset p-0.5">
          {(['grid', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-label={t(`lists.${v}`)}
              onClick={() => switchView(v)}
              className={cn('cursor-pointer rounded-md p-1.5', view === v ? 'bg-raised text-foreground shadow-sm shadow-black/20' : 'text-muted-foreground')}
            >
              {v === 'grid' ? <LayoutGrid className="size-4" /> : <Rows3 className="size-4" />}
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
      ) : !data?.items.length ? (
        <EmptyState mood="sleepy" title={t('lists.empty')} />
      ) : view === 'table' ? (
        <ListTable items={data.items} />
      ) : (
        <PosterGrid>
          {data.items.map((e) => (
            <AnimeCard
              key={e.malId}
              anime={e.anime}
              progress={e.progress}
              status={status === 'all' ? e.status : undefined}
              rewatches={e.rewatches}
              newEpisodes={(e.status === 'watching' || e.status === 'rewatching') && e.latestEpisode && e.latestEpisode > e.progress ? e.latestEpisode - e.progress : undefined}
            />
          ))}
        </PosterGrid>
      )}
    </Page>
  )
}
