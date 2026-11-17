import type { AnimeSummary, ContinueItem, ListStatus, UpcomingItem } from '@yoru/shared'
import { Badge, Image, Progress, StarIcon, Tooltip, cn } from '@yoru/ui'
import { RiArrowLeftSLine, RiArrowRightSLine, RiPlayLargeFill, RiRepeatFill, RiTimeFill } from '@remixicon/react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { Children, type CSSProperties, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTime, relativeTime, seasonLabel, typeLabel } from '../lib/format'
import { useAppearance } from '../lib/appearance'
import { QuickEdit } from './quick-edit'
import { TLink } from './transition-link'
import { AnimeTitle, animePath } from '../lib/anime-title'
import { StatusText } from '../lib/list-status'
import { FriendStack, useFriendsOn } from './friend-titles'

export function Poster({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-muted', className)}>
      {src ? <Image src={src} alt={alt} loading="lazy" fallback className="absolute inset-0 h-full w-full object-cover" /> : null}
    </div>
  )
}

type ScoreTone = 'gold' | 'green' | 'yellow' | 'red'

export function scoreTone(value: number): ScoreTone {
  if (value >= 9) return 'gold'
  if (value >= 7) return 'green'
  if (value >= 5) return 'yellow'
  return 'red'
}

const TONE_COLOR: Record<ScoreTone, string> = {
  gold: '#fbbf24',
  green: '#34d399',
  yellow: '#fde047',
  red: '#f87171',
}

export function scoreColor(value: number) {
  return TONE_COLOR[scoreTone(value)]
}

export const GLASS_CHIP = 'bg-white/75 text-foreground shadow-sm shadow-black/5 backdrop-blur-sm dark:bg-white/10 dark:shadow-none'

export function formatScore(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits)
}

export function Score({
  value,
  className,
  surface = 'dark',
  digits = 1,
  title,
  colored,
}: {
  value: number
  className?: string
  surface?: 'dark' | 'theme' | 'glass'
  digits?: number
  title?: string
  colored?: boolean
}) {
  if (colored) {
    return (
      <span
        title={title}
        style={{ backgroundColor: scoreColor(value) }}
        className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-bold tabular-nums text-neutral-950 shadow-sm shadow-black/20', className)}
      >
        <StarIcon className="size-3 fill-current" />
        {formatScore(value, digits)}
      </span>
    )
  }
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold tabular-nums',
        surface === 'dark' ? 'bg-black/65 text-white' : surface === 'glass' ? GLASS_CHIP : 'bg-field text-foreground',
        className,
      )}
    >
      <StarIcon className={cn('size-3', surface === 'dark' ? 'text-amber-400' : 'text-amber-500')} />
      {formatScore(value, digits)}
    </span>
  )
}

export function EpisodeCount({ current, total, className }: { current: number | string; total: number | null | undefined; className?: string }) {
  return (
    <span className={cn('tabular-nums', className)}>
      {current}
      <span className="opacity-55">/{total ?? '?'}</span>
    </span>
  )
}

