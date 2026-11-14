import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ANIME_TYPES } from '@yoru/shared'
import { Button, EmptyState, Input, Select, cn } from '@yoru/ui'
import { RiCloseFill, RiSearchFill as SearchIcon } from '@remixicon/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AnimeCard, PosterGrid } from '../components/anime-cards'
import { PosterGridSkeleton } from '../components/skeletons'
import { Page, PageHeader } from '../components/app-shell'
import { api } from '../lib/api'

const ANY = '__any'
const ORDERS = ['popularity', 'score', 'start_date', 'title', 'members'] as const
const STATUSES = ['airing', 'complete', 'upcoming'] as const
const TAG_LIMIT = 16

export function SearchPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const filters = {
    type: params.get('type') ?? undefined,
    status: params.get('status') ?? undefined,
    genres: params.get('genres') ?? undefined,
    order_by: params.get('order_by') ?? undefined,
  }

  useEffect(() => setInput(q), [q])
  useEffect(() => {
    const id = setTimeout(() => {
      if (input.trim() === q) return
      const next = new URLSearchParams(params)
      if (input.trim()) next.set('q', input.trim())
      else next.delete('q')
      setParams(next, { replace: true })
    }, 400)
    return () => clearTimeout(id)
  }, [input])

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === ANY) next.delete(key)
    else next.set(key, value)
    if (key === 'order_by' && value !== ANY) next.set('sort', value === 'title' ? 'asc' : 'desc')
    if (key === 'order_by' && value === ANY) next.delete('sort')
    setParams(next, { replace: true })
  }

  const genres = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: Infinity })
  const results = useInfiniteQuery({
    queryKey: ['search', q, filters, params.get('sort')],
    queryFn: ({ pageParam }) => api.search({ q, ...filters, sort: params.get('sort') ?? undefined, page: pageParam }),
    staleTime: 5 * 60_000,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasNextPage ? last.pagination.page + 1 : undefined),
  })

  const items = [...new Map((results.data?.pages.flatMap((p) => p.items) ?? []).map((a) => [a.malId, a])).values()]
  const filtered = Object.values(filters).some(Boolean)
  const basic = results.data?.pages[0]?.source === 'anime365'
  const [allTags, setAllTags] = useState(false)
  const selectedGenres = (filters.genres ?? '').split(',').filter(Boolean)
  const tags = genres.data ?? []
  const visibleTags = allTags ? tags : tags.filter((g, i) => i < TAG_LIMIT || selectedGenres.includes(String(g.id)))
  const toggleGenre = (id: string) => {
    const next = new Set(selectedGenres)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFilter('genres', next.size ? [...next].join(',') : ANY)
  }

  return (
    <Page>
      <PageHeader title={t('search.title')} />
      <div className="mb-8 flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('search.placeholder')} className="h-11 rounded-xl pl-10 text-[15px]" autoFocus />
          {input ? (
            <button type="button" onClick={() => setInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-subtle-foreground hover:text-foreground">
              <RiCloseFill className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            size="sm"
            className="w-36"
            value={filters.type ?? ANY}
            onValueChange={(v) => setFilter('type', v)}
            options={[{ value: ANY, label: `${t('search.type')}: ${t('common.any')}` }, ...ANIME_TYPES.slice(0, 6).map((v) => ({ value: v, label: t(`type.${v}`) }))]}
          />
          <Select
            size="sm"
            className="w-40"
            value={filters.status ?? ANY}
            onValueChange={(v) => setFilter('status', v)}
            options={[{ value: ANY, label: `${t('search.status')}: ${t('common.any')}` }, ...STATUSES.filter((v) => !basic || v !== 'upcoming').map((v) => ({ value: v, label: t(`airing.${v}`) }))]}
          />
          {basic ? null : (
            <Select
              size="sm"
              className="w-48"
              value={filters.order_by ?? ANY}
              onValueChange={(v) => setFilter('order_by', v)}
              options={[{ value: ANY, label: `${t('search.order')}: ${t('common.any')}` }, ...ORDERS.map((v) => ({ value: v, label: t(`order.${v}`) }))]}
            />
          )}
          {filtered ? (
            <Button variant="ghost" size="sm" onClick={() => setParams(q ? { q } : {}, { replace: true })}>
              <RiCloseFill />
              {t('common.all')}
            </Button>
          ) : null}
        </div>
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map((g) => {
              const active = selectedGenres.includes(String(g.id))
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleGenre(String(g.id))}
                  className={cn(
                    'inline-flex h-7 cursor-pointer items-center rounded-full px-3 text-[13px] font-medium transition-colors',
                    active ? 'bg-accent text-accent-foreground' : 'bg-field text-muted-foreground hover:bg-field-hover hover:text-foreground',
                  )}
                >
                  {g.name}
                </button>
              )
            })}
            {tags.length > TAG_LIMIT ? (
              <button type="button" onClick={() => setAllTags(!allTags)} className="inline-flex h-7 cursor-pointer items-center px-2 text-[13px] font-medium text-subtle-foreground hover:text-foreground">
                {allTags ? t('search.lessTags') : t('search.moreTags', { count: tags.length - TAG_LIMIT })}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <h2 className="mb-4 text-xl font-semibold tracking-tight">{q || filtered ? t('search.results') : t('search.seasonNow')}</h2>

      {results.isPending ? (
        <PosterGridSkeleton />
      ) : results.isError ? (
        <EmptyState mood="error" title={t('common.error')} description={results.error.message} action={<Button onClick={() => results.refetch()}>{t('common.retry')}</Button>} />
      ) : !items.length ? (
        <EmptyState mood="thinking" title={t('search.nothing')} description={t('search.nothingHint')} />
      ) : (
        <>
          <PosterGrid>
            {items.map((a) => (
              <AnimeCard key={a.malId} anime={a} />
            ))}
          </PosterGrid>
          {results.hasNextPage ? (
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" loading={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>
                {t('search.more')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Page>
  )
}
