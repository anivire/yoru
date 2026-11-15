import { useQuery } from '@tanstack/react-query'
import type { AnimeDetails, ListEntry } from '@yoru/shared'
import { Badge, Dialog, DialogContent, DialogTrigger, EmptyState, Image, Lightbox, Tooltip, cn } from '@yoru/ui'
import { RiCalendarScheduleFill, RiClapperboardFill, RiYoutubeFill } from '@remixicon/react'
import { EpisodeCount, Score } from '../components/anime-cards'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Page } from '../components/app-shell'
import { ListEditor } from '../components/list-editor'
import { airedLimit } from '../components/quick-edit'
import { LinkButton, LinkGroup, LinkTile, ServiceLinks } from '../components/service-links'
import { AnimePageSkeleton } from '../components/skeletons'
import { WatchSection } from '../components/watch-section'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import { formatDate, formatDateTime, relativeTime, seasonLabel, typeLabel } from '../lib/format'
import { keys } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'
import { useAnimeTitle } from '../lib/anime-title'

const MORE_SPACE = 24

function Synopsis({ text, open, onToggle }: { text: string; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)
  const [lines, setLines] = useState(4)
  const [overflows, setOverflows] = useState(false)
  useEffect(() => {
    const wrap = wrapRef.current
    const el = textRef.current
    if (!wrap || !el || open) return
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 24
      const total = Math.round(el.scrollHeight / lineHeight)
      if (!window.matchMedia('(min-width: 640px)').matches) {
        setLines(4)
        setOverflows(total > 4)
        return
      }
      const fit = Math.max(1, Math.floor(wrap.clientHeight / lineHeight))
      if (total <= fit) {
        setLines(fit)
        setOverflows(false)
      } else {
        setLines(Math.max(1, Math.floor((wrap.clientHeight - MORE_SPACE) / lineHeight)))
        setOverflows(true)
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, open])
  return (
    <div ref={wrapRef} className={cn('flex w-full max-w-3xl flex-col gap-1', !open && 'sm:min-h-0 sm:flex-1 sm:basis-0')}>
      <p
        ref={textRef}
        className="whitespace-pre-line text-left text-[0.9375rem] leading-relaxed text-foreground/80"
        style={open ? undefined : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden' }}
      >
        {text}
      </p>
      {(open ? text.length > 280 : overflows) ? (
        <button type="button" onClick={onToggle} className="cursor-pointer self-start text-[0.8125rem] font-medium text-foreground hover:text-accent">
          {open ? t('anime.less') : t('anime.more')}
        </button>
      ) : null}
    </div>
  )
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1) || null
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const embed = /\/embed\/([\w-]{6,})/.exec(u.pathname)
    return embed?.[1] ?? null
  } catch {
    return null
  }
}