export function AnimeCard({
  anime,
  progress,
  status,
  badge,
  subtitle,
  rewatches,
  userScore,
  coloredScore,
  href,
}: {
  anime: AnimeSummary
  progress?: number
  status?: ListStatus
  badge?: ReactNode
  subtitle?: ReactNode
  rewatches?: number
  userScore?: number | null
  coloredScore?: boolean
  href?: string
}) {
  const { t } = useTranslation()
  const total = anime.episodes
  const details = [typeLabel(anime.type), seasonLabel(anime), total ? `${total} ${t('common.episodes')}` : null].filter(Boolean).join(' · ')
  const titleRef = useRef<HTMLDivElement>(null)
  const [clamped, setClamped] = useState(false)
  const friends = useFriendsOn(anime.malId)
  const withProgress = progress !== undefined && Boolean(total) && progress < (total ?? 0)
  return (
    <div
      className="group relative"
      onPointerEnter={() => {
        const el = titleRef.current
        if (el) setClamped(el.scrollHeight > el.clientHeight + 1)
      }}
    >
      <CardLink href={href} to={animePath(anime.malId, anime.title)}>
      <div className="relative isolate aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-sm transition-shadow duration-150 group-hover:shadow-xl group-hover:shadow-black/40">
        {anime.imageUrl ? (
          <Image
            src={anime.imageUrl}
            alt={anime.title}
            loading="lazy"
            fallback
            className="absolute inset-0 h-full w-full zoom-layer object-cover transition-transform duration-150 ease-out group-hover:will-change-transform group-hover:[--zoom:1.05]"
          />
        ) : null}
        <div className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2.5 pr-11 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {anime.genres.length ? (
            <div className="flex max-h-[2.75rem] flex-wrap gap-1 overflow-hidden">
              {anime.genres.slice(0, 3).map((g) => (
                <span key={g} className="inline-flex h-5 max-w-full items-center rounded-full bg-white/20 px-2 text-[0.6875rem] font-medium text-white">
                  <span className="truncate">{g}</span>
                </span>
              ))}
            </div>
          ) : null}
          {details ? <div className="line-clamp-2 text-[0.6875rem] leading-snug text-white/80">{details}</div> : null}
        </div>
        {friends.length ? <FriendStack users={friends} className={cn('absolute left-2.5 transition-opacity duration-150 group-hover:opacity-0', withProgress ? 'bottom-7' : 'bottom-2.5')} /> : null}
        {progress !== undefined && total && progress < total ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2.5 pt-6 transition-opacity duration-150 group-hover:opacity-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-accent shadow-[0_0_8px] shadow-accent/60" style={{ width: `${Math.min(100, (progress / total) * 100)}%` }} />
            </div>
          </div>
        ) : null}
        <div className="absolute inset-x-2 top-2.5 flex items-start justify-between gap-1">
          <div className="flex flex-wrap gap-1">
            {rewatches ? (
              <Badge size="sm" variant="solid" className="gap-1 bg-black/65 text-white tabular-nums" title={t('anime.rewatchedTimes', { count: rewatches })}>
                <RiRepeatFill className="size-3" />
                {rewatches}
              </Badge>
            ) : null}
            {anime.airing ? (
              <Badge size="sm" variant="solid" className="bg-black/65 text-white">
                <span className="size-1.5 rounded-full bg-success" />
                {t('airing.airing')}
              </Badge>
            ) : null}
          </div>
          {badge ??
            (userScore ? (
              <Score value={userScore} colored={coloredScore} title={t('anime.yourScore')} className="shrink-0" />
            ) : anime.score ? (
              <Score value={anime.score} className="shrink-0" />
            ) : null)}
        </div>
      </div>
      <div className="min-w-0 px-0.5">
        {clamped ? (
          <Tooltip content={<AnimeTitle anime={anime} />}>
            <div ref={titleRef} className="line-clamp-2 text-sm font-medium leading-snug"><AnimeTitle anime={anime} /></div>
          </Tooltip>
        ) : (
          <div ref={titleRef} className="line-clamp-2 text-sm font-medium leading-snug"><AnimeTitle anime={anime} /></div>
        )}
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {subtitle ? (
            <span className="truncate">{subtitle}</span>
          ) : progress !== undefined ? (
            <EpisodeCount current={progress} total={total} className="font-mono" />
          ) : (
            <span className="truncate">{[typeLabel(anime.type), seasonLabel(anime)].filter(Boolean).join(' · ')}</span>
          )}
          {status ? <StatusText status={status} /> : null}
        </div>
      </div>
      </CardLink>
      {href ? null : (
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/3]">
          <QuickEdit malId={anime.malId} className="pointer-events-auto absolute bottom-2.5 right-2.5 [@media(hover:none)]:bottom-6" />
        </div>
      )}
    </div>
  )
}

function CardLink({ href, to, children }: { href?: string; to: string; children: ReactNode }) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="flex flex-col gap-2">
        {children}
      </a>
    )
  }
  return (
    <TLink to={to} className="flex flex-col gap-2">
      {children}
    </TLink>
  )
}

const VIRTUALIZE_FROM = 60
const ROW_GAP = 24
const CAPTION_HEIGHT = 64

