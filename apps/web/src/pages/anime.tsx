import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnimeDetails, ListEntry } from '@yoru/shared'
import { Badge, Dialog, DialogContent, DialogTrigger, EmptyState, Image, Lightbox, cn } from '@yoru/ui'
import { RiCalendarScheduleFill, RiClapperboardFill, RiPlayFill } from '@remixicon/react'
import { EpisodeCount, GLASS_CHIP, Score } from '../components/anime-cards'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../lib/list-status'
import { Navigate, useLocation, useParams } from 'react-router'
import { Page } from '../components/app-shell'
import { ListEditor } from '../components/list-editor'
import { airedLimit } from '../components/quick-edit'
import { LinkChip, LinkChips, LinkLogo, ServiceLinks } from '../components/service-links'
import { AnimePageSkeleton } from '../components/skeletons'
import { WatchSection } from '../components/watch-section'
import { NotesSection } from '../components/notes'
import { FriendsOnAnime, RecommendButton } from '../components/social'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import { formatDate, formatDateTime, relativeTime, seasonLabel, typeLabel } from '../lib/format'
import { cachedEpisodeCount, keys } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'
import { animePath, useAnimeTitle } from '../lib/anime-title'
import { TLink } from '../components/transition-link'
import { Breadcrumbs } from '../components/breadcrumbs'
import { AnimeExtrasSections, ScreenshotsSection } from '../components/anime-extras'

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
    <div ref={wrapRef} className={cn('w-full max-w-3xl', !open && 'relative sm:min-h-32 sm:flex-1')}>
      <div className={cn('flex flex-col gap-1', !open && 'sm:absolute sm:inset-0')}>
        <p
          ref={textRef}
          className={cn('whitespace-pre-line text-left text-[0.9375rem] leading-relaxed text-foreground/80', !open && overflows && '[mask-image:linear-gradient(to_bottom,black_calc(100%-3.5rem),transparent)]')}
          style={open ? undefined : { maxHeight: `${lines}lh`, overflow: 'hidden' }}
        >
          {text}
        </p>
        {(open ? text.length > 280 : overflows) ? (
          <button type="button" onClick={onToggle} className="cursor-pointer self-start text-[0.8125rem] font-medium text-foreground hover:text-accent">
            {open ? t('anime.less') : t('anime.more')}
          </button>
        ) : null}
      </div>
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
      <LinkChip
        href={url}
        external
        label={t('anime.trailer')}
        logo={
          <LinkLogo color="#ff0033">
            <RiClapperboardFill />
          </LinkLogo>
        }
      />
    )
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <LinkChip
          label={t('anime.trailer')}
          logo={
            <LinkLogo color="#ff0033">
              <RiPlayFill />
            </LinkLogo>
          }
        />
      </DialogTrigger>
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

function Links({ anime }: { anime: AnimeDetails }) {
  return (
    <LinkChips>
      <ServiceLinks malId={anime.malId} />
      {anime.trailerUrl ? <TrailerButton url={anime.trailerUrl} /> : null}
    </LinkChips>
  )
}

function MobileEntryRow({ anime, entry }: { anime: AnimeDetails; entry: ListEntry | null }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:hidden">
      {entry?.score ? <Score value={entry.score} surface="glass" className="h-7 px-2.5 text-sm" title={t('anime.yourScore')} /> : null}
      {entry ? <EpisodeCount current={entry.progress} total={anime.episodes} className="text-base font-semibold" /> : null}
      <div className={entry ? '' : 'w-full max-w-64'}>
        <ListEditor malId={anime.malId} entry={entry} total={anime.episodes} aired={airedLimit(anime)} compact={Boolean(entry)} />
      </div>
      {entry ? <StatusBadge status={entry.status} className="h-7 gap-1.5 pl-2 pr-3 text-sm [&_svg]:size-4" /> : null}
      <RecommendButton malId={anime.malId} className="w-full max-w-64" />
    </div>
  )
}

