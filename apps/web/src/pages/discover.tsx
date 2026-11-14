import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnimeSummary } from '@yoru/shared'
import { Button, EmptyState, Image, Skeleton, cn } from '@yoru/ui'
import { Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AnimeCard, Rail, Score } from '../components/anime-cards'
import { Page, Section } from '../components/app-shell'
import { AnimeCardSkeleton, PosterRailSkeleton, SectionTitleSkeleton, TextLine } from '../components/skeletons'
import { api } from '../lib/api'
import { relativeTime, seasonLabel, typeLabel } from '../lib/format'
import { keys } from '../lib/queries'

const SLIDE_MS = 8000

function useBanner(malId: number | undefined) {
  return useQuery({ queryKey: ['banner', malId], queryFn: () => api.banner(malId!), enabled: Boolean(malId), staleTime: Infinity })
}

function Hero({ items }: { items: AnimeSummary[] }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const current = items[index]!
  const details = useQuery({ queryKey: keys.anime(current.malId), queryFn: () => api.anime(current.malId), staleTime: 10 * 60_000 })
  const banner = useBanner(current.malId)
  const anime = details.data?.anime ?? current
  const synopsis = details.data?.anime.synopsis
  const background = banner.data?.url ?? anime.imageUrl

  useEffect(() => {
    if (paused || items.length < 2) return
    const id = setTimeout(() => setIndex((i) => (i + 1) % items.length), SLIDE_MS)
    return () => clearTimeout(id)
  }, [index, paused, items.length])

  useEffect(() => {
    const next = items[(index + 1) % items.length]
    if (!next) return
    void client.prefetchQuery({ queryKey: ['banner', next.malId], queryFn: () => api.banner(next.malId), staleTime: Infinity })
    void client.prefetchQuery({ queryKey: keys.anime(next.malId), queryFn: () => api.anime(next.malId), staleTime: 10 * 60_000 })
  }, [index, items, client])

  const meta = [typeLabel(anime.type), anime.episodes ? `${anime.episodes} ${t('common.episodes')}` : null, seasonLabel(anime)].filter(Boolean)

  return (
    <div
      className="relative isolate -mt-(--header-h) overflow-hidden pt-(--header-h)"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 -z-10">
        {background ? (
          <img key={background} src={background} alt="" className={cn('h-full w-full animate-fade object-cover', !banner.data?.url && 'scale-110 object-[50%_25%] blur-xl')} />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 wide:max-w-none sm:px-6">
        <div className="mb-6 flex gap-1.5">
          {items.map((item, i) => (
            <button
              key={item.malId}
              type="button"
              aria-label={item.title}
              onClick={() => setIndex(i)}
              className={cn('h-1 cursor-pointer rounded-full transition-all duration-300', i === index ? 'w-8 bg-foreground' : 'w-4 bg-foreground/25 hover:bg-foreground/50')}
            />
          ))}
        </div>
        <div key={current.malId} className="flex animate-fade items-end gap-6">
          <Link to={`/anime/${anime.malId}`} className="hidden shrink-0 sm:block">
            <div className="aspect-[2/3] w-44 overflow-hidden rounded-xl bg-muted shadow-2xl">
              {anime.imageUrl ? <Image src={anime.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
          </Link>
          <div className="flex min-w-0 max-w-2xl flex-col gap-3">
            <h1 className="line-clamp-2 text-3xl font-semibold tracking-tight sm:text-4xl">{anime.title}</h1>
            {anime.genres.length ? (
              <div className="flex flex-wrap gap-1.5">
                {anime.genres.slice(0, 4).map((g) => (
                  <span key={g} className="inline-flex h-6 items-center rounded-full bg-foreground/10 px-2.5 text-xs font-medium text-foreground/90">
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {anime.score ? <Score value={anime.score} /> : null}
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            {synopsis ? <p className="line-clamp-3 text-[15px] leading-relaxed text-foreground/80">{synopsis}</p> : details.isPending ? (
              <div className="text-[15px] leading-relaxed">
                <TextLine />
                <TextLine />
                <TextLine bar="w-2/3" />
              </div>
            ) : null}
            <div className="mt-1">
              <Button asChild variant="accent" size="lg">
                <Link to={`/anime/${anime.malId}`}>
                  <Play className="fill-current" />
                  {t('discover.open')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 wide:max-w-none sm:px-6">
      <div className="mb-6 flex gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className={cn('h-1 rounded-full', i === 0 ? 'w-8' : 'w-4')} />
        ))}
      </div>
      <div className="flex items-end gap-6">
        <Skeleton className="hidden aspect-[2/3] w-44 shrink-0 rounded-xl sm:block" />
        <div className="flex w-full max-w-2xl flex-col gap-3">
          <Skeleton className="h-10 w-3/4" />
          <div className="flex gap-1.5">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-1/3" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="mt-1 h-11 w-36 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function Trending() {
  const { t } = useTranslation()
  const [genre, setGenre] = useState<number | null>(null)
  const genres = useQuery({ queryKey: ['discover', 'genres'], queryFn: api.discoverGenres, staleTime: Infinity })
  const items = useQuery({ queryKey: ['discover', 'trending', genre], queryFn: () => api.trending(genre), staleTime: 10 * 60_000 })
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full px-3 text-[13px] font-medium transition-colors',
      active ? 'bg-accent text-accent-foreground' : 'bg-field text-muted-foreground hover:bg-field-hover hover:text-foreground',
    )
  return (
    <Section title={t('discover.trending')}>
      <div className="mb-4 flex gap-1.5 overflow-x-auto scrollbar-none">
        <button type="button" onClick={() => setGenre(null)} className={chip(genre === null)}>
          {t('discover.all')}
        </button>
        {genres.isPending
          ? Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-full" />)
          : null}
        {(genres.data ?? []).map((g) => (
          <button key={g.id} type="button" onClick={() => setGenre(g.id)} className={chip(genre === g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <Rail size="poster">
        {items.isPending ? Array.from({ length: 8 }, (_, i) => <AnimeCardSkeleton key={i} />) : (items.data ?? []).map((a) => <AnimeCard key={a.malId} anime={a} />)}
      </Rail>
    </Section>
  )
}

function CollectionSection({ name, title }: { name: 'top' | 'anons'; title: string }) {
  const { data, isPending } = useQuery({ queryKey: ['discover', name], queryFn: () => api.discoverCollection(name), staleTime: 10 * 60_000 })
  if (isPending) {
    return (
      <section className="mt-10">
        <SectionTitleSkeleton />
        <PosterRailSkeleton />
      </section>
    )
  }
  if (!data?.length) return null
  return (
    <Section title={title}>
      <Rail size="poster">
        {data.map((a) => (
          <AnimeCard key={a.malId} anime={a} />
        ))}
      </Rail>
    </Section>
  )
}

function RecentSection() {
  const { t } = useTranslation()
  const { data, isPending } = useQuery({ queryKey: ['discover', 'recent'], queryFn: api.discoverRecent, staleTime: 5 * 60_000 })
  if (isPending) {
    return (
      <section className="mt-10">
        <SectionTitleSkeleton />
        <PosterRailSkeleton />
      </section>
    )
  }
  if (!data?.length) return null
  return (
    <Section title={t('discover.recent')}>
      <Rail size="poster">
        {data.map((r) => (
          <AnimeCard
            key={r.anime.malId}
            anime={r.anime}
            badge={
              <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-accent px-2 text-[11px] font-semibold text-accent-foreground">
                {t('common.episode')} {r.episode}
              </span>
            }
            subtitle={relativeTime(r.at)}
          />
        ))}
      </Rail>
    </Section>
  )
}

export function DiscoverPage() {
  const { t } = useTranslation()
  const hero = useQuery({ queryKey: ['discover', 'hero'], queryFn: () => api.discoverCollection('hero'), staleTime: 10 * 60_000 })

  return (
    <>
      {hero.data?.length ? <Hero items={hero.data} /> : hero.isPending ? <HeroSkeleton /> : null}
      <Page>
        {hero.isError ? <EmptyState mood="error" title={t('discover.empty')} /> : null}
        <Trending />
        <RecentSection />
        <CollectionSection name="top" title={t('discover.top')} />
        <CollectionSection name="anons" title={t('discover.anons')} />
      </Page>
    </>
  )
}
