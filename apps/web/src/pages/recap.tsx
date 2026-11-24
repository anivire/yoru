import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AnimeSummary, RecapData } from '@yoru/shared'
import { Button, EmptyState, Image, Segmented, Skeleton, cn, toast } from '@yoru/ui'
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCalendar2Fill,
  RiCheckboxCircleFill,
  RiChat3Fill,
  RiEmotionHappyFill,
  RiFireFill,
  RiFlagFill,
  RiFlashlightFill,
  RiGroupFill,
  RiHistoryFill,
  RiLinkM,
  RiMoonClearFill,
  RiNewsFill,
  RiPlayCircleFill,
  RiPriceTag3Fill,
  RiQuillPenFill,
  RiScales3Fill,
  RiSendPlaneFill,
  RiSparkling2Fill,
  RiStackFill,
  RiSunFill,
  RiTimeFill,
  RiTrophyFill,
} from '@remixicon/react'
import { type ReactNode, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { AnimeCard } from '../components/anime-cards'
import { Page, Section } from '../components/app-shell'
import { TLink } from '../components/transition-link'
import { UserAvatar, nameOf } from '../components/user-avatar'
import { api } from '../lib/api'
import { AnimeTitle, animePath, useAnimeTitle } from '../lib/anime-title'
import { useUser } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'

const COUNT_MS = 1200
const ACCENT_TEXT = 'bg-gradient-to-r from-accent to-[color-mix(in_oklab,var(--accent),white_35%)] bg-clip-text text-transparent'

function useFormat() {
  const { i18n } = useTranslation()
  const lang = i18n.language
  return {
    number: (value: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(value),
    decimal: (value: number) => new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value),
    percent: (ratio: number) => new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(Math.abs(ratio)),
    month: (month: number, style: 'long' | 'narrow' = 'long') => new Intl.DateTimeFormat(lang, { month: style }).format(new Date(2024, month - 1, 15)),
    day: (date: string) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`)),
    weekday: (index: number) => {
      const name = new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date(2024, 0, 1 + index))
      return name.charAt(0).toUpperCase() + name.slice(1)
    },
  }
}

function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(value)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_MS)
      setCurrent(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return (
    <span className="tabular-nums">
      {format(current)}
    </span>
  )
}

function Hero({ data, self, name }: { data: RecapData; self: boolean; name: string }) {
  const { t } = useTranslation()
  const f = useFormat()
  const delta = data.previous?.minutes ? data.minutes / data.previous.minutes - 1 : null
  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-surface p-5 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_90%_at_0%_100%,color-mix(in_oklab,var(--accent)_30%,transparent),transparent_60%)]" />
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.08em] text-accent uppercase sm:text-[0.8125rem]">{t('recap.title')}</p>
          <h1 className="mt-2 text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
            <Trans i18nKey={self ? 'recap.heading' : 'recap.headingOf'} values={{ year: data.year, name }} components={{ y: <span className={ACCENT_TEXT} /> }} />
          </h1>
          {data.minutes >= 24 * 60 ? (
            <p className="mt-4 max-w-xs text-sm text-foreground/80">
              {t('recap.equivalent', { days: t('recap.days', { count: Math.round(data.minutes / 1440) }), movies: t('recap.movies', { count: Math.round(data.minutes / 110) }) })}
            </p>
          ) : null}
          {data.inProgress ? <p className="mt-3 max-w-xs text-xs text-muted-foreground">{t('recap.inProgress')}</p> : null}
        </div>
        <div className="flex items-baseline gap-2.5 sm:flex-col sm:items-end sm:gap-1 sm:text-right">
          <span className="text-7xl leading-none font-extrabold tracking-tighter sm:text-[7.5rem]">
            <CountUp value={Math.round(data.minutes / 60)} format={f.number} />
          </span>
          <span className="text-base font-medium whitespace-nowrap text-muted-foreground sm:text-lg">{t('recap.hoursBig')}</span>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <HeroStat icon={<RiPlayCircleFill className="text-accent" />} value={f.number(data.episodes)} label={t('recap.episodesLabel', { count: data.episodes })} />
        <HeroStat icon={<RiStackFill className="text-info" />} value={f.number(data.titles)} label={t('recap.titlesLabel', { count: data.titles })} />
        <HeroStat icon={<RiCheckboxCircleFill className="text-success" />} value={f.number(data.completed)} label={t('recap.completed')} />
        {delta !== null && Math.abs(delta) >= 0.01 ? (
          <HeroStat
            icon={delta > 0 ? <RiArrowUpLine /> : <RiArrowDownLine />}
            value={`${delta > 0 ? '+' : '−'}${f.percent(delta)}`}
            label={t('recap.vsYear', { year: data.previous!.year })}
            className={delta > 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}
          />
        ) : null}
      </div>
    </div>
  )
}

function HeroStat({ icon, value, label, className }: { icon: ReactNode; value: string; label: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-foreground/[0.06] px-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        <div className="text-xl leading-tight font-bold tracking-tight tabular-nums sm:text-2xl">{value}</div>
        <div className={cn('truncate text-xs', className ? 'opacity-80' : 'text-muted-foreground')}>{label}</div>
      </div>
      <span className="shrink-0 max-sm:hidden [&_svg]:size-5">{icon}</span>
    </div>
  )
}

function Months({ months }: { months: number[] }) {
  const { t } = useTranslation()
  const f = useFormat()
  const max = Math.max(1, ...months)
  const peak = months.indexOf(max)
  return (
    <Section title={t('recap.peakMonth', { month: f.month(peak + 1) })} hint={t('recap.peakMonthHint', { count: max })} icon={<RiCalendar2Fill />}>
      <div className="rounded-xl bg-surface p-4 sm:p-5">
        <div className="flex h-36 items-end gap-1.5 sm:h-44 sm:gap-2">
          {months.map((count, i) => (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <div className={cn('w-full rounded-t-md rounded-b-sm', i === peak ? 'bg-accent' : 'bg-foreground/[0.12]')} style={{ height: count ? `max(4px, ${(count / max) * 100}%)` : 2 }} title={`${f.month(i + 1)}: ${count}`} />
              <span className="text-[0.6875rem] text-subtle-foreground uppercase">{f.month(i + 1, 'narrow')}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

function Top({ top }: { top: RecapData['top'] }) {
  const { t } = useTranslation()
  if (!top.length) return null
  return (
    <Section title={t('recap.top')} hint={t('recap.topHint')} icon={<RiTrophyFill />}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5">
        {top.map((item, i) => (
          <div key={item.anime.malId} className="relative">
            <span className={cn('pointer-events-none absolute -left-1.5 -top-1.5 z-10 grid size-7 place-items-center rounded-full text-xs font-bold tabular-nums shadow-md', i === 0 ? 'bg-accent text-accent-foreground' : 'bg-popover text-foreground')}>{i + 1}</span>
            <AnimeCard anime={item.anime} userScore={item.score} coloredScore subtitle={t('recap.episodesShort', { count: item.episodes })} />
          </div>
        ))}
      </div>
    </Section>
  )
}

function Genres({ data }: { data: RecapData }) {
  const { t } = useTranslation()
  const genres = data.genres
  const genre = genres[0]?.name
  if (!genre) return null
  const previous = data.previous?.genre
  const hint = previous ? (previous === genre ? t('recap.sameGenre', { genre }) : t('recap.newGenre', { from: previous, year: data.previous!.year })) : t('recap.genreHint')
  const max = genres[0]!.share
  return (
    <Section title={t('recap.genre', { genre })} hint={hint} icon={<RiPriceTag3Fill />}>
      <ul className="flex flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5">
        {genres.map((g) => (
          <li key={g.name} className="grid grid-cols-[minmax(0,7rem)_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate">{g.name}</span>
            <span className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(3, (g.share / max) * 100)}%` }} />
            </span>
            <span className="text-right text-[0.8125rem] text-muted-foreground tabular-nums">{Math.round(g.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Fact({ icon, tone, title, hint }: { icon: ReactNode; tone: string; title: ReactNode; hint: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface p-4">
      <span className={cn('grid size-9 place-items-center rounded-xl [&_svg]:size-[1.125rem]', tone)}>{icon}</span>
      <div>
        <div className="text-base font-semibold tracking-tight sm:text-lg">{title}</div>
        <div className="text-[0.8125rem] text-muted-foreground">{hint}</div>
      </div>
    </div>
  )
}

function Habits({ habits, fresh }: { habits: RecapData['habits']; fresh: RecapData['fresh'] }) {
  const { t } = useTranslation()
  const f = useFormat()
  const title = useAnimeTitle()
  const percent = (share: number) => Math.round(share * 100)
  const facts: ReactNode[] = []
  if (habits.nightShare !== null && habits.nightShare >= 0.5) facts.push(<Fact key="owl" icon={<RiMoonClearFill />} tone="bg-info-soft text-info" title={t('recap.owl')} hint={t('recap.owlHint', { percent: percent(habits.nightShare) })} />)
  else if (habits.morningShare !== null && habits.morningShare >= 0.4) facts.push(<Fact key="lark" icon={<RiSunFill />} tone="bg-warning-soft text-warning" title={t('recap.lark')} hint={t('recap.larkHint', { percent: percent(habits.morningShare) })} />)
  else if (habits.peakHour !== null) facts.push(<Fact key="hour" icon={<RiTimeFill />} tone="bg-accent-soft text-accent" title={t('recap.peakHour', { hour: String(habits.peakHour).padStart(2, '0') })} hint={t('recap.peakHourHint')} />)
  if (habits.streak && habits.streak.days > 1) facts.push(<Fact key="streak" icon={<RiFireFill />} tone="bg-danger-soft text-danger" title={t('recap.streak', { count: habits.streak.days })} hint={t('recap.streakHint', { date: f.day(habits.streak.end) })} />)
  if (habits.marathon) facts.push(<Fact key="marathon" icon={<RiFlashlightFill />} tone="bg-warning-soft text-warning" title={t('recap.marathon', { count: habits.marathon.episodes })} hint={t('recap.marathonHint', { date: f.day(habits.marathon.date) })} />)
  if (habits.weekday !== null) facts.push(<Fact key="weekday" icon={<RiCalendar2Fill />} tone="bg-success-soft text-success" title={f.weekday(habits.weekday)} hint={t('recap.weekdayHint')} />)
  if (fresh) {
    const delay = fresh.fastest.minutes < 60 ? t('recap.inMinutes', { count: fresh.fastest.minutes }) : t('recap.inHours', { count: Math.round(fresh.fastest.minutes / 60) })
    facts.push(<Fact key="fresh" icon={<RiNewsFill />} tone="bg-accent-soft text-accent" title={t('recap.freshEpisodes', { count: fresh.episodes })} hint={t('recap.freshHint')} />)
    facts.push(<Fact key="fastest" icon={<RiFlagFill />} tone="bg-info-soft text-info" title={t('recap.fastest', { delay })} hint={t('recap.fastestHint', { title: title(fresh.fastest.anime), episode: fresh.fastest.episode })} />)
  }
  if (!facts.length) return null
  return (
    <Section title={t('recap.habits')} icon={<RiTimeFill />}>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">{facts}</div>
    </Section>
  )
}

function TitleTile({ label, anime, note }: { label: string; anime: AnimeSummary; note: string }) {
  return (
    <TLink to={animePath(anime.malId, anime.title)} className="group flex min-w-0 items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-muted">
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">{anime.imageUrl ? <Image src={anime.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold transition-colors group-hover:text-accent"><AnimeTitle anime={anime} /></div>
        <div className="truncate text-xs text-muted-foreground">{note}</div>
      </div>
    </TLink>
  )
}

function Bookends({ bookends }: { bookends: RecapData['bookends'] }) {
  const { t } = useTranslation()
  const f = useFormat()
  if (!bookends) return null
  return (
    <Section title={t('recap.bookends')} icon={<RiHistoryFill />}>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <TitleTile label={t('recap.firstTitle')} anime={bookends.first.anime} note={f.day(bookends.first.date)} />
        <TitleTile label={t('recap.lastTitle')} anime={bookends.last.anime} note={f.day(bookends.last.date)} />
      </div>
    </Section>
  )
}

function Critic({ critic }: { critic: RecapData['critic'] }) {
  const { t } = useTranslation()
  const f = useFormat()
  if (!critic) return null
  const value = f.decimal(Math.abs(critic.diff))
  const verdict = Math.abs(critic.diff) < 0.3 ? t('recap.criticSame') : critic.diff < 0 ? t('recap.criticStricter', { value }) : t('recap.criticKinder', { value })
  return (
    <Section title={t('recap.critic')} hint={t('recap.criticHint', { count: critic.count })} icon={<RiScales3Fill />}>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="flex flex-col justify-center gap-1 rounded-xl bg-accent-soft p-4">
          <div className="text-lg font-semibold tracking-tight">{verdict}</div>
          <div className="text-[0.8125rem] text-foreground/80">{t('recap.criticNote')}</div>
        </div>
        {critic.find ? <TitleTile label={t('recap.find')} anime={critic.find.anime} note={t('recap.findNote', { score: critic.find.score, community: f.decimal(critic.find.community) })} /> : null}
      </div>
    </Section>
  )
}

function Eras({ eras }: { eras: RecapData['eras'] }) {
  const { t } = useTranslation()
  const title = useAnimeTitle()
  if (!eras) return null
  return (
    <Section title={t('recap.eras')} hint={t('recap.erasHint')} icon={<RiSparkling2Fill />}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Fact icon={<RiCalendar2Fill />} tone="bg-accent-soft text-accent" title={String(eras.averageYear)} hint={t('recap.averageYear')} />
        <Fact icon={<RiHistoryFill />} tone="bg-warning-soft text-warning" title={String(eras.oldest.anime.year ?? '')} hint={t('recap.oldest', { title: title(eras.oldest.anime) })} />
        <Fact icon={<RiSparkling2Fill />} tone="bg-success-soft text-success" title={`${Math.round(eras.freshShare * 100)}%`} hint={t('recap.freshShare')} />
      </div>
    </Section>
  )
}

function Community({ community }: { community: RecapData['community'] }) {
  const { t } = useTranslation()
  const f = useFormat()
  if (!community) return null
  const tiles = [
    { key: 'comments', value: community.comments, icon: <RiChat3Fill />, tone: 'bg-info-soft text-info' },
    { key: 'notes', value: community.notes, icon: <RiQuillPenFill />, tone: 'bg-accent-soft text-accent' },
    { key: 'reactions', value: community.reactions, icon: <RiEmotionHappyFill />, tone: 'bg-warning-soft text-warning' },
    { key: 'recommendations', value: community.recommendations, icon: <RiSendPlaneFill />, tone: 'bg-success-soft text-success' },
  ] as const
  return (
    <Section title={t('recap.community')} icon={<RiGroupFill />}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {tiles.map((tile) => (
          <Fact key={tile.key} icon={tile.icon} tone={tile.tone} title={f.number(tile.value)} hint={t(`recap.communityLabels.${tile.key}`)} />
        ))}
      </div>
    </Section>
  )
}

function Friends({ friends }: { friends: RecapData['friends'] }) {
  const { t } = useTranslation()
  if (!friends.length) return null
  return (
    <Section title={t('recap.friends')} hint={t('recap.friendsHint')} icon={<RiGroupFill />}>
      <div className="flex flex-col gap-1 rounded-xl bg-surface p-2 sm:p-3">
        {friends.map((f) => (
          <TLink key={f.user.id} to={`/u/${f.user.username}`} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-foreground/[0.04]">
            <UserAvatar user={f.user} className="size-10" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{nameOf(f.user)}</div>
              <div className="text-xs text-muted-foreground">{t('recap.common', { count: f.common })}</div>
            </div>
            {f.match !== null ? <span className="text-xl font-bold text-accent tabular-nums">{f.match}%</span> : <span className="text-xs text-subtle-foreground">{t('recap.fewScores')}</span>}
          </TLink>
        ))}
      </div>
    </Section>
  )
}

function RecapSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <Skeleton className="h-72 rounded-3xl sm:h-80" />
      <Skeleton className="h-52 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

export function RecapView({ data, username, self, name }: { data: RecapData; username: string; self: boolean; name: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const copy = () => void navigator.clipboard?.writeText(window.location.href).then(() => toast.success(t('common.copied')))
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {data.years.length > 1 ? (
          <Segmented size="sm" value={String(data.year)} onChange={(year) => navigate(`/u/${username}/recap/${year}`, { replace: true })} options={[...data.years].reverse().map((y) => ({ value: String(y), label: y }))} />
        ) : (
          <span />
        )}
        <Button variant="secondary" size="sm" onClick={copy}>
          <RiLinkM />
          {t('recap.share')}
        </Button>
      </div>
      <Hero data={data} self={self} name={name} />
      <div className="mt-10">
        <Months months={data.months} />
        <Top top={data.top} />
        <Bookends bookends={data.bookends} />
        <Genres data={data} />
        <Critic critic={data.critic} />
        <Eras eras={data.eras} />
        <Habits habits={data.habits} fresh={data.fresh} />
        <Friends friends={data.friends} />
        <Community community={data.community} />
      </div>
      <div className="mt-10 flex justify-center">
        <Button asChild variant="ghost" size="sm">
          <TLink to={`/u/${username}?tab=stats`}>{t('recap.allStats')}</TLink>
        </Button>
      </div>
    </>
  )
}

export function RecapPage() {
  const { t } = useTranslation()
  const params = useParams()
  const username = params.username ?? ''
  const year = Number(params.year) || null
  const user = useUser()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const recap = useQuery({ queryKey: ['profile', username, 'recap', year, tz], queryFn: () => api.profileRecap(username, year, tz), placeholderData: keepPreviousData })
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => api.profile(username) })
  const self = user.username === username
  const name = profile.data ? nameOf(profile.data.user) : username
  useDocumentTitle(recap.data ? t('recap.titleYear', { year: recap.data.year }) : t('recap.title'))
  return (
    <Page>
      <div className="grow-empty mx-auto w-full max-w-3xl">
        {recap.isPending ? (
          <RecapSkeleton />
        ) : recap.isError ? (
          <EmptyState mood="error" title={t('common.error')} description={recap.error.message} action={<Button onClick={() => recap.refetch()}>{t('common.retry')}</Button>} />
        ) : !recap.data ? (
          <EmptyState mood="sleepy" title={t('recap.empty')} description={t('recap.emptyHint')} />
        ) : (
          <RecapView data={recap.data} username={username} self={self} name={name} />
        )}
      </div>
    </Page>
  )
}
