import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Image, Mascot, Popover, PopoverContent, PopoverTrigger, StatusDot, cn } from '@yoru/ui'
import { RiCheckDoubleFill, RiDeleteBin6Fill, RiNotification3Fill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { keys } from '../lib/queries'

export function NotificationsPopover() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { data } = useQuery({ queryKey: keys.notifications, queryFn: api.notifications, refetchInterval: 60_000, refetchOnWindowFocus: true })
  const refresh = () => client.invalidateQueries({ queryKey: keys.notifications })
  const readAll = useMutation({ mutationFn: () => api.readNotifications(), onSuccess: refresh })
  const clear = useMutation({ mutationFn: api.clearNotifications, onSuccess: refresh })
  const readOne = useMutation({ mutationFn: (id: number) => api.readNotifications([id]), onSuccess: refresh })
  const unread = data?.unread ?? 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('notifications.title')} className="relative rounded-full">
          <RiNotification3Fill />
          {unread ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[10px] font-semibold leading-4 text-accent-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
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
        <div className="max-h-[60vh] overflow-y-auto">
          {!data?.items.length ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
              <Mascot mood="sleepy" size={44} />
              {t('notifications.empty')}
            </div>
          ) : (
            data.items.map((n) => (
              <Link
                key={n.id}
                to={`/anime/${n.malId}?episode=${n.episode}&kind=${n.kind}`}
                onClick={() => !n.readAt && readOne.mutate(n.id)}
                className={cn('flex gap-3 px-4 py-3 hover:bg-muted', n.readAt && 'opacity-60')}
              >
                {n.imageUrl ? <Image src={n.imageUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" loading="lazy" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.readAt ? <StatusDot tone="accent" /> : null}
                    <span className="truncate text-sm font-medium">{n.animeTitle}</span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted-foreground">{t('notifications.released', { episode: n.episode })}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge size="sm" variant={n.kind === 'sub' ? 'info' : 'warning'}>
                      {t(`notifications.${n.kind}`)}
                    </Badge>
                    {n.author ? <span className="truncate text-xs text-subtle-foreground">{n.author}</span> : null}
                    <span className="ml-auto font-mono text-[11px] text-subtle-foreground">{relativeTime(n.createdAt)}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
