import type { AnimeSummary, ContinueItem, ListStatus, UpcomingItem } from '@yoru/shared'
import { Badge, Progress, Skeleton, cn } from '@yoru/ui'
import { Play, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatDateTime, formatTime, relativeTime, seasonLabel, typeLabel } from '../lib/format'
import { useAppearance } from '../lib/appearance'

export function Poster({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-muted', className)}>
      {src ? <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : null}
    </div>
  )
}

export function AnimeCard({
  anime,
  progress,
  status,
  newEpisodes,
}: {
  anime: AnimeSummary
  progress?: number
  status?: ListStatus
  newEpisodes?: number
}) {
  const { t } = useTranslation()
  const total = anime.episodes
  return (
    <Link to={`/anime/${anime.malId}`} className="group flex flex-col gap-2">
      <div className="relative">
        <Poster
          src={anime.imageUrl}
          alt={anime.title}
          className="aspect-[2/3] w-full transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl"
        />
        {progress !== undefined && total ? (
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-xl bg-black/30">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, (progress / total) * 100)}%` }} />
          </div>
        ) : null}
        <div className="absolute left-2 top-2.5 flex flex-wrap gap-1">
          {newEpisodes ? (
            <Badge size="sm" variant="solid" className="bg-accent text-accent-foreground">
              {t('home.newEpisodes', { count: newEpisodes })}
            </Badge>
          ) : null}
          {anime.airing ? (
            <Badge size="sm" variant="solid" className="bg-black/60 text-white backdrop-blur">
              {t('airing.airing')}
            </Badge>
          ) : null}
        </div>
        {anime.score ? (
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">
            <Star className="size-3 fill-current" />
            {anime.score.toFixed(1)}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 px-0.5">
        <div className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-accent">{anime.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {progress !== undefined ? (
            <span className="font-mono">
              {progress}/{total ?? '?'}
            </span>
          ) : (
            <span>{[typeLabel(anime.type), seasonLabel(anime)].filter(Boolean).join(' · ')}</span>
          )}
          {status ? <span className="truncate">· {t(`status.${status}`)}</span> : null}
        </div>
      </div>
    </Link>
  )
}

export function PosterGrid({ children, className }: { children: ReactNode; className?: string }) {
  const { stretch } = useAppearance()
  return (
    <div
      className={cn(
        'grid gap-x-4 gap-y-6',
        stretch ? 'grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <PosterGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </PosterGrid>
  )
}

export function ContinueCard({ item }: { item: ContinueItem }) {
  const { t } = useTranslation()
  const image = item.episodeImageUrl ?? item.anime.imageUrl
  return (
    <Link to={`/anime/${item.anime.malId}?episode=${item.episode}`} className="group flex flex-col gap-2">
      <div className="relative isolate aspect-video overflow-hidden rounded-xl bg-muted">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className={cn('absolute inset-0 h-full w-full object-cover transition-[scale] duration-500 ease-out will-change-[scale] group-hover:scale-[1.04]', !item.episodeImageUrl && 'object-[50%_25%]')}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid size-12 place-items-center rounded-full bg-white/90 text-black shadow-lg">
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </div>
        {item.duration ? (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
            <Progress value={item.position / item.duration} className="h-1 bg-white/25" />
            <span className="font-mono text-[11px] text-white/80">{formatTime(item.duration - item.position)}</span>
          </div>
        ) : null}
      </div>
      <div className="min-w-0 px-0.5">
        <div className="text-sm">
          <span className="font-medium">
            {t('common.episode')} {item.episode}
          </span>
          <span className="text-muted-foreground"> / {item.anime.episodes ?? '?'}</span>
        </div>
        <div className="truncate text-[13px] text-muted-foreground">{item.anime.title}</div>
      </div>
    </Link>
  )
}

export function UpcomingCard({ item }: { item: UpcomingItem }) {
  const { t } = useTranslation()
  return (
    <Link to={`/anime/${item.anime.malId}`} className="group flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        {item.anime.imageUrl ? (
          <img src={item.anime.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_25%] opacity-80 transition-opacity group-hover:opacity-100" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2.5 left-3 font-mono text-[11px] text-white/85">{formatDateTime(item.airingAt)}</div>
      </div>
      <div className="min-w-0 px-0.5">
        <div className="truncate text-sm font-medium group-hover:text-accent">{item.anime.title}</div>
        <div className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <span>{item.episode ? `${t('common.episode')} ${item.episode}` : '—'}</span>
          <span className="shrink-0">{relativeTime(item.airingAt)}</span>
        </div>
      </div>
    </Link>
  )
}

export function Rail({ children }: { children: ReactNode }) {
  return <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:-mx-6 sm:px-6 [&>*]:w-72 [&>*]:shrink-0 [&>*]:snap-start">{children}</div>
}
