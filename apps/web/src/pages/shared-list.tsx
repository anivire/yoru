import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { LIST_STATUSES, type ListStatus } from '@yoru/shared'
import { EmptyState, Logo, Segmented, cn } from '@yoru/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { AnimeCard, PosterGrid } from '../components/anime-cards'
import { useHeader } from '../components/app-shell'
import { Footer } from '../components/footer'
import { PosterGridSkeleton } from '../components/skeletons'
import { api } from '../lib/api'

const PAGE_SIZE = 48

export function SharedListPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const header = useHeader()
  const [status, setStatus] = useState<'all' | ListStatus>('all')
  const query = useInfiniteQuery({
    queryKey: ['public-list', token, status],
    queryFn: ({ pageParam }) => api.publicList(token, { status: status === 'all' ? undefined : status, offset: pageParam, limit: PAGE_SIZE }),
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
    if (first) document.title = `${t('share.title', { name: first.username })} · yoru`
  }, [first, t])

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
              'flex h-12 items-center rounded-full pl-3.5 pr-1.5 transition-[background-color,backdrop-filter] duration-300 sm:h-14 sm:pl-4 sm:pr-2.5',
              header.scrolled ? 'bg-background/55 backdrop-blur-2xl backdrop-saturate-150' : 'bg-transparent',
            )}
          >
            <Logo className="[&>span]:text-[0.9375rem] [&_svg]:size-6 sm:[&>span]:text-[17px] sm:[&_svg]:size-7" />
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
              value={status}
              onChange={setStatus}
              className="mb-8"
              options={[
                { value: 'all', label: t('common.all'), count: first?.counts.all },
                ...LIST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), count: first?.counts.byStatus[s] })),
              ]}
            />
            {isPending ? (
              <PosterGridSkeleton />
            ) : !items.length ? (
              <EmptyState mood="sleepy" title={t('lists.empty')} />
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
                    href={`https://myanimelist.net/anime/${e.malId}`}
                  />
                ))}
              </PosterGrid>
            )}
            {hasNextPage ? (
              <div ref={sentinel} className="mt-6">
                {isFetchingNextPage ? <PosterGridSkeleton count={6} /> : <div className="h-px" />}
              </div>
            ) : null}
          </>
        )}
      </main>
      <Footer scope="public" />
    </div>
  )
}
