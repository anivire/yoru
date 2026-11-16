import { useQuery } from '@tanstack/react-query'
import { Button, EmptyState, Image, Skeleton, toast } from '@yoru/ui'
import { RiArrowLeftSLine, RiGroupFill } from '@remixicon/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Page } from '../components/app-shell'
import { TLink } from '../components/transition-link'
import { WatchSection } from '../components/watch-section'
import { BetaBadge, RoomPanel } from '../components/watch-together'
import { useAnimeTitle, animePath } from '../lib/anime-title'
import { api } from '../lib/api'
import { keys } from '../lib/queries'
import { type Room, useRoom } from '../lib/rooms'
import { cue } from '../lib/sounds'
import { useDocumentTitle } from '../lib/title'
import { InviteFriendsButton } from '../components/social'

function useRoomArrivals(room: Room) {
  const { t } = useTranslation()
  const seenRef = useRef<Set<number> | null>(null)
  const ids = room.members.map((m) => m.id).join(',')
  useEffect(() => {
    if (room.status !== 'open') return
    const current = new Set(ids ? ids.split(',').map(Number) : [])
    const seen = seenRef.current
    seenRef.current = current
    if (!seen) {
      cue('notifications', 'ready')
      return
    }
    const arrived = room.members.filter((m) => !seen.has(m.id))
    if (!arrived.length) return
    cue('notifications', 'chime')
    for (const m of arrived) toast(t('room.joined', { name: m.username }))
  }, [room.status, ids])
}

export function RoomPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const title = useAnimeTitle()
  const info = useQuery({ queryKey: ['room', id], queryFn: () => api.room(id), retry: false, staleTime: Infinity })
  const malId = info.data?.malId ?? 0
  const details = useQuery({ queryKey: keys.anime(malId), queryFn: () => api.anime(malId), enabled: malId > 0 })
  const room = useRoom(info.data ? id : null)
  useRoomArrivals(room)
  const anime = details.data?.anime
  useDocumentTitle(anime ? `${t('room.title')} · ${title(anime)}` : t('room.title'))

  if (info.isError || room.status === 'missing') {
    return (
      <Page>
        <EmptyState
          mood="sleepy"
          title={t('room.missing')}
          description={t('room.missingHint')}
          action={
            <Button asChild variant="accent">
              <TLink to="/">{t('room.home')}</TLink>
            </Button>
          }
        />
      </Page>
    )
  }

  return (
    <Page>
      <div className="mb-5 flex items-center gap-4 sm:mt-(--page-top,2rem)">
        {anime?.imageUrl ? (
          <TLink to={animePath(malId, anime?.title)} className="hidden h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-muted sm:block">
            <Image src={anime.imageUrl} alt="" className="h-full w-full object-cover" />
          </TLink>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-accent">
            <RiGroupFill className="size-4" />
            {t('room.title')}
            <BetaBadge />
          </div>
          {anime ? (
            <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight">{title(anime)}</h1>
          ) : (
            <Skeleton className="mt-1.5 h-7 w-64 rounded-md" />
          )}
          {anime ? (
            <TLink to={animePath(malId, anime?.title)} className="mt-0.5 inline-flex items-center text-[0.8125rem] text-muted-foreground hover:text-foreground">
              <RiArrowLeftSLine className="size-4" />
              {t('room.toAnime')}
            </TLink>
          ) : null}
        </div>
        <InviteFriendsButton roomId={id} className="shrink-0" />
      </div>
      <div className="mb-5">
        <RoomPanel room={room} roomId={id} onLeave={() => navigate(malId ? animePath(malId, anime?.title) : '/')} />
      </div>
      {details.data ? <WatchSection anime={details.data.anime} entry={details.data.entry} room={room} /> : <Skeleton className="aspect-video w-full rounded-xl" />}
    </Page>
  )
}
