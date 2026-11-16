import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UserCard, UserProfile } from '@yoru/shared'
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
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router'
import { Page } from '../components/app-shell'
import { TLink } from '../components/transition-link'
import { UserAvatar, nameOf } from '../components/user-avatar'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { errorMessage, useUser } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'
import { ActivityFeed } from './feed'
import { ListBrowser } from './shared-list'
import { StatsSkeleton, StatsView, StatusStrip } from './stats'

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
      <div className="h-28 rounded-2xl bg-linear-to-br from-accent/45 via-accent/15 to-transparent sm:h-36" />
      <div className="-mt-12 flex flex-wrap items-end gap-4 px-2 sm:-mt-14 sm:px-5">
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
        {!profile.restricted ? <span>{t('profile.friendsCount', { count: profile.friends })}</span> : null}
      </div>
    </header>
  )
}

function FriendGrid({ username }: { username: string }) {
  const { t } = useTranslation()
  const friends = useQuery({ queryKey: ['profile', username, 'friends'], queryFn: () => api.profileFriends(username) })
  if (friends.isPending) return <Skeleton className="h-32 rounded-xl" />
  if (!friends.data?.length) return <EmptyState mood="sleepy" title={t('profile.noFriends')} />
  return <UserGrid users={friends.data} />
}

export function UserGrid({ users, action }: { users: UserCard[]; action?: (user: UserCard) => ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2">
      {users.map((user) => (
        <div key={user.id} className="flex items-center gap-3 rounded-xl bg-surface p-3">
          <TLink to={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar user={user} className="size-10" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{nameOf(user)}</span>
              <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
            </span>
          </TLink>
          {action?.(user)}
        </div>
      ))}
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
  return (
    <div className="flex flex-col gap-10">
      {profile.statuses ? <StatusStrip statuses={profile.statuses} /> : null}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{t('profile.activity')}</h2>
        <ActivityFeed
          queryKey={['profile', profile.user.username, 'feed']}
          fetchPage={(before) => api.profileFeed(profile.user.username, before)}
          empty={<EmptyState mood="sleepy" title={t('profile.noActivity')} />}
        />
      </section>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div>
      <Skeleton className="h-28 rounded-2xl sm:h-36" />
      <div className="-mt-12 flex items-end gap-4 px-2 sm:-mt-14 sm:px-5">
        <Skeleton className="size-24 rounded-full ring-4 ring-background sm:size-28" />
        <div className="flex flex-col gap-2 pb-1">
          <Skeleton className="h-7 w-48 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
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
  const available: Record<Tab, boolean> = { overview: true, list: Boolean(data?.canSeeList), stats: Boolean(data?.canSeeStats), friends: true }
  const tab = available[requested] ? requested : 'overview'
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
                  { value: 'friends', label: t('profile.tabs.friends'), icon: <RiGroupFill />, count: data.friends },
                ]}
              />
              {tab === 'overview' ? (
                <Overview profile={data} />
              ) : tab === 'list' ? (
                <ListBrowser queryKey={['profile', username, 'list']} fetchPage={(p) => api.profileList(username, p)} />
              ) : tab === 'stats' ? (
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
