import { useQuery } from '@tanstack/react-query'
import type { AnimeDetails } from '@yoru/shared'
import { Badge, EmptyState, Image, cn } from '@yoru/ui'
import { RiCalendarScheduleFill, RiClapperboardFill, RiStarFill } from '@remixicon/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Page } from '../components/app-shell'
import { ListEditor } from '../components/list-editor'
import { LinkButton, LinkGroup, ServiceLinks } from '../components/service-links'
import { AnimePageSkeleton } from '../components/skeletons'
import { WatchSection } from '../components/watch-section'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import { formatDate, formatDateTime, relativeTime, seasonLabel, typeLabel } from '../lib/format'
import { keys } from '../lib/queries'

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
    <div ref={wrapRef} className={cn('flex max-w-3xl flex-col gap-1', !open && 'sm:min-h-0 sm:flex-1 sm:basis-0')}>
      <p
        ref={textRef}
        className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/80"
        style={open ? undefined : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden' }}
      >
        {text}
      </p>
      {(open ? text.length > 280 : overflows) ? (
        <button type="button" onClick={onToggle} className="cursor-pointer self-start text-[13px] font-medium text-foreground hover:text-accent">
          {open ? t('anime.less') : t('anime.more')}
        </button>
      ) : null}
    </div>
  )
}

function Header({ anime, listButton }: { anime: AnimeDetails; listButton: React.ReactNode }) {
  const { t } = useTranslation()
  const { expandSynopsis } = useAppearance()
  const [open, setOpen] = useState(expandSynopsis)
  const meta = [typeLabel(anime.type), anime.episodes ? `${anime.episodes} ${t('common.episodes')}` : null, anime.duration, seasonLabel(anime)].filter(Boolean)
  const facts = [
    anime.studios.length ? { label: t('anime.studios'), value: anime.studios.join(', ') } : null,
    anime.airedFrom ? { label: t('anime.aired'), value: `${formatDate(anime.airedFrom)}${anime.airedTo ? ` — ${formatDate(anime.airedTo)}` : ''}` } : null,
    anime.rating ? { label: t('anime.rating'), value: anime.rating } : null,
  ].filter((f) => f !== null)
  return (
    <div className="relative isolate -mt-(--header-h) overflow-hidden pt-(--header-h)">
      <div className="absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-hidden">
        {anime.imageUrl ? <img src={anime.imageUrl} alt="" className="h-full w-full scale-110 object-cover object-[50%_25%] opacity-50 blur-xl" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
      </div>
      <div className="mx-auto max-w-(--page-max) px-4 pb-10 pt-4 sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-3 self-start sm:w-48">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-2xl">
              {anime.imageUrl ? <Image src={anime.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            {listButton}
            <LinkGroup>
              <ServiceLinks malId={anime.malId} />
              {anime.trailerUrl ? (
                <LinkButton href={anime.trailerUrl} icon={<RiClapperboardFill />}>
                  {t('anime.trailer')}
                </LinkButton>
              ) : null}
            </LinkGroup>
          </div>
          <div className={cn('flex min-w-0 flex-1 flex-col gap-3', !open && 'sm:h-72')}>
            <div>
              <h1 className="line-clamp-2 text-3xl font-semibold tracking-tight sm:text-4xl">{anime.title}</h1>
              {anime.titleEnglish && anime.titleEnglish !== anime.title ? <div className="mt-1 truncate text-lg text-muted-foreground">{anime.titleEnglish}</div> : null}
              {anime.titleJapanese ? <div className="truncate text-sm text-subtle-foreground">{anime.titleJapanese}</div> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {anime.score ? (
                <Badge variant="warning">
                  <RiStarFill className="fill-current" />
                  {anime.score.toFixed(2)}
                </Badge>
              ) : null}
              {anime.status ? <Badge variant={anime.airing ? 'success' : 'neutral'}>{t(`airing.${anime.status}`, { defaultValue: anime.status })}</Badge> : null}
              {meta.map((m) => (
                <span key={m} className="text-muted-foreground">
                  {m}
                </span>
              ))}
            </div>
            {anime.nextAiringAt ? (
              <div className="inline-flex items-center gap-2 text-sm">
                <RiCalendarScheduleFill className="size-4 text-accent" />
                <span>{anime.latestEpisode ? t('anime.nextEpisode', { episode: anime.latestEpisode + 1, when: relativeTime(anime.nextAiringAt) }) : t('anime.nextAiring', { when: relativeTime(anime.nextAiringAt) })}</span>
                <span className="dotted-underline font-mono text-xs text-muted-foreground">{formatDateTime(anime.nextAiringAt)}</span>
              </div>
            ) : null}
            {anime.genres.length ? (
              <div className="flex flex-wrap gap-1.5">
                {anime.genres.map((g) => (
                  <span key={g} className="inline-flex h-6 items-center rounded-full bg-foreground/10 px-2.5 text-xs font-medium text-foreground/90 backdrop-blur-sm">
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
            {anime.synopsis ? <Synopsis text={anime.synopsis} open={open} onToggle={() => setOpen(!open)} /> : null}
          </div>
        </div>
        {facts.length ? (
          <div className="mt-6 flex flex-wrap justify-end gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
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

  if (isPending) return <AnimePageSkeleton />
  if (isError || !data) {
    return (
      <Page>
        <EmptyState mood="error" title={t('anime.notFound')} description={error?.message} />
      </Page>
    )
  }

  return (
    <>
      <Header
        anime={data.anime}
        listButton={
          <ListEditor
            malId={malId}
            entry={data.entry}
            total={data.anime.episodes}
            aired={data.anime.status === 'finished' ? data.anime.episodes : data.anime.status === 'upcoming' ? 0 : data.anime.latestEpisode}
          />
        }
      />
      <Page>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{t('anime.streaming')}</h2>
        <WatchSection anime={data.anime} entry={data.entry} />
      </Page>
    </>
  )
}
