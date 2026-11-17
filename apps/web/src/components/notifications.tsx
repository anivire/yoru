import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DataSourceId, Notification, SocialNotification } from '@yoru/shared'
import { Badge, Button, Image, Mascot, Popover, PopoverContent, PopoverTrigger, Skeleton, StatusDot, cn } from '@yoru/ui'
import { RiCheckDoubleFill, RiDeleteBin6Fill, RiNotification3Fill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { keys } from '../lib/queries'
import { cue } from '../lib/sounds'
import { useEffect, useRef, useState } from 'react'
import { TLink } from './transition-link'
import { AnimeTitle, animePath } from '../lib/anime-title'
import { RailLabel, RailTip, useRailButton } from './rail'
import { UserAvatar, nameOf } from './user-avatar'
import { SOURCE_NAMES } from './source-logo'


function useUnread() {
  return useQuery({ queryKey: keys.notificationsUnread, queryFn: api.unreadNotifications, refetchInterval: 60_000, refetchOnWindowFocus: true }).data?.unread
}

export function useNotificationSound() {
  const previous = useRef<number | null>(null)
  const unread = useUnread()
  useEffect(() => {
    if (unread === undefined) return
    if (previous.current !== null && unread > previous.current) cue('notifications', 'ping')
    previous.current = unread
  }, [unread])
}

function socialLink(n: SocialNotification) {
  if (n.type === 'friend_request') return '/friends'
  if (n.type === 'friend_accepted' || n.type === 'invite_accepted') return `/u/${n.actor.username}`
  if (n.type === 'recommendation' && n.malId) return animePath(n.malId)
  if (n.type === 'room_invite' && n.text) return `/together/${n.text}`
  const comment = n.type === 'comment' && n.refId ? `&comment=${n.refId}` : ''
  if (n.target?.type === 'note' && n.malId) return `${animePath(n.malId)}?note=${n.target.id}${comment}`
  if (n.target?.type === 'event') return `/feed?event=${n.target.id}${comment}`
  return '/feed'
}

function SocialItem({ n, onOpen }: { n: SocialNotification; onOpen: () => void }) {
  const { t } = useTranslation()
  const name = nameOf(n.actor)
  return (
    <TLink to={socialLink(n)} onClick={onOpen} className={cn('flex gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted', n.readAt && 'opacity-60')}>
      <UserAvatar user={n.actor} className="size-10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {!n.readAt ? <StatusDot tone="accent" className="mt-1.5" /> : null}
          <span className="text-sm">{t(`notifications.social.${n.type}`, { name, emoji: n.text ?? '' })}</span>
        </div>
        {n.titles ? (
          <div className="mt-0.5 truncate text-[0.8125rem] font-medium text-muted-foreground">
            <AnimeTitle anime={n.titles} />
          </div>
        ) : null}
        {n.type !== 'reaction' && n.type !== 'room_invite' && n.text ? <p className="mt-1 line-clamp-2 text-[0.8125rem] text-muted-foreground">{n.text}</p> : null}
        <div className="mt-1 font-mono text-[0.6875rem] text-subtle-foreground">{relativeTime(n.createdAt)}</div>
      </div>
      {n.imageUrl ? <Image src={n.imageUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" loading="lazy" /> : null}
    </TLink>
  )
}

export function NotificationsPopover({ side = 'bottom', rail = false }: { side?: 'top' | 'bottom' | 'left' | 'right'; rail?: boolean }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const unread = useUnread() ?? 0
  const { data } = useQuery({ queryKey: [...keys.notificationsList, unread], queryFn: api.notifications, enabled: open, staleTime: 0, placeholderData: keepPreviousData })
  const refresh = () => client.invalidateQueries({ queryKey: keys.notifications })
  const readAll = useMutation({ mutationFn: () => api.readNotifications(), onSuccess: refresh })
  const clear = useMutation({ mutationFn: api.clearNotifications, onSuccess: refresh })
  const readOne = useMutation({ mutationFn: (id: number) => api.readNotifications({ ids: [id] }), onSuccess: refresh })
  const readSocial = useMutation({ mutationFn: (id: number) => api.readNotifications({ socialIds: [id] }), onSuccess: refresh })
  const entries: ({ kind: 'episode'; n: Notification } | { kind: 'social'; n: SocialNotification })[] = [
    ...(data?.items ?? []).map((n) => ({ kind: 'episode' as const, n })),
    ...(data?.social ?? []).map((n) => ({ kind: 'social' as const, n })),
  ].sort((a, b) => b.n.createdAt.localeCompare(a.n.createdAt))
  const railButton = useRailButton()

  const trigger = (
    <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label={t('notifications.title')}
          className={rail ? railButton + ' bg-transparent hover:bg-transparent' : 'relative rounded-full'}
        >
          <RiNotification3Fill />
          {rail ? <RailLabel>{t('notifications.title')}</RailLabel> : null}
          {unread ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[0.625rem] font-semibold leading-4 text-accent-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {rail && side !== 'bottom' ? (
        <RailTip label={t('notifications.title')} side={side}>
          {trigger}
        </RailTip>
      ) : (
        trigger
      )}
      <PopoverContent className="w-[min(24rem,calc(100vw-1.5rem))] p-0" side={side} align="end" collisionPadding={12}>
        <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
          <span className="px-1 text-sm font-medium">{t('notifications.title')}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => readAll.mutate()} disabled={!unread}>
              <RiCheckDoubleFill />
              {t('notifications.readAll')}
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => clear.mutate()} disabled={!entries.length} aria-label={t('notifications.clear')}>
              <RiDeleteBin6Fill />
            </Button>
          </div>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto p-1.5">
          {!data ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3 px-2.5 py-2.5">
                <Skeleton className="h-14 w-10 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col gap-1.5 pt-1">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
              </div>
            ))
          ) : !entries.length ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
              <Mascot mood="sleepy" size={44} />
              {t('notifications.empty')}
            </div>
          ) : (
            entries.map((entry) => {
              if (entry.kind === 'social') return <SocialItem key={`s${entry.n.id}`} n={entry.n} onOpen={() => !entry.n.readAt && readSocial.mutate(entry.n.id)} />
              const n = entry.n
              return (
              <TLink
                key={n.id}
                to={n.kind === 'raw' ? animePath(n.malId) : `${animePath(n.malId)}?episode=${n.episode}&kind=${n.kind}`}
                onClick={() => !n.readAt && readOne.mutate(n.id)}
                className={cn('flex gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted', n.readAt && 'opacity-60')}
              >
                {n.imageUrl ? <Image src={n.imageUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" loading="lazy" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.readAt ? <StatusDot tone="accent" /> : null}
                    <span className="truncate text-sm font-medium"><AnimeTitle anime={n.titles} /></span>
                  </div>
                  <div className="mt-0.5 text-[0.8125rem] text-muted-foreground">{n.type === 'premiere' ? t('notifications.premiere') : n.type === 'aired' ? t('notifications.aired', { episode: n.episode }) : t('notifications.released', { episode: n.episode })}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {n.type === 'premiere' ? (
                      <Badge size="sm" variant="accent">
                        {t('notifications.premiereBadge')}
                      </Badge>
                    ) : null}
                    <Badge size="sm" variant={n.kind === 'raw' ? 'neutral' : n.kind === 'sub' ? 'info' : 'warning'}>
                      {n.kind === 'raw' ? t('notifications.airedBadge') : t(`notifications.${n.kind}`)}
                    </Badge>
                    <span className="truncate text-xs text-subtle-foreground">{[n.source ? (SOURCE_NAMES[n.source as DataSourceId] ?? n.source) : null, n.author].filter(Boolean).join(' · ')}</span>
                    <span className="ml-auto font-mono text-[0.6875rem] text-subtle-foreground">{relativeTime(n.createdAt)}</span>
                  </div>
                </div>
              </TLink>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
