import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { FeedItem, FeedPage as FeedPageData, ListStatus } from '@yoru/shared'
import { Badge, Button, EmptyState, Segmented, Skeleton, StarIcon, Tooltip, cn } from '@yoru/ui'
import { RiAddCircleFill, RiArrowDownSLine, RiArrowRightLine, RiCloseLine, RiHistoryFill, RiNotification3Fill, RiPlayCircleFill, RiStickyNoteFill } from '@remixicon/react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AnimeCard, Poster } from '../components/anime-cards'
import { Page, PageHeader } from '../components/app-shell'
import { NoteBody } from '../components/notes'
import { TLink } from '../components/transition-link'
import { CommentThread, ReactionBar } from '../components/social'
import { UserAvatar, nameOf } from '../components/user-avatar'
import { useAnimeTitle, animePath } from '../lib/anime-title'
import { api } from '../lib/api'
import { FEED_SCOPES, useAppearance } from '../lib/appearance'
import { StatusBadge, StatusIcon, StatusText } from '../lib/list-status'
import { useDocumentTitle } from '../lib/title'

const COLLAPSED = 12

interface Group {
  key: string
  items: FeedItem[]
}

interface Day {
  key: string
  date: Date
  count: number
  groups: Group[]
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function kindKey(item: FeedItem) {
  if (item.type === 'added') return `${item.user.id}:added:${item.status}`
  if (item.type === 'status') return `${item.user.id}:status:${item.to}`
  if (item.type === 'note') return `${item.user.id}:note:${item.id}`
  return `${item.user.id}:${item.type}`
}

function groupKey(item: FeedItem) {
  return item.type === 'note' ? kindKey(item) : `${item.user.id}:activity`
}

interface Change {
  id: number
  at: string
  anime: FeedItem['anime']
  episodes?: { from: number; to: number }
  from?: ListStatus | null
  to?: ListStatus
  score?: number
}

function changesOf(items: FeedItem[]): Change[] {
  const byAnime = new Map<number, Change>()
  for (const item of items) {
    if (item.type === 'note') continue
    let change = byAnime.get(item.anime.malId)
    if (!change) {
      change = { id: item.id, at: item.createdAt, anime: item.anime }
      byAnime.set(item.anime.malId, change)
    }
    if (item.type === 'episodes') change.episodes = change.episodes ? { from: Math.min(change.episodes.from, item.from), to: Math.max(change.episodes.to, item.to) } : { from: item.from, to: item.to }
    if (item.type === 'score') change.score ??= item.score
    if (item.type === 'status') {
      change.to ??= item.to
      change.from = item.from
    }
    if (item.type === 'added') {
      change.to ??= item.status
      change.from = null
    }
  }
  return [...byAnime.values()]
}

function absorb(day: Day, item: FeedItem): boolean {
  if (item.type !== 'episodes' && item.type !== 'score') return false
  for (const group of day.groups) {
    for (let i = 0; i < group.items.length; i++) {
      const other = group.items[i]!
      if (other.type !== item.type || other.anime.malId !== item.anime.malId || other.user.id !== item.user.id) continue
      if (other.type === 'score') return true
      if (other.type === 'episodes' && item.type === 'episodes' && item.to + 1 >= other.from && other.to + 1 >= item.from) {
        group.items[i] = { ...other, from: Math.min(other.from, item.from), to: Math.max(other.to, item.to) }
        return true
      }
    }
  }
  return false
}

function buildDays(items: FeedItem[]): Day[] {
  const days: Day[] = []
  for (const item of items) {
    const date = new Date(item.createdAt)
    let day = days.at(-1)
    if (day?.key !== dayKey(date)) {
      day = { key: dayKey(date), date, count: 0, groups: [] }
      days.push(day)
    }
    if (absorb(day, item)) continue
    day.count++
    const key = groupKey(item)
    const target = day.groups.find((group) => group.key === key)
    if (target) target.items.push(item)
    else day.groups.push({ key, items: [item] })
  }
  return days
}

function useGroupHeading() {
  const { t } = useTranslation()
  return (group: Group, titles: number): { icon: ReactNode; text: string; badge?: ReactNode } => {
    const first = group.items[0]!
    const many = group.items.length > 1
    if (group.items.some((item) => kindKey(item) !== kindKey(first))) return { icon: <RiHistoryFill className="text-accent" />, text: t('feed.mixed', { count: titles }) }
    if (first.type === 'added') return { icon: <RiAddCircleFill className="text-accent" />, text: t('feed.added'), badge: <StatusBadge status={first.status} /> }
    if (first.type === 'status') return { icon: <StatusIcon status={first.to} />, text: t('feed.status'), badge: <StatusBadge status={first.to} /> }
    if (first.type === 'score') return { icon: <StarIcon className="text-amber-500" />, text: many ? t('feed.scores') : t('feed.score', { score: first.score }) }
    if (first.type === 'episodes') {
      const text = many ? t('feed.watched') : first.from === first.to ? t('feed.episode', { episode: first.from }) : t('feed.episodes', { from: first.from, to: first.to })
      return { icon: <RiPlayCircleFill className="text-accent" />, text }
    }
    return { icon: <RiStickyNoteFill className="text-accent" />, text: t('feed.note') }
  }
}

function FeedCard({ change, time }: { change: Change; time?: string }) {
  const { t } = useTranslation()
  const { episodes, from, to, score } = change
  const previous = from && from !== to ? from : null
  const detail =
    episodes || to ? (
      <span className="flex flex-col gap-0.5">
        {to ? (
          <span className="flex min-w-0 items-center gap-1">
            {previous ? (
              <Tooltip content={t(`status.${previous}`)}>
                <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={t(`status.${previous}`)}>
                  <StatusIcon status={previous} className="size-3.5" />
                  <RiArrowRightLine className="size-3.5 text-subtle-foreground" />
                </span>
              </Tooltip>
            ) : null}
            <StatusText status={to} className="font-semibold" />
          </span>
        ) : null}
        {episodes ? (
          <span className="flex min-w-0 items-center gap-1 font-semibold text-accent">
            <RiPlayCircleFill className="size-3.5 shrink-0" />
            <span className="truncate">{episodes.from === episodes.to ? t('feed.episodeShort', { episode: episodes.from }) : t('feed.episodesShort', { from: episodes.from, to: episodes.to })}</span>
          </span>
        ) : null}
      </span>
    ) : score ? (
      <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
        <StarIcon className="size-3.5 shrink-0" />
        {t('feed.score', { score })}
      </span>
    ) : undefined
  return (
    <AnimeCard
      anime={change.anime}
      userScore={score}
      coloredScore={Boolean(score)}
      subtitle={detail}
      tag={time ? <Badge size="sm" variant="solid" className="bg-black/65 font-mono text-white">{time}</Badge> : undefined}
    />
  )
}

function NoteEntry({ item }: { item: Extract<FeedItem, { type: 'note' }> }) {
  const { t } = useTranslation()
  const title = useAnimeTitle()
  const { episode } = item.note
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-surface p-3">
      <TLink to={animePath(item.anime.malId, item.anime.title)} className="group flex w-fit items-center gap-2.5">
        <Poster src={item.anime.imageUrl} alt={item.anime.title} className="h-12 w-8 shrink-0 rounded-md" />
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span className="text-sm font-semibold transition-colors group-hover:text-accent">{title(item.anime)}</span>
          {episode ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              {item.anime.episodes ? t('feed.noteEpisodeOf', { episode, total: item.anime.episodes }) : t('feed.episodeShort', { episode })}
            </span>
          ) : null}
        </span>
      </TLink>
      <div className="rounded-lg bg-field px-3 py-2.5">
        <NoteBody note={{ ...item.note, episode: null }} />
      </div>
    </div>
  )
}

