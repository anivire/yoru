import type { AnimeSummary, ContinueItem, ListStatus, UpcomingItem } from '@yoru/shared'
import { Badge, Image, Progress, cn } from '@yoru/ui'
import { Clock, Play, Repeat, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatDateTime, formatTime, relativeTime, seasonLabel, typeLabel } from '../lib/format'
import { useAppearance } from '../lib/appearance'

export function Poster({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-muted', className)}>
      {src ? <Image src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : null}
    </div>
  )
}

export function Score({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full bg-black/55 px-2 text-xs font-semibold tabular-nums text-white backdrop-blur-md', className)}>
      <Star className="size-3 fill-amber-400 text-amber-400" />
      {value.toFixed(1)}
    </span>
  )
}

export function AnimeCard({
  anime,
  progress,
  status,
  newEpisodes,
  badge,
  subtitle,
  rewatches,
}: {
  anime: AnimeSummary
  progress?: number
  status?: ListStatus
  newEpisodes?: number
  badge?: ReactNode
  subtitle?: ReactNode
  rewatches?: number
}) {
  const { t } = useTranslation()
  const total = anime.episodes
  const details = [typeLabel(anime.type), seasonLabel(anime), total ? `${total} ${t('common.episodes')}` : null].filter(Boolean).join(' · ')
  return (
    <Link to={`/anime/${anime.malId}`} className="group flex flex-col gap-2">
      <div className="relative isolate aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-sm transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-black/40 transform-gpu">
        {anime.imageUrl ? (
          <Image
            src={anime.imageUrl}
            alt={anime.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full transform-gpu object-cover backface-hidden transition-[scale] duration-300 ease-out will-change-transform group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {anime.genres.length ? (
            <div className="flex max-h-[2.75rem] flex-wrap gap-1 overflow-hidden">
              {anime.genres.slice(0, 3).map((g) => (
                <span key={g} className="inline-flex h-5 max-w-full items-center rounded-full bg-white/20 px-2 text-[11px] font-medium text-white">
                  <span className="truncate">{g}</span>
                </span>
              ))}
            </div>
          ) : null}
          {details ? <div className="line-clamp-2 text-[11px] leading-snug text-white/80">{details}</div> : null}
        </div>
        {progress !== undefined && total ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2.5 pt-6 transition-opacity duration-150 group-hover:opacity-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-accent shadow-[0_0_8px] shadow-accent/60" style={{ width: `${Math.min(100, (progress / total) * 100)}%` }} />
            </div>
          </div>
        ) : null}
        <div className="absolute inset-x-2 top-2.5 flex items-start justify-between gap-1">
          <div className="flex flex-wrap gap-1">
            {newEpisodes ? (
              <Badge size="sm" variant="solid" className="bg-accent text-accent-foreground">
                {t('home.newEpisodes', { count: newEpisodes })}
              </Badge>
            ) : null}
            {rewatches ? (
              <Badge size="sm" variant="solid" className="bg-info text-white" title={t('anime.rewatchedTimes', { count: rewatches })}>
                <Repeat className="size-3" />×{rewatches}
              </Badge>
            ) : null}
            {anime.airing ? (
              <Badge size="sm" variant="solid" className="bg-black/55 text-white backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-success" />
                {t('airing.airing')}
              </Badge>
            ) : null}
          </div>
          {badge ?? (anime.score ? <Score value={anime.score} className="shrink-0" /> : null)}
        </div>
      </div>
      <div className="min-w-0 px-0.5">
        <div className="line-clamp-2 text-sm font-medium leading-snug">{anime.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {subtitle ? (
            <span className="truncate">{subtitle}</span>
          ) : progress !== undefined ? (
            <span className="font-mono">
              {progress}/{total ?? '?'}
            </span>
          ) : (
            <span className="truncate">{[typeLabel(anime.type), seasonLabel(anime)].filter(Boolean).join(' · ')}</span>
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

export function ContinueCard({ item }: { item: ContinueItem }) {
  const { t } = useTranslation()
  const image = item.episodeImageUrl ?? item.anime.imageUrl
  return (
    <Link to={item.pending ? `/anime/${item.anime.malId}` : `/anime/${item.anime.malId}?episode=${item.episode}`} className="group flex flex-col gap-2">
      <div className="relative isolate aspect-video overflow-hidden rounded-xl bg-muted">
        {image ? (
          <Image
            src={image}
            alt=""
            loading="lazy"
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-[scale] duration-300 ease-out transform-gpu backface-hidden will-change-transform group-hover:scale-[1.04]',
              !item.episodeImageUrl && 'object-[50%_25%]',
            )}
          />
        ) : null}
        {item.pending ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--warning)_30%,transparent),transparent_70%)] px-4 text-center text-white backdrop-blur-[6px]">
            <span className="grid size-11 place-items-center rounded-full bg-warning text-black shadow-lg [text-shadow:none]">
              <Clock className="size-5" />
            </span>
            <span className="text-sm font-semibold">{t('home.awaitingTitle')}</span>
            <span className="text-[11px] leading-snug text-white/90">{t('home.awaitingText')}</span>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
              <span className="grid size-12 place-items-center rounded-full bg-white/90 text-black shadow-lg">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </div>
          </>
        )}
        {item.fresh && !item.pending ? (
          <Badge size="sm" variant="solid" className="absolute left-2 top-2.5 bg-accent text-accent-foreground">
            {t('home.newEpisode')}
          </Badge>
        ) : null}
        {item.duration && !item.pending ? (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
            <Progress value={item.position / item.duration} className="h-1 bg-white/25" />
            <span className="font-mono text-[11px] text-white/80">{formatTime(item.duration - item.position)}</span>
          </div>
        ) : null}
      </div>
      <div className="min-w-0 px-0.5">
        <div className="flex items-center gap-2 text-sm">
          <span>
            <span className="font-medium">
              {t('common.episode')} {item.episode}
            </span>
            <span className="text-muted-foreground"> / {item.anime.episodes ?? '?'}</span>
          </span>
          {item.pending ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-warning-soft px-2 text-[11px] font-medium text-warning">
              <Clock className="size-3" />
              {t('home.awaitingTranslation')}
            </span>
          ) : null}
        </div>
        <div className="truncate text-[13px] text-muted-foreground">{item.anime.title}</div>
      </div>
    </Link>
  )
}

