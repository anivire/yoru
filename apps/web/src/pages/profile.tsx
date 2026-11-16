import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PROFILE_FAVORITES_MAX, type PersonCard, type UserProfile } from '@yoru/shared'
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
  Tooltip,
  cn,
  toast,
  useSlidingIndicator,
} from '@yoru/ui'
import {
  RiBarChart2Fill,
  RiBookShelfFill,
  RiCheckboxCircleFill,
  RiCheckFill,
  RiCloseFill,
  RiEdit2Fill,
  RiFileTextFill,
  RiForbidFill,
  RiGroupFill,
  RiImageFill,
  RiLockFill,
  RiLockUnlockFill,
  RiMore2Fill,
  RiPlayCircleFill,
  RiText,
  RiTimeFill,
  RiUserAddFill,
  RiUserFill,
  RiUserFollowFill,
} from '@remixicon/react'
import { type ReactNode, useDeferredValue, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router'
import { Page } from '../components/app-shell'
import { AnimeCard } from '../components/anime-cards'
import { PosterGridSkeleton } from '../components/skeletons'
import { TLink } from '../components/transition-link'
import { UserAvatar, nameOf } from '../components/user-avatar'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { errorMessage, useUser } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'
import { ActivityFeed, FeedSkeleton } from './feed'
import { FavoritesDialog } from '../components/favorites-editor'
import { ListBrowser } from './shared-list'
import { StatsSkeleton, StatsView } from './stats'
import { UserGrid, UserGridSkeleton } from '../components/user-grid'

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
          <DropdownMenuItem onSelect={() => actions.unblock.mutate()}>
            <RiLockUnlockFill />
            {t('profile.unblock')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => actions.block.mutate()} className="text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger">
            <RiForbidFill />
            {t('profile.block')}
          </DropdownMenuItem>
        )}
        {viewer.role === 'admin' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => actions.moderate.mutate({ avatar: true })}>
              <RiImageFill />
              {t('profile.moderate.avatar')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.moderate.mutate({ displayName: true })}>
              <RiText />
              {t('profile.moderate.displayName')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.moderate.mutate({ bio: true })}>
              <RiFileTextFill />
              {t('profile.moderate.bio')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type TabOption = { value: Tab; label: string; icon: ReactNode; count?: number; disabled?: boolean; title?: string }

function TabNav({ options, value, onChange }: { options: TabOption[]; value: Tab; onChange: (tab: Tab) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const indicator = useSlidingIndicator(ref, '[aria-selected="true"]', value)
  return (
    <div ref={ref} role="tablist" aria-orientation="vertical" className="relative -mx-2 mt-3 hidden flex-col gap-0.5 lg:flex">
      <span aria-hidden style={indicator} className="pointer-events-none absolute rounded-lg bg-muted duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            'relative flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
            option.value === value ? 'font-medium text-foreground' : 'text-muted-foreground enabled:hover:text-foreground',
          )}
        >
          {option.disabled ? <RiLockFill /> : option.icon}
          <span className="flex-1 truncate text-left">{option.label}</span>
          {option.count !== undefined ? <span className="text-xs tabular-nums text-subtle-foreground">{option.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

function TabHeader({ option }: { option?: TabOption }) {
  if (!option) return null
  return (
    <div className="mb-6 hidden items-center gap-3 lg:flex">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent [&_svg]:size-[1.125rem]">{option.icon}</span>
      <h2 className="text-xl font-semibold tracking-tight">{option.label}</h2>
    </div>
  )
}

function ProfileCard({ profile, nav }: { profile: UserProfile; nav?: ReactNode }) {
  const { t, i18n } = useTranslation()
  const compact = new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 })
  const actions = useProfileActions(profile)
  const self = profile.relation === 'self'
  const stats = [
    profile.statuses ? { label: t('status.watching'), value: profile.statuses.watching + profile.statuses.rewatching, icon: <RiPlayCircleFill className="text-accent" /> } : null,
    profile.statuses ? { label: t('status.completed'), value: profile.statuses.completed, icon: <RiCheckboxCircleFill className="text-success" /> } : null,
    profile.canSeeFriends ? { label: t('profile.tabs.friends'), value: profile.friends, icon: <RiGroupFill className="text-info" /> } : null,
  ].filter((stat) => stat !== null)
  return (
    <aside className="shrink-0 overflow-hidden rounded-2xl bg-surface lg:sticky lg:top-[calc(var(--page-top,2.5rem)*2)] lg:w-64 lg:self-start">
      <div className="relative h-24 overflow-hidden bg-linear-to-br from-accent/45 via-accent/15 to-transparent">
        {profile.banner ? <img src={profile.banner} alt="" className="absolute inset-0 size-full scale-110 object-cover object-[50%_30%] blur-[2px]" /> : null}
      </div>
      <div className="flex flex-col px-5 pb-5">
        <UserAvatar user={profile.user} className="relative -mt-10 size-20 text-2xl ring-4 ring-surface" />
        <h1 className="mt-3 truncate text-xl font-semibold tracking-tight">{nameOf(profile.user)}</h1>
        <p className="truncate text-sm text-muted-foreground">@{profile.user.username}</p>
        <p className="mt-0.5 text-[0.8125rem] text-subtle-foreground">{t('profile.joined', { date: formatDate(profile.createdAt, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
        {profile.bio ? <p className="mt-3 whitespace-pre-line text-sm">{profile.bio}</p> : null}
        <div className="-mx-2 mt-4 flex gap-2">
          {self ? (
            <Button asChild variant="secondary" className="flex-1">
              <TLink to="/settings/profile">
                <RiEdit2Fill />
                {t('profile.edit')}
              </TLink>
            </Button>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 *:flex-1 [&_button]:flex-1">
                <FriendButton profile={profile} actions={actions} />
              </div>
              <MoreMenu profile={profile} actions={actions} />
            </>
          )}
        </div>
        {stats.length ? (
          <div className="-mx-2 mt-3 grid grid-cols-3 gap-1.5">
            {stats.map((stat) => (
              <Tooltip key={stat.label} content={`${stat.label}: ${stat.value}`}>
                <span className="flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg bg-foreground/[0.04] px-1.5 text-[0.8125rem] font-semibold tabular-nums [&_svg]:size-3.5 [&_svg]:shrink-0">
                  {stat.icon}
                  <span className="truncate">{compact.format(stat.value)}</span>
                  <span className="sr-only">{stat.label}</span>
                </span>
              </Tooltip>
            ))}
          </div>
        ) : null}
        {nav}
      </div>
    </aside>
  )
}

function FriendGrid({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation()
  const username = profile.user.username
  const friends = useQuery({ queryKey: ['profile', username, 'friends'], queryFn: () => api.profileFriends(username) })
  if (friends.isPending) return <TabSkeleton tab="friends" />
  if (!friends.data?.length) return <EmptyState mood="sleepy" title={t('profile.noFriends')} />
  const mutual = profile.relation === 'self' ? [] : friends.data.filter((user) => user.relation === 'friend')
  if (!mutual.length) return <FriendCards users={friends.data} username={username} />
  const others = friends.data.filter((user) => user.relation !== 'friend')
  return (
    <div className="flex flex-col gap-8">
      <FriendSection title={t('profile.mutualFriends')} users={mutual} username={username} />
      {others.length ? <FriendSection title={t('profile.otherFriends')} users={others} username={username} /> : null}
    </div>
  )
}

function FriendSection({ title, users, username }: { title: string; users: PersonCard[]; username: string }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        {title}
        <span className="ml-1.5 font-normal tabular-nums text-subtle-foreground">{users.length}</span>
      </h2>
      <FriendCards users={users} username={username} />
    </section>
  )
}

function FriendCards({ users, username }: { users: PersonCard[]; username: string }) {
  return <UserGrid users={users} action={(user) => <FriendCardAction user={user} username={username} />} />
}

function FriendCardAction({ user, username }: { user: PersonCard; username: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const add = useMutation({
    mutationFn: () => api.addFriend(user.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['profile', username, 'friends'] })
      void client.invalidateQueries({ queryKey: ['friends'] })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  if (user.relation === 'none') {
    return (
      <Button size="sm" variant="secondary" loading={add.isPending} onClick={() => add.mutate()}>
        <RiUserAddFill />
        {t('profile.addFriend')}
      </Button>
    )
  }
  if (user.relation === 'incoming') {
    return (
      <Button size="sm" variant="accent" loading={add.isPending} onClick={() => add.mutate()}>
        <RiCheckFill />
        {t('profile.accept')}
      </Button>
    )
  }
  if (user.relation === 'outgoing') return <span className="text-xs text-muted-foreground">{t('profile.requestSent')}</span>
  return null
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
  const self = profile.relation === 'self'
  if (!self && !profile.favorites.length && !profile.canSeeActivity) return <EmptyState mood="sleepy" title={t('profile.noOverview')} />
  return (
    <div className="grow-empty flex flex-col gap-6">
      {profile.favorites.length || self ? (
        <section className="rounded-xl bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t('profile.favorites')}</h2>
            {self ? (
              <div className="-my-1.5">
                <FavoritesDialog />
              </div>
            ) : null}
          </div>
          {profile.favorites.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-4">
              {profile.favorites.map((anime) => (
                <AnimeCard key={anime.malId} anime={anime} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('profile.noFavorites', { count: PROFILE_FAVORITES_MAX })}</p>
          )}
        </section>
      ) : null}
      {profile.canSeeActivity ? (
        <section className="grow-empty">
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
      <div className="grow-empty flex flex-col gap-4">
        <Skeleton className="h-11 w-full max-w-3xl rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <PosterGridSkeleton />
      </div>
    )
  }
  if (tab === 'friends') return <UserGridSkeleton />
  return (
    <div className="grow-empty flex flex-col gap-6">
      <section className="rounded-xl bg-surface p-4 sm:p-5">
        <Skeleton className="mb-3 h-8 w-28 rounded-md" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[2/3] rounded-xl" />
              <Skeleton className="h-4 w-4/5 rounded-md" />
            </div>
          ))}
        </div>
      </section>
      <section className="grow-empty">
        <FeedSkeleton />
      </section>
    </div>
  )
}

function ProfileCardSkeleton() {
  return (
    <div className="shrink-0 overflow-hidden rounded-2xl bg-surface lg:w-64 lg:self-start">
      <Skeleton className="h-24 rounded-none" />
      <div className="flex flex-col gap-2 px-5 pb-5">
        <Skeleton className="-mt-10 size-20 shrink-0 rounded-full ring-4 ring-surface" />
        <Skeleton className="mt-1 h-6 w-40 max-w-full rounded-md" />
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="-mx-2 mt-2 h-9 rounded-lg" />
        <div className="-mx-2 mt-3 hidden flex-col gap-1.5 lg:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grow-empty flex flex-col gap-6 lg:flex-row!">
      <ProfileCardSkeleton />
      <div className="grow-empty flex min-w-0 flex-1 flex-col">
        <Skeleton className="mb-6 h-10 w-[27rem] max-w-full rounded-xl lg:hidden" />
        <Skeleton className="mb-6 hidden h-9 w-44 rounded-xl lg:block" />
        <TabSkeleton tab="overview" />
      </div>
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
  const showTabs = Boolean(data && !data.blocked && !everythingHidden && !data.restricted)
  const tabs: TabOption[] = data
    ? [
        { value: 'overview', label: t('profile.tabs.overview'), icon: <RiUserFill /> },
        { value: 'list', label: t('profile.tabs.list'), icon: <RiBookShelfFill />, disabled: !data.canSeeList, title: data.canSeeList ? undefined : t('profile.hidden') },
        { value: 'stats', label: t('profile.tabs.stats'), icon: <RiBarChart2Fill />, disabled: !data.canSeeStats, title: data.canSeeStats ? undefined : t('profile.hidden') },
        { value: 'friends', label: t('profile.tabs.friends'), icon: <RiGroupFill />, count: data.canSeeFriends ? data.friends : undefined, disabled: !data.canSeeFriends, title: data.canSeeFriends ? undefined : t('profile.hidden') },
      ]
    : []

  return (
    <Page className="sm:pt-[calc(var(--page-top,2rem)*2)]">
      {profile.isPending ? (
        <ProfileSkeleton />
      ) : profile.isError || !data ? (
        <EmptyState mood="error" title={t('profile.notFound')} />
      ) : (
        <div className="grow-empty flex flex-col gap-6 lg:flex-row!">
          <ProfileCard profile={data} nav={showTabs ? <TabNav options={tabs} value={tab} onChange={setTab} /> : null} />
          <div className="grow-empty flex min-w-0 flex-1 flex-col">
            {data.blocked ? (
              <EmptyState mood="sleepy" title={t('profile.blockedTitle')} description={t('profile.blockedHint')} />
            ) : everythingHidden ? (
              <EmptyState mood="sleepy" title={<span className="inline-flex items-center gap-1.5"><RiLockFill className="size-4" />{t('profile.hiddenTitle')}</span>} description={t('profile.hiddenHint')} />
            ) : data.restricted ? (
              <EmptyState mood="sleepy" title={<span className="inline-flex items-center gap-1.5"><RiLockFill className="size-4" />{t('profile.restrictedTitle')}</span>} description={t('profile.restrictedHint')} />
            ) : (
              <>
                <Segmented className="mb-6 lg:hidden" value={tab} onChange={setTab} options={tabs} />
                <TabHeader option={tabs.find((option) => option.value === tab)} />
                {shownTab !== tab ? (
                  <TabSkeleton tab={tab} />
                ) : shownTab === 'overview' ? (
                  <Overview profile={data} />
                ) : shownTab === 'list' ? (
                  <ListBrowser queryKey={['profile', username, 'list']} fetchPage={(p) => api.profileList(username, p)} />
                ) : shownTab === 'stats' ? (
                  <ProfileStats username={username} />
                ) : (
                  <FriendGrid profile={data} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Page>
  )
}