function Header({ anime, entry }: { anime: AnimeDetails; entry: ListEntry | null }) {
  const { t } = useTranslation()
  const { expandSynopsis } = useAppearance()
  const [open, setOpen] = useState(expandSynopsis)
  const genreList = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: Infinity })
  const genreIds = new Map((genreList.data ?? []).map((g) => [g.name.toLowerCase(), g.id]))
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
      <div className="page-frame page-top-double px-4 pb-10 sm:px-6">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: t('nav.home'), to: '/' },
            { label: t('nav.search'), to: '/search' },
            ...(anime.type ? [{ label: typeLabel(anime.type), to: `/search?type=${anime.type}` }] : []),
            { label: mainTitle },
          ]}
        />
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch sm:gap-6">
          <div className="flex w-36 shrink-0 flex-col gap-3 sm:w-48">
            {anime.imageUrl ? (
              <Lightbox src={anime.imageUrl} title={anime.title} closeLabel={t('common.close')}>
                <button type="button" aria-label={t('anime.poster')} className="group aspect-[2/3] w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted shadow-2xl">
                  <Image src={anime.imageUrl} alt="" fallback className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-110" />
                </button>
              </Lightbox>
            ) : (
              <div className="aspect-[2/3] w-full rounded-xl bg-muted shadow-2xl" />
            )}
            <div className="hidden flex-col gap-2 sm:flex">
              <ListEditor malId={anime.malId} entry={entry} total={anime.episodes} aired={airedLimit(anime)} />
              <RecommendButton malId={anime.malId} className="w-full" />
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-stretch sm:text-left">
            <div className="w-full">
              <h1 className="line-clamp-3 text-2xl font-semibold tracking-tight sm:line-clamp-2 sm:text-4xl">{mainTitle}</h1>
              {secondaryTitle ? (
                <div className="mt-1 text-base font-medium text-muted-foreground sm:truncate sm:text-lg sm:font-normal">{secondaryTitle}</div>
              ) : null}
              {anime.titleJapanese && anime.titleJapanese !== mainTitle ? <div className="hidden truncate text-sm text-muted-foreground sm:block">{anime.titleJapanese}</div> : null}
            </div>
            <MobileEntryRow anime={anime} entry={entry} />
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
              {anime.score ? <Score value={anime.score} surface="glass" digits={2} /> : null}
              {anime.status ? <Badge variant={anime.airing ? 'success' : 'neutral'} className={anime.airing ? undefined : GLASS_CHIP}>{t(`airing.${anime.status}`, { defaultValue: anime.status })}</Badge> : null}
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
                {anime.genres.map((g) => {
                  const id = genreIds.get(g.toLowerCase())
                  const className = cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', GLASS_CHIP)
                  return id ? (
                    <TLink key={g} to={`/search?genres=${id}`} className={cn(className, 'transition-colors hover:text-accent')}>
                      {g}
                    </TLink>
                  ) : (
                    <span key={g} className={className}>
                      {g}
                    </span>
                  )
                })}
              </div>
            ) : null}
            <Links anime={anime} />
            {facts.length ? (
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[0.8125rem] text-muted-foreground sm:justify-start">
                {facts.map((f) => (
                  <span key={f.label}>
                    {f.label}: <span className="text-foreground">{f.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
            {anime.synopsis ? <Synopsis text={anime.synopsis} open={open} onToggle={() => setOpen(!open)} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AnimePage() {
  const { t } = useTranslation()
  const param = useParams().id ?? ''
  const location = useLocation()
  const malId = Number.parseInt(param, 10)
  const { backdrop } = useAppearance()
  const queryClient = useQueryClient()
  const { data, isPending, isError, error } = useQuery({ queryKey: keys.anime(malId), queryFn: () => api.anime(malId), enabled: malId > 0 })
  const title = useAnimeTitle()
  useDocumentTitle(data ? title(data.anime) : undefined)

  if (isPending) return <AnimePageSkeleton single={cachedEpisodeCount(queryClient, malId) === 1} />
  if (isError || !data) {
    return (
      <Page>
        <EmptyState mood="error" title={t('anime.notFound')} description={error?.message} />
      </Page>
    )
  }

  const path = animePath(data.anime.malId, data.anime.title)
  return (
    <div className="relative isolate -mt-(--header-h) pt-(--header-h)">
      {location.pathname !== path ? <Navigate to={{ pathname: path, search: location.search, hash: location.hash }} state={location.state} replace /> : null}
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 -z-10 h-[35rem] overflow-hidden', backdrop === 'glow' ? 'backdrop-glow' : '[mask-image:linear-gradient(to_bottom,black_30%,transparent)]')}>
        {data.anime.imageUrl ? <img src={data.anime.imageUrl} alt="" className="h-full w-full scale-110 object-cover object-[50%_25%] opacity-50 blur-xl" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/50 to-background/20" />
      </div>
      <Header anime={data.anime} entry={data.entry} />
      <Page>
        <ScreenshotsSection malId={data.anime.malId} />
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{t('anime.streaming')}</h2>
        <WatchSection anime={data.anime} entry={data.entry} />
        <FriendsOnAnime malId={data.anime.malId} total={data.anime.episodes} />
        <NotesSection malId={data.anime.malId} />
        <AnimeExtrasSections malId={data.anime.malId} />
      </Page>
    </div>
  )
}
