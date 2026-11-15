import { Button, Tooltip, cn, toast } from '@yoru/ui'
import { RiLinkM, RiLogoutBoxRLine } from '@remixicon/react'
import { type RefObject, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Room, roomUrl } from '../lib/rooms'

const ACTION_MS = 6000

export function BetaBadge({ className }: { className?: string }) {
  return <span className={cn('inline-flex h-4 shrink-0 items-center rounded-full bg-accent-soft px-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-accent', className)}>Beta</span>
}

export function copyRoomLink(id: string, message: string) {
  void navigator.clipboard?.writeText(roomUrl(id)).then(() => toast.success(message))
}

function useRecentAction(room: Room) {
  const [now, setNow] = useState(() => Date.now())
  const at = room.action?.at
  useEffect(() => {
    if (!at) return
    setNow(Date.now())
    const timer = window.setTimeout(() => setNow(Date.now()), ACTION_MS + 50)
    return () => window.clearTimeout(timer)
  }, [at])
  return room.action && now - room.action.at < ACTION_MS ? room.action : null
}

export function RoomPanel({ room, roomId, onLeave }: { room: Room; roomId: string; onLeave: () => void }) {
  const { t } = useTranslation()
  const action = useRecentAction(room)
  const status = room.status === 'open' ? null : t(`room.${room.status}`)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-accent-soft px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cn('size-2.5 shrink-0 rounded-full', room.status === 'open' ? 'bg-success' : 'animate-pulse bg-warning')} />
        <span className="min-w-0 truncate text-sm text-foreground/80">
          {status ?? (action ? t(`room.action.${action.kind}`, { name: action.by.username }) : t('room.members', { count: room.members.length }))}
        </span>
      </div>
      {room.status === 'open' ? (
        <div className="flex items-center -space-x-1.5">
          {room.members.slice(0, 8).map((m) => (
            <Tooltip key={m.id} content={m.username}>
              <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold uppercase text-accent-foreground ring-2 ring-accent-soft">
                {m.username.slice(0, 1)}
              </span>
            </Tooltip>
          ))}
          {room.members.length > 8 ? <span className="pl-3 text-xs text-muted-foreground">+{room.members.length - 8}</span> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="accent" onClick={() => copyRoomLink(roomId, t('room.copied'))}>
          <RiLinkM />
          {t('room.copy')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onLeave}>
          <RiLogoutBoxRLine />
          {t('room.leave')}
        </Button>
      </div>
    </div>
  )
}

const READY_STATES = ['NOTHING', 'METADATA', 'CURRENT', 'FUTURE', 'ENOUGH']

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex min-w-0 justify-between gap-3">
      <span className="text-subtle-foreground">{label}</span>
      <span className={cn('truncate text-right', warn ? 'text-warning' : 'text-foreground/80')}>{value}</span>
    </div>
  )
}

export function RoomDebug({ room, container }: { room: Room; container: RefObject<HTMLElement | null> }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 500)
    return () => window.clearInterval(timer)
  }, [])
  const video = container.current?.querySelector('video') ?? null
  const playback = room.playback
  const now = Date.now() + room.offset
  const target = playback ? playback.position + (playback.playing ? (Math.max(0, now - playback.at) / 1000) * playback.rate : 0) : null
  const local = video?.currentTime ?? null
  const drift = target !== null && local !== null ? local - target : null
  const buffered = video && video.buffered.length ? video.buffered.end(video.buffered.length - 1) - video.currentTime : null
  const fmt = (n: number | null, digits = 2) => (n === null || !Number.isFinite(n) ? '-' : n.toFixed(digits))
  return (
    <details className="mt-3 rounded-xl bg-surface px-4 py-3 font-mono text-[0.6875rem]" open>
      <summary className="cursor-pointer select-none font-sans text-xs font-medium text-muted-foreground">Debug</summary>
      <div className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        <Row label="status" value={room.status} warn={room.status !== 'open'} />
        <Row label="rtt" value={room.rtt === null ? '-' : `${room.rtt} ms`} warn={(room.rtt ?? 0) > 300} />
        <Row label="clock offset" value={`${room.offset} ms`} />
        <Row label="messages" value={String(room.messages)} />
        <Row label="reconnects" value={String(room.reconnects)} warn={room.reconnects > 0} />
        <Row label="members" value={room.members.map((m) => m.username).join(', ') || '-'} />
        <Row label="room state" value={playback ? (playback.playing ? 'playing' : 'paused') : '-'} />
        <Row label="room rate" value={playback ? `${playback.rate}x` : '-'} />
        <Row label="room seq" value={playback ? String(playback.seq) : '-'} />
        <Row label="room target" value={fmt(target)} />
        <Row label="local time" value={fmt(local)} />
        <Row label="drift" value={drift === null ? '-' : `${drift >= 0 ? '+' : ''}${fmt(drift)} s`} warn={Math.abs(drift ?? 0) > 2} />
        <Row label="local rate" value={video ? `${video.playbackRate.toFixed(2)}x` : '-'} warn={Boolean(video && playback && Math.abs(video.playbackRate - playback.rate) > 0.001)} />
        <Row label="local state" value={video ? (video.paused ? 'paused' : 'playing') : '-'} warn={Boolean(video && playback && video.paused === playback.playing)} />
        <Row label="ready state" value={video ? READY_STATES[video.readyState] ?? String(video.readyState) : '-'} warn={Boolean(video && video.readyState < 3)} />
        <Row label="seeking" value={video ? String(video.seeking) : '-'} warn={Boolean(video?.seeking)} />
        <Row label="buffer ahead" value={buffered === null ? '-' : `${fmt(buffered, 1)} s`} warn={buffered !== null && buffered < 2} />
        <Row label="media" value={room.media ? `ep ${room.media.episode ?? '-'} · ${room.media.source} · ${room.media.kind}` : '-'} />
        <Row label="author" value={room.media?.author ?? '-'} />
        <Row label="last action" value={room.action ? `${room.action.by.username}: ${room.action.kind} (${Math.round((Date.now() - room.action.at) / 1000)}s ago)` : '-'} />
      </div>
    </details>
  )
}