function GroupEntry({ group, showUser, focus }: { group: Group; showUser: boolean; focus?: { comment: number | null } }) {
  const { t, i18n } = useTranslation()
  const changes = changesOf(group.items)
  const heading = useGroupHeading()(group, changes.length)
  const [open, setOpen] = useState(false)
  const first = group.items[0]!
  const [thread, setThread] = useState(first.comments > 0 || Boolean(focus?.comment))
  const format = new Intl.DateTimeFormat(i18n.language, { ...(focus ? { day: 'numeric', month: 'long' } : {}), hour: '2-digit', minute: '2-digit' })
  const latest = format.format(new Date(first.createdAt))
  const earliest = format.format(new Date(group.items.at(-1)!.createdAt))
  const time = earliest === latest ? latest : `${earliest} – ${latest}`
  const shown = open ? changes : changes.slice(0, COLLAPSED)
  return (
    <li className="relative pb-7 pl-11 last:pb-0">
      {showUser ? (
        <TLink to={`/u/${first.user.username}`} className="absolute left-0 top-0 rounded-full ring-4 ring-background">
          <UserAvatar user={first.user} className="size-8" />
        </TLink>
      ) : (
        <span className="absolute left-0 top-0 grid size-8 place-items-center rounded-full bg-surface ring-4 ring-background [&_svg]:size-4">{heading.icon}</span>
      )}
      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-x-2 gap-y-0.5">
        {showUser ? (
          <TLink to={`/u/${first.user.username}`} className="text-sm font-semibold transition-colors hover:text-accent">
            {nameOf(first.user)}
          </TLink>
        ) : null}
        {showUser && !heading.badge ? <span className="grid size-4 place-items-center [&_svg]:size-4">{heading.icon}</span> : null}
        <span className={cn('text-sm', showUser ? 'text-muted-foreground' : 'font-semibold')}>{heading.text}</span>
        {heading.badge}
        {changes.length > 1 ? <span className="rounded-full bg-field px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{changes.length}</span> : null}
        <span className="font-mono text-xs text-subtle-foreground">{time}</span>
      </div>
      {first.type === 'note' ? (
        <NoteEntry item={first} />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-4">
            {shown.map((change) => (
              <FeedCard key={change.id} change={change} time={changes.length > 1 ? format.format(new Date(change.at)) : undefined} />
            ))}
          </div>
          {changes.length > COLLAPSED ? (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(!open)}>
              {open ? t('feed.collapse') : t('feed.showAll', { count: changes.length })}
            </Button>
          ) : null}
        </>
      )}
      <ReactionBar eventId={first.id} reactions={first.reactions} comments={first.comments} commentsOpen={thread} onComments={() => setThread(!thread)} />
      {thread ? <CommentThread target={first.type === 'note' ? 'note' : 'event'} id={first.type === 'note' ? first.note.id : first.id} focus={focus?.comment} /> : null}
    </li>
  )
}

