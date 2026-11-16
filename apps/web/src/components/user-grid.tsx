import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PersonCard } from '@yoru/shared'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Skeleton, Tooltip, toast } from '@yoru/ui'
import { RiCheckboxCircleFill, RiCheckFill, RiCloseFill, RiGroupFill, RiMore2Fill, RiPlayCircleFill, RiUserAddFill, RiUserUnfollowFill } from '@remixicon/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TLink } from './transition-link'
import { UserAvatar, nameOf } from './user-avatar'
import { api } from '../lib/api'
import { errorMessage } from '../lib/queries'

function PersonMenu({ user }: { user: PersonCard }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const options = {
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['friends'] })
      void client.invalidateQueries({ queryKey: ['profile'] })
      void client.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e: Error) => toast.error(errorMessage(e, t)),
  }
  const add = useMutation({ mutationFn: () => api.addFriend(user.id), ...options })
  const remove = useMutation({ mutationFn: () => api.removeFriend(user.id), ...options })
  if (user.relation === 'self') return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('profile.more')} loading={add.isPending || remove.isPending}>
          <RiMore2Fill />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {user.relation === 'friend' ? (
          <DropdownMenuItem onSelect={() => remove.mutate()} className="text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger">
            <RiUserUnfollowFill />
            {t('profile.removeFriend')}
          </DropdownMenuItem>
        ) : null}
        {user.relation === 'none' ? (
          <DropdownMenuItem onSelect={() => add.mutate()}>
            <RiUserAddFill />
            {t('profile.addFriend')}
          </DropdownMenuItem>
        ) : null}
        {user.relation === 'incoming' ? (
          <>
            <DropdownMenuItem onSelect={() => add.mutate()}>
              <RiCheckFill />
              {t('profile.accept')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => remove.mutate()}>
              <RiCloseFill />
              {t('profile.decline')}
            </DropdownMenuItem>
          </>
        ) : null}
        {user.relation === 'outgoing' ? (
          <DropdownMenuItem onSelect={() => remove.mutate()}>
            <RiCloseFill />
            {t('profile.cancelRequest')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function UserGrid({ users, action, menu = true }: { users: PersonCard[]; action?: (user: PersonCard) => ReactNode; menu?: boolean }) {
  const { t, i18n } = useTranslation()
  const compact = new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 })
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-3">
      {users.map((user) => {
        const stats = [
          user.watching !== null ? { label: t('status.watching'), value: user.watching, icon: <RiPlayCircleFill className="text-accent" /> } : null,
          user.completed !== null ? { label: t('status.completed'), value: user.completed, icon: <RiCheckboxCircleFill className="text-success" /> } : null,
          user.friends !== null ? { label: t('profile.tabs.friends'), value: user.friends, icon: <RiGroupFill className="text-info" /> } : null,
        ].filter((stat) => stat !== null)
        return (
          <div key={user.id} className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-surface p-3 transition-colors hover:bg-muted">
            {user.banner ? <img src={user.banner} alt="" loading="lazy" className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover object-[50%_30%] opacity-25 mask-l-from-40% transition-opacity group-hover:opacity-35" /> : null}
            <TLink to={`/u/${user.username}`} className="relative flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar user={user} className="size-14 text-xl" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">{nameOf(user)}</span>
                  {user.relation === 'friend' ? <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-accent">{t('friends.isFriend')}</span> : null}
                  {user.relation === 'self' ? <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-accent">{t('profile.you')}</span> : null}
                </span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="truncate text-xs text-muted-foreground">@{user.username}</span>
                  {stats.map((stat) => (
                    <Tooltip key={stat.label} content={`${stat.label}: ${stat.value}`}>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums [&_svg]:size-3.5">
                        {stat.icon}
                        {compact.format(stat.value)}
                        <span className="sr-only">{stat.label}</span>
                      </span>
                    </Tooltip>
                  ))}
                </span>
                {user.bio ? <span className="line-clamp-1 text-xs text-muted-foreground">{user.bio}</span> : null}
              </span>
            </TLink>
            {action || (menu && user.relation !== 'self') ? (
              <div className="relative flex shrink-0 items-center gap-1.5">
                {action?.(user)}
                {menu ? <PersonMenu user={user} /> : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function UserGridSkeleton() {
  return (
    <div className="skeleton-fill grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-3">
      {Array.from({ length: 40 }, (_, i) => (
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
