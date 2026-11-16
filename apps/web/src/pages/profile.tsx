import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PersonCard, UserProfile } from '@yoru/shared'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Segmented,
  Skeleton,
  toast,
} from '@yoru/ui'
import {
  RiBarChart2Fill,
  RiBookShelfFill,
  RiCheckFill,
  RiCloseFill,
  RiEdit2Fill,
  RiForbidFill,
  RiGroupFill,
  RiLockFill,
  RiMore2Fill,
  RiTimeFill,
  RiUserAddFill,
  RiUserFill,
  RiUserFollowFill,
} from '@remixicon/react'
import { type ReactNode, useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router'
import { Page } from '../components/app-shell'
import { AnimeCard } from '../components/anime-cards'
import { TasteMatchCard } from '../components/social'
import { PosterGridSkeleton } from '../components/skeletons'
import { TLink } from '../components/transition-link'
import { UserAvatar, nameOf } from '../components/user-avatar'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { errorMessage, useUser } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'
import { ActivityFeed, FeedSkeleton } from './feed'
import { ListBrowser } from './shared-list'
import { StatsSkeleton, StatsView } from './stats'

const TABS = ['overview', 'list', 'stats', 'friends'] as const
type Tab = (typeof TABS)[number]

function useProfileActions(profile: UserProfile) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['profile', profile.user.username] })
    void client.invalidateQueries({ queryKey: ['friends'] })
  }
  const options = { onSuccess: refresh, onError: (e: Error) => toast.error(errorMessage(e, t)) }
  return {
    add: useMutation({ mutationFn: () => api.addFriend(profile.user.id), ...options }),
    remove: useMutation({ mutationFn: () => api.removeFriend(profile.user.id), ...options }),
    block: useMutation({ mutationFn: () => api.blockUser(profile.user.id), ...options }),
    unblock: useMutation({ mutationFn: () => api.unblockUser(profile.user.id), ...options }),
    moderate: useMutation({ mutationFn: (body: { avatar?: boolean; bio?: boolean; displayName?: boolean }) => api.moderateUser(profile.user.id, body), ...options }),
  }
}