function DayHeader({ day, open, onToggle }: { day: Day; open: boolean; onToggle: () => void }) {
  const { t, i18n } = useTranslation()
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const relative = dayKey(day.date) === dayKey(today) ? t('feed.today') : dayKey(day.date) === dayKey(yesterday) ? t('feed.yesterday') : null
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', ...(day.date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }).format(day.date)
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(day.date)
  return (
    <div className="relative mb-5 flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center">
        <span className="size-3 rounded-full bg-accent ring-4 ring-background" />
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 border-b border-border pb-2 text-left"
      >
        <span className="grid size-6 shrink-0 self-center place-items-center rounded-md text-muted-foreground transition-colors group-hover:bg-field group-hover:text-foreground" title={t(open ? 'feed.collapseDay' : 'feed.expandDay')}>
          <RiArrowDownSLine className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        </span>
        <span className="text-lg font-semibold tracking-tight">{relative ?? date}</span>
        <span className="truncate text-[0.8125rem] text-muted-foreground">{relative ? `${date}, ${weekday}` : weekday}</span>
        <span className="ml-auto shrink-0 text-xs text-subtle-foreground">{t('feed.eventsCount', { count: day.count })}</span>
      </button>
    </div>
  )
}

function DaySection({ day, showUser }: { day: Day; showUser: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <section className={cn('relative last:mb-0', open ? 'mb-12' : 'mb-6')}>
      <DayHeader day={day} open={open} onToggle={() => setOpen(!open)} />
      {open ? (
        <ol>
          {day.groups.map((group) => (
            <GroupEntry key={`${group.key}:${group.items[0]!.id}`} group={group} showUser={showUser} />
          ))}
        </ol>
      ) : null}
    </section>
  )
}