function useGridColumns(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ columns: 0, width: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const measure = () => {
      if (!el.isConnected) return
      const tracks = getComputedStyle(el).gridTemplateColumns.split(' ').filter((t) => t.endsWith('px'))
      if (tracks.length) setSize({ columns: tracks.length, width: Number.parseFloat(tracks[0]!) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled])
  return { ref, ...size }
}

function VirtualRows({ gridRef, grid, items, columns, columnWidth }: { gridRef: RefObject<HTMLDivElement | null>; grid: string; items: ReactNode[]; columns: number; columnWidth: number }) {
  const [offset, setOffset] = useState(0)
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const update = () => setOffset(el.getBoundingClientRect().top + window.scrollY)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [gridRef])
  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(items.length / columns),
    estimateSize: () => (columnWidth || 180) * 1.5 + CAPTION_HEIGHT + ROW_GAP,
    overscan: 3,
    scrollMargin: offset,
  })
  return (
    <div className="relative col-span-full" style={{ height: Math.max(0, virtualizer.getTotalSize() - ROW_GAP) }}>
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          className={cn(grid, 'absolute inset-x-0 top-0')}
          style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`, paddingBottom: ROW_GAP }}
        >
          {items.slice(row.index * columns, (row.index + 1) * columns)}
        </div>
      ))}
    </div>
  )
}

export function PosterGrid({ children, className, fullRows = false }: { children: ReactNode; className?: string; fullRows?: boolean }) {
  const { stretch, pageWidth } = useAppearance()
  const narrow = pageWidth === '3xl' || pageWidth === '4xl'
  const items = Children.toArray(children)
  const virtual = items.length >= VIRTUALIZE_FROM
  const { ref, columns, width } = useGridColumns(fullRows || virtual)
  const shown = fullRows && columns > 0 && items.length > columns ? items.slice(0, items.length - (items.length % columns)) : items
  const columnsClass = stretch
    ? 'grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]'
    : narrow
      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
  return (
    <div ref={ref} className={cn('grid gap-x-4 gap-y-6', columnsClass, className)}>
      {!virtual ? shown : columns > 0 ? <VirtualRows gridRef={ref} grid={cn('grid gap-x-4', columnsClass)} items={shown} columns={columns} columnWidth={width} /> : null}
    </div>
  )
}

export function ContinueCard({ item }: { item: ContinueItem }) {
  const { t } = useTranslation()
  const image = item.episodeImageUrl ?? item.anime.imageUrl
  return (
    <TLink to={item.pending ? animePath(item.anime.malId, item.anime.title) : `${animePath(item.anime.malId, item.anime.title)}?episode=${item.episode}`} className="group flex flex-col gap-2">
      <div className="relative isolate aspect-video overflow-hidden rounded-xl bg-muted">
        {image ? (
          <Image
            src={image}
            alt=""
            loading="lazy"
            className={cn(
              'absolute inset-0 h-full w-full zoom-layer object-cover transition-transform duration-150 ease-out group-hover:will-change-transform group-hover:[--zoom:1.04]',
              !item.episodeImageUrl && 'object-[50%_25%]',
              item.pending && 'blur-md [--zoom:1.2] group-hover:[--zoom:1.2]',
            )}
          />
        ) : null}
        {item.pending ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--warning)_18%,transparent),transparent_60%)] px-4 text-center text-white">
            <span className="grid size-11 place-items-center rounded-full bg-warning text-black shadow-lg [text-shadow:none]">
              <RiTimeFill className="size-5" />
            </span>
            <span className="text-sm font-semibold">{t('home.awaitingTitle')}</span>
            <span className="text-[0.6875rem] leading-snug text-white/90">{t('home.awaitingText')}</span>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
              <span className="grid size-12 place-items-center rounded-full bg-white/90 text-black shadow-lg">
                <RiPlayLargeFill className="size-5" />
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
            <span className="font-mono text-[0.6875rem] text-white/80">{formatTime(item.duration - item.position)}</span>
          </div>
        ) : null}
      </div>
      <div className="min-w-0 px-0.5">
        <div className="flex items-center gap-2 text-sm">
          <span>
            <span className="font-medium">
              {t('common.episode')} {item.episode}
            </span>
            <span className="text-subtle-foreground"> / {item.anime.episodes ?? '?'}</span>
          </span>
          {item.pending ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-warning-soft px-2 text-[0.6875rem] font-medium text-warning">
              <RiTimeFill className="size-3" />
              {t('home.awaitingTranslation')}
            </span>
          ) : null}
        </div>
        <div className="truncate text-[0.8125rem] text-muted-foreground"><AnimeTitle anime={item.anime} /></div>
      </div>
    </TLink>
  )
}

export function UpcomingCard({ item }: { item: UpcomingItem }) {
  const { t } = useTranslation()
  const image = item.bannerUrl ?? item.anime.imageUrl
  return (
    <TLink to={animePath(item.anime.malId, item.anime.title)} className="group flex min-w-0 flex-col gap-2.5">
      <div className="relative isolate aspect-video overflow-hidden rounded-xl bg-muted transform-gpu">
        {image ? (
          <Image
            src={image}
            alt=""
            loading="lazy"
            className={cn(
              'absolute inset-0 h-full w-full zoom-layer object-cover transition-transform duration-150 ease-out group-hover:will-change-transform group-hover:[--zoom:1.05]',
              !item.bannerUrl && 'object-[50%_25%]',
            )}
          />
        ) : null}
      </div>
      <div className="min-w-0 px-0.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="min-w-0 truncate">
            <span className="font-medium">{item.episode ? `${t('common.episode')} ${item.episode}` : '—'}</span>
            {item.episode ? <span className="text-subtle-foreground"> / {item.anime.episodes ?? '?'}</span> : null}
          </span>
          <span className="shrink-0 text-[0.8125rem] text-muted-foreground">{relativeTime(item.airingAt)}</span>
        </div>
        <div className="truncate text-[0.8125rem] text-muted-foreground"><AnimeTitle anime={item.anime} /></div>
      </div>
    </TLink>
  )
}

const RAIL_FADE = '3rem'

export function Rail({ children, size = 'wide' }: { children: ReactNode; size?: 'wide' | 'poster' }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number; moved: boolean; lastX: number; lastT: number; v: number } | null>(null)
  const dragged = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [settling, setSettling] = useState(false)
  const [edges, setEdges] = useState({ prev: false, next: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const prev = el.scrollLeft > 4
      const next = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
      setEdges((e) => (e.prev === prev && e.next === next ? e : { prev, next }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(el)
    const mutation = new MutationObserver(update)
    mutation.observe(el, { childList: true })
    return () => {
      el.removeEventListener('scroll', update)
      resize.disconnect()
      mutation.disconnect()
    }
  }, [])

  const page = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const endDrag = () => {
    const d = drag.current
    const el = ref.current
    dragged.current = Boolean(d?.moved)
    drag.current = null
    setDragging(false)
    if (!d?.moved || !el) return
    const fling = performance.now() - d.lastT < 80 && Math.abs(d.v) > 0.05 ? d.v * 300 : 0
    const projected = el.scrollLeft - fling
    const max = el.scrollWidth - el.clientWidth
    let target = projected
    let best = Infinity
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const left = Math.min(child.offsetLeft, max)
      if (Math.abs(left - projected) < best) {
        best = Math.abs(left - projected)
        target = left
      }
    }
    setSettling(true)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setSettling(false)
    }
    el.addEventListener('scrollend', finish, { once: true })
    window.setTimeout(finish, 700)
    el.scrollTo({ left: Math.max(0, Math.min(max, target)), behavior: 'smooth' })
  }

  const mask: CSSProperties = {
    maskImage: `linear-gradient(to right, ${edges.prev ? `transparent, #000 ${RAIL_FADE}` : '#000, #000'}, ${edges.next ? `#000 calc(100% - ${RAIL_FADE}), transparent` : '#000, #000'})`,
  }

  return (
    <div className="group/rail relative">
      <div
        ref={ref}
        style={mask}
        onPointerDown={(e) => {
          dragged.current = false
          if (e.pointerType !== 'mouse' || e.button !== 0) return
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          if (!d.moved) {
            if (Math.abs(dx) < 6) return
            d.moved = true
            setDragging(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          e.currentTarget.scrollLeft = d.left - dx
          const dt = e.timeStamp - d.lastT
          if (dt > 0) d.v = d.v * 0.6 + ((e.clientX - d.lastX) / dt) * 0.4
          d.lastX = e.clientX
          d.lastT = e.timeStamp
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (!dragged.current) return
          dragged.current = false
          e.preventDefault()
          e.stopPropagation()
        }}
        onDragStart={(e) => e.preventDefault()}
        className={cn(
          'flex gap-4 overflow-x-auto pb-2 scrollbar-none [&>*]:shrink-0 [&>*]:snap-start',
          dragging && 'cursor-grabbing select-none',
          !dragging && !settling && 'snap-x',
          size === 'wide' ? '[&>*]:w-72' : '[&>*]:w-36 sm:[&>*]:w-44',
        )}
      >
        {children}
      </div>
      <RailArrow dir={-1} visible={edges.prev} size={size} label={t('common.scrollPrev')} onClick={() => page(-1)} />
      <RailArrow dir={1} visible={edges.next} size={size} label={t('common.scrollNext')} onClick={() => page(1)} />
    </div>
  )
}

function RailArrow({ dir, visible, size, label, onClick }: { dir: 1 | -1; visible: boolean; size: 'wide' | 'poster'; label: string; onClick: () => void }) {
  const Icon = dir === 1 ? RiArrowRightSLine : RiArrowLeftSLine
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
      className={cn(
        'absolute z-10 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-raised text-foreground shadow-lg ring-1 ring-border transition-[opacity,scale] duration-150 hover:scale-105 active:scale-95 [@media(hover:none)]:hidden [&_svg]:size-6',
        dir === 1 ? 'right-2' : 'left-2',
        size === 'poster' ? 'top-[6.75rem] sm:top-[8.25rem]' : 'top-[calc(50%-0.25rem)]',
        visible ? 'opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <Icon />
    </button>
  )
}

export function UpcomingGrid({ children }: { children: ReactNode }) {
  const { stretch, pageWidth } = useAppearance()
  const narrow = pageWidth === '3xl' || pageWidth === '4xl'
  return <div className={cn('grid gap-4', stretch ? 'grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]' : narrow ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4')}>{children}</div>
}
