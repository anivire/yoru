import { useInfiniteQuery } from '@tanstack/react-query'
import type { FeedItem, FeedPage as FeedPageData } from '@yoru/shared'
import { Button, EmptyState, Segmented, Skeleton, StarIcon, cn } from '@yoru/ui'
import { RiAddCircleFill, RiArrowDownSLine, RiPlayCircleFill, RiStickyNoteFill } from '@remixicon/react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimeCard } from '../components/anime-cards'
import { Page, PageHeader } from '../components/app-shell'
import { NoteBody } from '../components/notes'
import { TLink } from '../components/transition-link'
import { CommentThread, ReactionBar } from '../components/social'
import { UserAvatar, nameOf } from '../components/user-avatar'
import { useAnimeTitle } from '../lib/anime-title'
import { api } from '../lib/api'
import { StatusIcon } from '../lib/list-status'
import { useDocumentTitle } from '../lib/title'

const COLLAPSED = 12
const MERGE_WINDOW_MS = 60 * 60_000

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

function groupKey(item: FeedItem) {
  if (item.type === 'added') return `${item.user.id}:added:${item.status}`
  if (item.type === 'status') return `${item.user.id}:status:${item.to}`
  if (item.type === 'note') return `${item.user.id}:note:${item.id}`
  return `${item.user.id}:${item.type}`
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
    const time = date.getTime()
    let target: Group | undefined
    for (let i = day.groups.length - 1; i >= 0; i--) {
      const group = day.groups[i]!
      if (Date.parse(group.items.at(-1)!.createdAt) - time > MERGE_WINDOW_MS) break
      if (group.key === key) {
        target = group
        break
      }
    }
    if (target) target.items.push(item)
    else day.groups.push({ key, items: [item] })
  }
  return days
}

function useGroupHeading() {
  const { t } = useTranslation()
  return (group: Group): { icon: ReactNode; text: string } => {
    const first = group.items[0]!
    const many = group.items.length > 1
    if (first.type === 'added') return { icon: <RiAddCircleFill className="text-accent" />, text: t('feed.added', { status: t(`status.${first.status}`) }) }
    if (first.type === 'status') return { icon: <StatusIcon status={first.to} />, text: first.to === 'completed' ? t('feed.completed') : t('feed.status', { status: t(`status.${first.to}`) }) }
    if (first.type === 'score') return { icon: <StarIcon className="text-amber-500" />, text: many ? t('feed.scores') : t('feed.score', { score: first.score }) }
    if (first.type === 'episodes') {
      const text = many ? t('feed.watched') : first.from === first.to ? t('feed.episode', { episode: first.from }) : t('feed.episodes', { from: first.from, to: first.to })
      return { icon: <RiPlayCircleFill className="text-accent" />, text }
    }
    return { icon: <RiStickyNoteFill className="text-accent" />, text: first.type === 'note' && first.note.episode ? t('feed.noteEpisode', { episode: first.note.episode }) : t('feed.note') }
  }
}

function FeedCard({ item }: { item: FeedItem }) {
  const { t } = useTranslation()
  if (item.type === 'score') return <AnimeCard anime={item.anime} userScore={item.score} coloredScore />
  if (item.type === 'episodes') {
    return <AnimeCard anime={item.anime} subtitle={item.from === item.to ? t('feed.episodeShort', { episode: item.from }) : t('feed.episodesShort', { from: item.from, to: item.to })} />
  }
  return <AnimeCard anime={item.anime} />
}

function NoteEntry({ item }: { item: Extract<FeedItem, { type: 'note' }> }) {
  const title = useAnimeTitle()
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-surface p-3">
      <TLink to={`/anime/${item.anime.malId}`} className="w-fit text-sm font-medium transition-colors hover:text-accent">
        {title(item.anime)}
      </TLink>
      <div className="rounded-lg bg-field px-3 py-2.5">
        <NoteBody note={{ ...item.note, episode: null }} />
      </div>
    </div>
  )
}

function GroupEntry({ group, showUser }: { group: Group; showUser: boolean }) {
  const { t, i18n } = useTranslation()
  const heading = useGroupHeading()(group)
  const [open, setOpen] = useState(false)
  const [thread, setThread] = useState(false)
  const first = group.items[0]!
  const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(first.createdAt))
  const shown = open ? group.items : group.items.slice(0, COLLAPSED)
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
        {showUser ? <span className="grid size-4 place-items-center [&_svg]:size-4">{heading.icon}</span> : null}
        <span className={cn('text-sm', showUser ? 'text-muted-foreground' : 'font-semibold')}>{heading.text}</span>
        {group.items.length > 1 ? <span className="rounded-full bg-field px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{group.items.length}</span> : null}
        <span className="font-mono text-xs text-subtle-foreground">{time}</span>
      </div>
      {first.type === 'note' ? (
        <NoteEntry item={first} />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-4">
            {shown.map((item) => (
              <FeedCard key={item.id} item={item} />
            ))}
          </div>
          {group.items.length > COLLAPSED ? (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(!open)}>
              {open ? t('feed.collapse') : t('feed.showAll', { count: group.items.length })}
            </Button>
          ) : null}
        </>
      )}
      <ReactionBar eventId={first.id} reactions={first.reactions} mine={first.myReaction} comments={first.comments} commentsOpen={thread} onComments={() => setThread(!thread)} />
      {thread ? <CommentThread target={first.type === 'note' ? 'note' : 'event'} id={first.type === 'note' ? first.note.id : first.id} /> : null}
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

export function FeedSkeleton() {
  return (
    <div className="relative">
      <span aria-hidden className="absolute bottom-0 left-4 top-4 w-px -translate-x-1/2 bg-border" />
      {[[3, 1], [2]].map((groups, i) => (
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
  const [scope, setScope] = useState<'me' | 'friends'>('me')
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
              options={[
                { value: 'me', label: t('feed.scopes.me') },
                { value: 'friends', label: t('feed.scopes.friends') },
              ]}
            />
          }
        />
        <ActivityFeed
          key={scope}
          queryKey={['feed', scope]}
          fetchPage={(before) => api.feed({ before, scope })}
          showUser={scope === 'friends'}
          empty={scope === 'friends' ? <EmptyState mood="sleepy" title={t('feed.friendsEmpty')} description={t('feed.friendsEmptyHint')} /> : <EmptyState mood="sleepy" title={t('feed.empty')} description={t('feed.emptyHint')} />}
        />
      </div>
    </Page>
  )
}