function TrailerButton({ url }: { url: string }) {
  const { t } = useTranslation()
  const id = youtubeId(url)
  if (!id) {
    return (
      <LinkButton href={url} icon={<RiClapperboardFill />}>
        {t('anime.trailer')}
      </LinkButton>
    )
  }
  return (
    <Dialog>
      <Tooltip content={t('anime.trailer')}>
        <DialogTrigger asChild>
          <LinkTile label={t('anime.trailer')}>
            <RiYoutubeFill className="text-[#ff0033]" />
          </LinkTile>
        </DialogTrigger>
      </Tooltip>
      <DialogContent title={t('anime.trailer')} className="w-[min(94vw,56rem)]">
        <div className="p-4 pt-2">
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
              title={t('anime.trailer')}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Links({ anime, className }: { anime: AnimeDetails; className?: string }) {
  return (
    <div className={className}>
      <LinkGroup>
        <ServiceLinks malId={anime.malId} />
        {anime.trailerUrl ? <TrailerButton url={anime.trailerUrl} /> : null}
      </LinkGroup>
    </div>
  )
}

function MobileEntryRow({ anime, entry }: { anime: AnimeDetails; entry: ListEntry | null }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:hidden">
      {entry?.score ? <Score value={entry.score} surface="theme" className="h-7 px-2.5 text-sm" title={t('anime.yourScore')} /> : null}
      {entry ? <EpisodeCount current={entry.progress} total={anime.episodes} className="text-base font-semibold" /> : null}
      <div className={entry ? '' : 'w-full max-w-64'}>
        <ListEditor malId={anime.malId} entry={entry} total={anime.episodes} aired={airedLimit(anime)} compact={Boolean(entry)} />
      </div>
      {entry ? <span className="text-sm font-semibold">{t(`status.${entry.status}`)}</span> : null}
    </div>
  )
}

function Header({ anime, entry }: { anime: AnimeDetails; entry: ListEntry | null }) {
  const { t } = useTranslation()
  const { expandSynopsis } = useAppearance()
  const [open, setOpen] = useState(expandSynopsis)
  const title = useAnimeTitle()
  const mainTitle = title(anime)
  const secondaryTitle = [anime.title, anime.titleEnglish].find((v) => v && v !== mainTitle) ?? null
  const meta = [typeLabel(anime.type), anime.episodes ? `${anime.episodes} ${t('common.episodes')}` : null, anime.duration, seasonLabel(anime)].filter(Boolean)
  const facts = [
    anime.studios.length ? { label: t('anime.studios'), value: anime.studios.join(', ') } : null,
    anime.airedFrom ? { label: t('anime.aired'), value: `${formatDate(anime.airedFrom)}${anime.airedTo ? ` — ${formatDate(anime.airedTo)}` : ''}` } : null,
    anime.rating ? { label: t('anime.rating'), value: anime.rating } : null,
  ].filter((f) => f !== null)
  return (
    <div>
      <div className="mx-auto max-w-(--page-max) px-4 pb-10 pt-4 sm:px-6 sm:pt-10">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex w-36 shrink-0 flex-col gap-3 sm:w-48">
            {anime.imageUrl ? (
              <Lightbox src={anime.imageUrl} title={anime.title} closeLabel={t('common.close')}>
                <button type="button" aria-label={t('anime.poster')} className="group aspect-[2/3] w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted shadow-2xl">
                  <Image src={anime.imageUrl} alt="" className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-110" />
                </button>
              </Lightbox>
            ) : (
              <div className="aspect-[2/3] w-full rounded-xl bg-muted shadow-2xl" />
            )}
            <div className="hidden sm:block">
              <ListEditor malId={anime.malId} entry={entry} total={anime.episodes} aired={airedLimit(anime)} />
            </div>
            <Links anime={anime} className="hidden sm:block" />
          </div>
          <div className={cn('flex w-full min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-stretch sm:text-left', !open && 'sm:h-72')}>
            <div className="w-full">
              <h1 className="line-clamp-3 text-2xl font-semibold tracking-tight sm:line-clamp-2 sm:text-4xl">{mainTitle}</h1>
              {secondaryTitle ? (
                <div className="mt-1 text-base font-medium text-muted-foreground sm:truncate sm:text-lg sm:font-normal">{secondaryTitle}</div>
              ) : null}
              {anime.titleJapanese && anime.titleJapanese !== mainTitle ? <div className="hidden truncate text-sm text-subtle-foreground sm:block">{anime.titleJapanese}</div> : null}
            </div>
            <MobileEntryRow anime={anime} entry={entry} />
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
              {anime.score ? <Score value={anime.score} surface="theme" digits={2} /> : null}
              {anime.status ? <Badge variant={anime.airing ? 'success' : 'neutral'}>{t(`airing.${anime.status}`, { defaultValue: anime.status })}</Badge> : null}
              {meta.map((m) => (
                <span key={m} className="text-muted-foreground">
                  {m}
                </span>
              ))}
            </div>
            {anime.nextAiringAt ? (
              <div className="inline-flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
                <RiCalendarScheduleFill className="size-4 text-accent" />
                <span>{anime.latestEpisode ? t('anime.nextEpisode', { episode: anime.latestEpisode + 1, when: relativeTime(anime.nextAiringAt) }) : t('anime.nextAiring', { when: relativeTime(anime.nextAiringAt) })}</span>
                <span className="dotted-underline font-mono text-xs text-muted-foreground">{formatDateTime(anime.nextAiringAt)}</span>
              </div>
            ) : null}
            {anime.genres.length ? (
              <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {anime.genres.map((g) => (
                  <span key={g} className="inline-flex h-6 items-center rounded-full bg-foreground/10 px-2.5 text-xs font-medium text-foreground/90 backdrop-blur-sm">
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
            {anime.synopsis ? <Synopsis text={anime.synopsis} open={open} onToggle={() => setOpen(!open)} /> : null}
            <Links anime={anime} className="w-full sm:hidden" />
          </div>
        </div>
        {facts.length ? (
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[0.8125rem] text-muted-foreground sm:justify-end">
            {facts.map((f) => (
              <span key={f.label}>
                {f.label}: <span className="text-foreground">{f.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function AnimePage() {
  const { t } = useTranslation()
  const malId = Number(useParams().id)
  const { data, isPending, isError, error } = useQuery({ queryKey: keys.anime(malId), queryFn: () => api.anime(malId), enabled: malId > 0 })
  const title = useAnimeTitle()
  useDocumentTitle(data ? title(data.anime) : undefined)

  if (isPending) return <AnimePageSkeleton />
  if (isError || !data) {
    return (
      <Page>
        <EmptyState mood="error" title={t('anime.notFound')} description={error?.message} />
      </Page>
    )
  }

  return (
    <div className="relative isolate -mt-(--header-h) pt-(--header-h)">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_30%,transparent)]">
        {data.anime.imageUrl ? <img src={data.anime.imageUrl} alt="" className="h-full w-full scale-110 object-cover object-[50%_25%] opacity-50 blur-xl" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/50 to-background/20" />
      </div>
      <Header anime={data.anime} entry={data.entry} />
      <Page>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{t('anime.streaming')}</h2>
        <WatchSection anime={data.anime} entry={data.entry} />
      </Page>
    </div>
  )
}
