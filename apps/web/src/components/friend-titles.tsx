import { useQuery } from '@tanstack/react-query'
import type { FriendTitles, UserCard } from '@yoru/shared'
import { cn } from '@yoru/ui'
import { type ReactNode, createContext, useContext } from 'react'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import { UserAvatar, nameOf } from './user-avatar'

const STACK_LIMIT = 3
const EMPTY: UserCard[] = []

const FriendTitlesContext = createContext<FriendTitles>({})

export function FriendTitlesProvider({ children }: { children: ReactNode }) {
  const { friendAvatars } = useAppearance()
  const titles = useQuery({ queryKey: ['friend-titles'], queryFn: api.friendTitles, staleTime: 5 * 60_000, enabled: friendAvatars })
  return <FriendTitlesContext value={friendAvatars ? (titles.data ?? {}) : {}}>{children}</FriendTitlesContext>
}

export function useFriendsOn(malId: number) {
  return useContext(FriendTitlesContext)[malId] ?? EMPTY
}

export function FriendStack({ users, className }: { users: UserCard[]; className?: string }) {
  if (!users.length) return null
  const shown = users.slice(0, STACK_LIMIT)
  return (
    <span className={cn('flex items-center', className)} title={users.map(nameOf).join(', ')}>
      {shown.map((user) => (
        <UserAvatar key={user.id} user={user} className="-ml-1.5 size-6 text-[0.625rem] ring-4 ring-background first:ml-0" />
      ))}
      {users.length > STACK_LIMIT ? <span className="-ml-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-black/70 px-1 text-[0.625rem] font-semibold text-white ring-4 ring-background">+{users.length - STACK_LIMIT}</span> : null}
    </span>
  )
}