export function UpcomingCard({ item }: { item: UpcomingItem }) {
  const { t } = useTranslation()
  const image = item.bannerUrl ?? item.anime.imageUrl
  return (
    <Link to={`/anime/${item.anime.malId}`} className="group flex min-w-0 flex-col gap-2.5">
      <div className="relative isolate aspect-video overflow-hidden rounded-xl bg-muted transform-gpu">
        {image ? (
          <Image
            src={image}
            alt=""
            loading="lazy"
            className={cn(
              'absolute inset-0 h-full w-full transform-gpu object-cover backface-hidden transition-[scale] duration-300 ease-out will-change-transform group-hover:scale-105',
              !item.bannerUrl && 'object-[50%_25%]',
            )}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span className="absolute bottom-2.5 left-3 font-mono text-[11px] text-white/90">{formatDateTime(item.airingAt)}</span>
      </div>
      <div className="min-w-0 px-0.5">
        <div className="truncate text-sm font-medium">{item.anime.title}</div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold">{item.episode ? `${t('common.episode')} ${item.episode}` : '—'}</span>
          <span className="shrink-0 text-[13px] text-muted-foreground">{relativeTime(item.airingAt)}</span>
        </div>
      </div>
    </Link>
  )
}

export function Rail({ children, size = 'wide' }: { children: ReactNode; size?: 'wide' | 'poster' }) {
  return (
    <div
      className={cn(
        'flex snap-x gap-4 overflow-x-auto pb-2 scrollbar-none [&>*]:shrink-0 [&>*]:snap-start',
        size === 'wide' ? '[&>*]:w-72' : '[&>*]:w-36 sm:[&>*]:w-44',
      )}
    >
      {children}
    </div>
  )
}

export function UpcomingGrid({ children }: { children: ReactNode }) {
  const { stretch } = useAppearance()
  return <div className={cn('grid gap-4', stretch ? 'grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]' : 'sm:grid-cols-2 lg:grid-cols-4')}>{children}</div>
}