function FocusedEvent({ id, comment, onClose }: { id: number; comment: number | null; onClose: () => void }) {
  const { t } = useTranslation()
  const event = useQuery({ queryKey: ['feed', 'event', id], queryFn: () => api.feedEvent(id), retry: false })
  return (
    <section className="mb-10 rounded-2xl bg-surface p-4 ring-1 ring-accent/30 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <RiNotification3Fill className="size-4 text-accent" />
        <span className="text-sm font-semibold">{t('feed.focus')}</span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose}>
          <RiCloseLine />
          {t('feed.focusClose')}
        </Button>
      </div>
      {event.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : event.data ? (
        <ol>
          <GroupEntry group={{ key: 'focus', items: [event.data] }} showUser focus={{ comment }} />
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{t('feed.focusMissing')}</p>
      )}
    </section>
  )
}

export function FeedSkeleton() {
  return (
    <div className="skeleton-fill relative">
      <span aria-hidden className="absolute bottom-0 left-4 top-4 w-px -translate-x-1/2 bg-border" />
      {[[3, 1], [2], [4, 2], [1, 3], [2, 2]].map((groups, i) => (
        <section key={i} className="relative mb-12 last:mb-0">
          <div className="relative mb-5 flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center">
              <span className="size-3 rounded-full bg-muted ring-4 ring-background" />
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-border pb-2">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="ml-auto h-3.5 w-16 rounded-md" />
            </div>
          </div>
          <ol>
            {groups.map((cards, j) => (
              <li key={j} className="relative pb-7 pl-11 last:pb-0">
                <span className="absolute left-0 top-0 size-8 rounded-full bg-background ring-4 ring-background">
                  <Skeleton className="size-8 rounded-full" />
                </span>
                <div className="mb-3 flex min-h-8 items-center gap-2">
                  <Skeleton className="h-4 w-44 rounded-md" />
                  <Skeleton className="h-3.5 w-10 rounded-md" />
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-4">
                  {Array.from({ length: cards }, (_, k) => (
                    <div key={k} className="flex flex-col gap-2">
                      <Skeleton className="aspect-[2/3] rounded-xl" />
                      <Skeleton className="h-4 w-4/5 rounded-md" />
                      <Skeleton className="h-3 w-1/2 rounded-md" />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

export function ActivityFeed({ queryKey, fetchPage, showUser = false, empty }: { queryKey: readonly unknown[]; fetchPage: (before: string | undefined) => Promise<FeedPageData>; showUser?: boolean; empty: ReactNode }) {
  const { t } = useTranslation()
  const feed = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
  })
  const items = feed.data?.pages.flatMap((p) => p.items) ?? []
  const days = buildDays(items)
  if (feed.isPending) return <FeedSkeleton />
  if (feed.isError) return <EmptyState mood="error" title={t('common.error')} description={feed.error.message} action={<Button onClick={() => feed.refetch()}>{t('common.retry')}</Button>} />
  if (!items.length) return empty
  return (
    <div className="relative">
      <span aria-hidden className="absolute bottom-0 left-4 top-4 w-px -translate-x-1/2 bg-border" />
      {days.map((day) => (
        <DaySection key={day.key} day={day} showUser={showUser} />
      ))}
      {feed.hasNextPage ? (
        <div className="relative flex justify-center pt-8">
          <Button variant="secondary" loading={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            {t('search.more')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function FeedPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('feed.title'))
  const { feedScope } = useAppearance()
  const [scope, setScope] = useState(feedScope)
  const [params, setParams] = useSearchParams()
  const focusEvent = Number(params.get('event')) || null
  const focusComment = Number(params.get('comment')) || null
  return (
    <Page>
      <div className="grow-empty w-full">
        <PageHeader
          title={t('feed.title')}
          description={t('feed.description')}
          actions={
            <Segmented
              value={scope}
              onChange={setScope}
              options={FEED_SCOPES.map((value) => ({ value, label: t(`feed.scopes.${value}`) }))}
            />
          }
        />
        {focusEvent ? <FocusedEvent key={`${focusEvent}:${focusComment}`} id={focusEvent} comment={focusComment} onClose={() => setParams({}, { replace: true })} /> : null}
        <ActivityFeed
          key={scope}
          queryKey={['feed', scope]}
          fetchPage={(before) => api.feed({ before, scope })}
          showUser={scope !== 'me'}
          empty={scope === 'friends' ? <EmptyState mood="sleepy" title={t('feed.friendsEmpty')} description={t('feed.friendsEmptyHint')} /> : <EmptyState mood="sleepy" title={t('feed.empty')} description={t('feed.emptyHint')} />}
        />
      </div>
    </Page>
  )
}
