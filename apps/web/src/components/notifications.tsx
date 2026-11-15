import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Image, Mascot, Popover, PopoverContent, PopoverTrigger, StatusDot, cn } from '@yoru/ui'
import { RiCheckDoubleFill, RiDeleteBin6Fill, RiNotification3Fill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { keys } from '../lib/queries'
import { cue } from '../lib/sounds'
import { useEffect, useRef } from 'react'
import { TLink } from './transition-link'
import { AnimeTitle } from '../lib/anime-title'
import { RailLabel, RailTip, useRailButton } from './rail'

export function useNotificationSound() {
  const { data } = useQuery({ queryKey: keys.notifications, queryFn: api.notifications, refetchInterval: 60_000, refetchOnWindowFocus: true })
  const previous = useRef<number | null>(null)
  const unread = data?.unread
  useEffect(() => {
    if (unread === undefined) return
    if (previous.current !== null && unread > previous.current) cue('notifications', 'bubble')
    previous.current = unread
  }, [unread])
}

export function NotificationsPopover({ side = 'bottom', rail = false }: { side?: 'top' | 'bottom' | 'left' | 'right'; rail?: boolean }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { data } = useQuery({ queryKey: keys.notifications, queryFn: api.notifications, refetchInterval: 60_000, refetchOnWindowFocus: true })
  const refresh = () => client.invalidateQueries({ queryKey: keys.notifications })
  const readAll = useMutation({ mutationFn: () => api.readNotifications(), onSuccess: refresh })
  const clear = useMutation({ mutationFn: api.clearNotifications, onSuccess: refresh })
  const readOne = useMutation({ mutationFn: (id: number) => api.readNotifications([id]), onSuccess: refresh })
  const unread = data?.unread ?? 0
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
    <Popover>
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
            <Button size="icon-sm" variant="ghost" onClick={() => clear.mutate()} disabled={!data?.items.length} aria-label={t('notifications.clear')}>
              <RiDeleteBin6Fill />
            </Button>
          </div>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto p-1.5">
          {!data?.items.length ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
              <Mascot mood="sleepy" size={44} />
              {t('notifications.empty')}
            </div>
          ) : (
            data.items.map((n) => (
              <TLink
                key={n.id}
                to={`/anime/${n.malId}?episode=${n.episode}&kind=${n.kind}`}
                onClick={() => !n.readAt && readOne.mutate(n.id)}
                className={cn('flex gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted', n.readAt && 'opacity-60')}
              >
                {n.imageUrl ? <Image src={n.imageUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" loading="lazy" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.readAt ? <StatusDot tone="accent" /> : null}
                    <span className="truncate text-sm font-medium"><AnimeTitle anime={n.titles} /></span>
                  </div>
                  <div className="mt-0.5 text-[0.8125rem] text-muted-foreground">{n.type === 'premiere' ? t('notifications.premiere') : t('notifications.released', { episode: n.episode })}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {n.type === 'premiere' ? (
                      <Badge size="sm" variant="accent">
                        {t('notifications.premiereBadge')}
                      </Badge>
                    ) : null}
                    <Badge size="sm" variant={n.kind === 'sub' ? 'info' : 'warning'}>
                      {t(`notifications.${n.kind}`)}
                    </Badge>
                    {n.author ? <span className="truncate text-xs text-subtle-foreground">{n.author}</span> : null}
                    <span className="ml-auto font-mono text-[0.6875rem] text-subtle-foreground">{relativeTime(n.createdAt)}</span>
                  </div>
                </div>
              </TLink>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
