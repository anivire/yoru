import { cn } from '@yoru/ui'

interface AvatarUser {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export function nameOf(user: Pick<AvatarUser, 'username' | 'displayName'>) {
  return user.displayName || user.username
}

export function UserAvatar({ user, className }: { user: AvatarUser; className?: string }) {
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className={cn('size-9 shrink-0 rounded-full bg-field object-cover', className)} />
  return (
    <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold uppercase text-accent-foreground', className)}>
      {nameOf(user).slice(0, 1)}
    </span>
  )
}