function FriendButton({ profile, actions }: { profile: UserProfile; actions: ReturnType<typeof useProfileActions> }) {
  const { t } = useTranslation()
  if (profile.blocked) return null
  if (profile.relation === 'none') {
    return (
      <Button variant="accent" loading={actions.add.isPending} onClick={() => actions.add.mutate()}>
        <RiUserAddFill />
        {t('profile.addFriend')}
      </Button>
    )
  }
  if (profile.relation === 'outgoing') {
    return (
      <Button variant="secondary" loading={actions.remove.isPending} onClick={() => actions.remove.mutate()}>
        <RiTimeFill />
        {t('profile.requestSent')}
      </Button>
    )
  }
  if (profile.relation === 'incoming') {
    return (
      <div className="flex gap-2">
        <Button variant="accent" loading={actions.add.isPending} onClick={() => actions.add.mutate()}>
          <RiCheckFill />
          {t('profile.accept')}
        </Button>
        <Button variant="secondary" loading={actions.remove.isPending} onClick={() => actions.remove.mutate()}>
          <RiCloseFill />
          {t('profile.decline')}
        </Button>
      </div>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <RiUserFollowFill />
          {t('profile.friends')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => actions.remove.mutate()} className="text-danger data-[highlighted]:bg-danger-soft">
          {t('profile.removeFriend')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MoreMenu({ profile, actions }: { profile: UserProfile; actions: ReturnType<typeof useProfileActions> }) {
  const { t } = useTranslation()
  const viewer = useUser()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('profile.more')}>
          <RiMore2Fill />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        {profile.blocked ? (
          <DropdownMenuItem onSelect={() => actions.unblock.mutate()}>{t('profile.unblock')}</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => actions.block.mutate()} className="text-danger data-[highlighted]:bg-danger-soft">
            <RiForbidFill />
            {t('profile.block')}
          </DropdownMenuItem>
        )}
        {viewer.role === 'admin' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => actions.moderate.mutate({ avatar: true })}>{t('profile.moderate.avatar')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.moderate.mutate({ displayName: true })}>{t('profile.moderate.displayName')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.moderate.mutate({ bio: true })}>{t('profile.moderate.bio')}</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProfileHeader({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation()
  const actions = useProfileActions(profile)
  const self = profile.relation === 'self'
  return (
    <header className="mb-8">
      <div className="relative h-28 overflow-hidden rounded-2xl bg-linear-to-br from-accent/45 via-accent/15 to-transparent sm:h-44">
        {profile.banner ? (
          <>
            <img src={profile.banner} alt="" className="absolute inset-0 size-full scale-110 object-cover object-[50%_30%] blur-sm" />
            <div className="absolute inset-0 bg-linear-to-t from-background/80 via-background/20 to-transparent" />
          </>
        ) : null}
      </div>
      <div className="relative z-10 -mt-12 flex flex-wrap items-end gap-4 px-2 sm:-mt-14 sm:px-5">
        <UserAvatar user={profile.user} className="size-24 text-3xl ring-4 ring-background sm:size-28" />
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{nameOf(profile.user)}</h1>
          <p className="text-sm text-muted-foreground">@{profile.user.username}</p>
        </div>
        <div className="flex items-center gap-2 pb-1">
          {self ? (
            <Button asChild variant="secondary">
              <TLink to="/settings/profile">
                <RiEdit2Fill />
                {t('profile.edit')}
              </TLink>
            </Button>
          ) : (
            <>
              <FriendButton profile={profile} actions={actions} />
              <MoreMenu profile={profile} actions={actions} />
            </>
          )}
        </div>
      </div>
      {profile.bio ? <p className="mt-4 max-w-2xl whitespace-pre-line px-2 text-[0.9375rem] sm:px-5">{profile.bio}</p> : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-[0.8125rem] text-muted-foreground sm:px-5">
        <span>{t('profile.joined', { date: formatDate(profile.createdAt, { month: 'long', year: 'numeric' }) })}</span>
        {profile.canSeeFriends ? <span>{t('profile.friendsCount', { count: profile.friends })}</span> : null}
      </div>
    </header>
  )
}

function FriendGrid({ username }: { username: string }) {
  const { t } = useTranslation()
  const friends = useQuery({ queryKey: ['profile', username, 'friends'], queryFn: () => api.profileFriends(username) })
  if (friends.isPending) return <TabSkeleton tab="friends" />
  if (!friends.data?.length) return <EmptyState mood="sleepy" title={t('profile.noFriends')} />
  return <UserGrid users={friends.data} />
}

export function UserGrid({ users, action }: { users: PersonCard[]; action?: (user: PersonCard) => ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-3">
      {users.map((user) => {
        const stats = [user.titles !== null ? t('friends.titlesCount', { count: user.titles }) : null, user.friends !== null ? t('profile.friendsCount', { count: user.friends }) : null].filter(Boolean)
        return (
          <div key={user.id} className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-surface p-3 transition-colors hover:bg-muted">
            {user.banner ? <img src={user.banner} alt="" loading="lazy" className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover object-[50%_30%] opacity-25 mask-l-from-40% transition-opacity group-hover:opacity-35" /> : null}
            <TLink to={`/u/${user.username}`} className="relative flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar user={user} className="size-14 text-xl" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">{nameOf(user)}</span>
                  {user.relation === 'friend' ? <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-accent">{t('friends.isFriend')}</span> : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  @{user.username}
                  {stats.length ? <span className="text-subtle-foreground"> · {stats.join(' · ')}</span> : null}
                </span>
                {user.bio ? <span className="line-clamp-1 text-xs text-muted-foreground">{user.bio}</span> : null}
              </span>
            </TLink>
            {action ? <div className="relative flex shrink-0 gap-1.5">{action(user)}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

function ProfileStats({ username }: { username: string }) {
  const { t } = useTranslation()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const stats = useQuery({ queryKey: ['profile', username, 'stats'], queryFn: () => api.profileStats(username, tz) })
  if (stats.isPending) return <StatsSkeleton />
  if (stats.isError) return <EmptyState mood="error" title={t('common.error')} />
  return stats.data.totals.titles ? <StatsView stats={stats.data} /> : <EmptyState mood="sleepy" title={t('stats.empty')} />
}

function Overview({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation()
  if (!profile.favorites.length && !profile.canSeeActivity && !(profile.relation !== 'self' && profile.canSeeList)) return <EmptyState mood="sleepy" title={t('profile.noOverview')} />
  return (
    <div className="grow-empty flex flex-col gap-10">
      {profile.favorites.length ? (
        <section className="rounded-xl bg-surface p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">{t('profile.favorites')}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-4">
            {profile.favorites.map((anime) => (
              <AnimeCard key={anime.malId} anime={anime} />
            ))}
          </div>
        </section>
      ) : null}
      {profile.relation !== 'self' && profile.canSeeList ? <TasteMatchCard username={profile.user.username} /> : null}
      {profile.canSeeActivity ? (
        <section className="grow-empty">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">{t('profile.activity')}</h2>
          <ActivityFeed
            queryKey={['profile', profile.user.username, 'feed']}
            fetchPage={(before) => api.profileFeed(profile.user.username, before)}
            empty={<EmptyState mood="sleepy" title={t('profile.noActivity')} />}
          />
        </section>
      ) : null}
    </div>
  )
}

function TabSkeleton({ tab }: { tab: Tab }) {
  if (tab === 'stats') return <StatsSkeleton />
  if (tab === 'list') {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-full max-w-3xl rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <PosterGridSkeleton />
      </div>
    )
  }
  if (tab === 'friends') return <UserGridSkeleton />
  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-xl bg-surface p-4 sm:p-5">
        <Skeleton className="mb-3 h-5 w-28 rounded-md" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[2/3] rounded-xl" />
              <Skeleton className="h-4 w-4/5 rounded-md" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <Skeleton className="mb-4 h-6 w-48 rounded-md" />
        <FeedSkeleton />
      </section>
    </div>
  )
}

export function UserGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-surface p-3">
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div>
      <header className="mb-8">
        <Skeleton className="h-28 rounded-2xl sm:h-44" />
        <div className="relative z-10 -mt-12 flex flex-wrap items-end gap-4 px-2 sm:-mt-14 sm:px-5">
          <Skeleton className="size-24 rounded-full ring-4 ring-background sm:size-28" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
            <Skeleton className="h-7 w-48 max-w-full rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
          <div className="flex gap-2 pb-1">
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
        </div>
        <div className="mt-4 flex max-w-2xl flex-col gap-2 px-2 sm:px-5">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
        <div className="mt-3 flex gap-4 px-2 sm:px-5">
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-20 rounded-md" />
        </div>
      </header>
      <Skeleton className="mb-6 h-10 w-full max-w-lg rounded-xl" />
      <TabSkeleton tab="overview" />
    </div>
  )
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { username = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => api.profile(username), retry: false })
  useDocumentTitle(profile.data ? nameOf(profile.data.user) : null)
  const data = profile.data
  const requested = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview'
  const available: Record<Tab, boolean> = { overview: true, list: Boolean(data?.canSeeList), stats: Boolean(data?.canSeeStats), friends: Boolean(data?.canSeeFriends) }
  const everythingHidden = Boolean(data && data.relation !== 'self' && !data.canSeeList && !data.canSeeStats && !data.canSeeFriends && !data.canSeeActivity && !data.favorites.length)
  const tab = available[requested] ? requested : 'overview'
  const shownTab = useDeferredValue(tab)
  const setTab = (next: Tab) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true })

  return (
    <Page>
      {profile.isPending ? (
        <ProfileSkeleton />
      ) : profile.isError || !data ? (
        <EmptyState mood="error" title={t('profile.notFound')} />
      ) : (
        <>
          <ProfileHeader profile={data} />
          {data.blocked ? (
            <EmptyState mood="sleepy" title={t('profile.blockedTitle')} description={t('profile.blockedHint')} />
          ) : everythingHidden ? (
            <EmptyState mood="sleepy" title={<span className="inline-flex items-center gap-2"><RiLockFill className="size-5" />{t('profile.hiddenTitle')}</span>} description={t('profile.hiddenHint')} />
          ) : data.restricted ? (
            <EmptyState mood="sleepy" title={<span className="inline-flex items-center gap-2"><RiLockFill className="size-5" />{t('profile.restrictedTitle')}</span>} description={t('profile.restrictedHint')} />
          ) : (
            <>
              <Segmented
                className="mb-6"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'overview', label: t('profile.tabs.overview'), icon: <RiUserFill /> },
                  { value: 'list', label: t('profile.tabs.list'), icon: <RiBookShelfFill />, disabled: !data.canSeeList, title: data.canSeeList ? undefined : t('profile.hidden') },
                  { value: 'stats', label: t('profile.tabs.stats'), icon: <RiBarChart2Fill />, disabled: !data.canSeeStats, title: data.canSeeStats ? undefined : t('profile.hidden') },
                  { value: 'friends', label: t('profile.tabs.friends'), icon: <RiGroupFill />, count: data.canSeeFriends ? data.friends : undefined, disabled: !data.canSeeFriends, title: data.canSeeFriends ? undefined : t('profile.hidden') },
                ]}
              />
              {shownTab !== tab ? (
                <TabSkeleton tab={tab} />
              ) : shownTab === 'overview' ? (
                <Overview profile={data} />
              ) : shownTab === 'list' ? (
                <ListBrowser queryKey={['profile', username, 'list']} fetchPage={(p) => api.profileList(username, p)} />
              ) : shownTab === 'stats' ? (
                <ProfileStats username={username} />
              ) : (
                <FriendGrid username={username} />
              )}
            </>
          )}
        </>
      )}
    </Page>
  )
}
