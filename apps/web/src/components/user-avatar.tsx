import type { AvatarCrop } from '@yoru/shared'
import { cn } from '@yoru/ui'

interface AvatarUser {
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarCrop?: AvatarCrop | null
}

export function nameOf(user: Pick<AvatarUser, 'username' | 'displayName'>) {
  return user.displayName || user.username
}

export function UserAvatar({ user, className }: { user: AvatarUser; className?: string }) {
  const crop = user.avatarCrop
  if (user.avatarUrl && crop) {
    return (
      <span aria-hidden className={cn('relative block size-9 shrink-0 overflow-hidden rounded-full bg-field', className)}>
        <img
          src={user.avatarUrl}
          alt=""
          className="absolute max-w-none"
          style={{ left: `${-crop.x * 100}%`, top: `${-crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
        />
      </span>
    )
  }
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className={cn('size-9 shrink-0 rounded-full bg-field object-cover', className)} />
  return (
    <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold uppercase text-accent-foreground', className)}>
      {nameOf(user).slice(0, 1)}
    </span>
  )
}
