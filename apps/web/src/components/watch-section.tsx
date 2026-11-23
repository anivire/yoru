import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AnimeDetails, type Episode, type ListEntry, type RoomMedia, STREAM_KINDS, type StreamKind, type VideoEpisodes } from '@yoru/shared'
import { Button, Mascot, Select, Spinner, StarIcon, Tooltip, cn } from '@yoru/ui'
import { RiClosedCaptioningFill, RiMicFill, RiPlayCircleFill, RiSettings3Fill, RiVolumeUpFill } from '@remixicon/react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ApiError, api } from '../lib/api'
import { errorMessage, keys } from '../lib/queries'
import { EpisodeList } from './episode-list'
import { MatchDialog } from './match-dialog'
import { EmbedPlayer } from './player/embed-player'
import { Player } from './player/player'
import { TLink } from './transition-link'
import { useAppearance } from '../lib/appearance'
import { useAnimeTitle } from '../lib/anime-title'
import { ANILIBRIA_LOGO, ANIME365_LOGO } from '../lib/logos'
import { isFavorite, pickFavorite, toggleFavorite } from '../lib/favorite-authors'
import type { Room } from '../lib/rooms'
import { RoomDebug } from './watch-together'
import { readStorage, writeStorage } from '../lib/storage'

function kindKey(malId: number) {
  return `yoru:kind:${malId}`
}

function parseKind(value: string | null): StreamKind | null {
  return STREAM_KINDS.includes(value as StreamKind) ? (value as StreamKind) : null
}

export const KIND_ICONS: Record<StreamKind, typeof RiMicFill> = {
  sub: RiClosedCaptioningFill,
  voice: RiMicFill,
  subEn: RiClosedCaptioningFill,
  voiceEn: RiMicFill,
  raw: RiVolumeUpFill,
}

function sourceKey(malId: number) {
  return `yoru:source:${malId}`
}

function ProviderMark({ id }: { id: string }) {
  if (id === 'anime365') return <img src={ANIME365_LOGO} alt="" className="size-4 rounded-sm bg-white object-contain" />
  if (id === 'anilibria') return <img src={ANILIBRIA_LOGO} alt="" className="size-4 rounded-sm bg-white object-contain p-px" />
  return <RiPlayCircleFill />
}

function hasEpisodes(data: VideoEpisodes | undefined, episode: number | null): boolean {
  return Boolean(data?.matched && data.episodes.length && (!episode || data.episodes.includes(episode)))
}

function authorKey(malId: number, kind: StreamKind) {
  return `yoru:author:${malId}:${kind}`
}

function PlayerMessage({ children, mood = 'thinking', action }: { children?: ReactNode; mood?: 'thinking' | 'error' | 'sleepy'; action?: ReactNode }) {
  return (
    <div className="grid aspect-video w-full place-items-center rounded-xl bg-inset p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center text-sm text-muted-foreground">
        <Mascot mood={mood} size={52} />
        {children}
        {action}
      </div>
    </div>
  )
}

function defaultEpisode(episodes: Episode[], entry: ListEntry | null): number | null {
  const available = episodes.filter((e) => e.available)
  if (!available.length) return null
  const next = (entry?.progress ?? 0) + 1
  return available.find((e) => e.number === next)?.number ?? available.find((e) => e.number > next)?.number ?? available[0]!.number
}

export function WatchSection({ anime, entry, room }: { anime: AnimeDetails; entry: ListEntry | null; room?: Room }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const malId = anime.malId
  const title = useAnimeTitle()
  const [params, setParams] = useSearchParams()
  const { defaultKind, preferredAuthors, setPreferredAuthors, pageWidth, autoNext, watchedAt } = useAppearance()
  const single = anime.episodes === 1
  const side = pageWidth !== '3xl' && pageWidth !== '4xl'
  const paramEpisode = Number(params.get('episode')) || null

  const providers = useQuery({ queryKey: ['video-providers'], queryFn: api.videoProviders, staleTime: 5 * 60_000 })
  const providerList = providers.data ?? []
  const chosen = params.get('source') ?? readStorage(sourceKey(malId))
  const explicit = providerList.some((p) => p.id === chosen) ? chosen : null
  const sourceQueries = useQueries({
    queries: providerList.map((p) => ({
      queryKey: ['video-episodes', malId, p.id],
      queryFn: () => api.videoEpisodes(malId, p.id),
      staleTime: 10 * 60_000,
      retry: 1,
      enabled: false,
    })),
  })
  let autoIndex = 0
  let autoSettled = Boolean(explicit)
  if (!explicit) {
    for (let i = 0; i < providerList.length; i++) {
      const query = sourceQueries[i]!
      if (!query.isFetched) {
        autoIndex = i
        break
      }
      if (hasEpisodes(query.data, paramEpisode)) {
        autoIndex = i
        autoSettled = true
        break
      }
      if (i === providerList.length - 1) autoSettled = true
    }
  }
  const source = explicit ?? providerList[autoIndex]?.id ?? null
  const provider = providerList.find((p) => p.id === source)
  const sourceQuery = useQuery({
    queryKey: ['video-episodes', malId, source],
    queryFn: () => api.videoEpisodes(malId, source!),
    staleTime: 10 * 60_000,
    retry: 1,
    enabled: Boolean(source),
  })
  const sourceEpisodes = autoSettled ? sourceQuery.data : undefined
  const sourcePending = providers.isPending || (Boolean(source) && (!autoSettled || sourceQuery.isPending))
  const kinds = provider?.kinds ?? STREAM_KINDS
  const preferredKind = parseKind(params.get('kind')) ?? parseKind(readStorage(kindKey(malId))) ?? defaultKind
  const kind = kinds.includes(preferredKind) ? preferredKind : (kinds[0] ?? preferredKind)
  const singleKind = kinds.length === 1

  const match = useQuery({ queryKey: keys.match(malId), queryFn: () => api.match(malId), enabled: Boolean(provider?.manualMatch) })
  const episodes = useQuery({ queryKey: keys.episodes(malId), queryFn: () => api.episodes(malId) })
  const sourceSet = useMemo(() => new Set(sourceEpisodes?.episodes ?? []), [sourceEpisodes])
  const list = useMemo(() => (episodes.data ?? []).map((e) => ({ ...e, available: sourceSet.has(e.number) })), [episodes.data, sourceSet])
  const derived = episodes.data && sourceEpisodes ? defaultEpisode(list, entry) : null
  const [pinned, setPinned] = useState<{ malId: number; episode: number } | null>(null)
  if (!paramEpisode && derived && pinned?.malId !== malId) setPinned({ malId, episode: derived })
  const episode = paramEpisode ?? (pinned?.malId === malId ? pinned.episode : derived)
  const current = list.find((e) => e.number === episode)
  const available = Boolean(current?.available)

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k)
        else next.set(k, v)
      }
      setParams(next, { replace: true, preventScrollReset: true })
    },
    [params, setParams],
  )

  const translations = useQuery({
    queryKey: ['translations', malId, source, episode, kind],
    queryFn: () => api.translations(malId, source!, episode!, kind),
    enabled: Boolean(source && episode && available),
  })

  const inRoom = Boolean(room)
  const playerColumnRef = useRef<HTMLDivElement>(null)
  const roomAuthor = room?.media?.author ?? null

  const [pickedId, setPickedId] = useState<string | null>(null)
  const translationId = useMemo(() => {
    const items = translations.data
    if (!items?.length) return null
    const shared = roomAuthor ? items.find((x) => x.author === roomAuthor) : undefined
    if (shared) return shared.id
    if (pickedId !== null && items.some((x) => x.id === pickedId)) return pickedId
    const remembered = readStorage(authorKey(malId, kind))
    const favorite = pickFavorite(preferredAuthors, kind, items)
    return (items.find((x) => x.author === remembered) ?? favorite ?? items[0]!).id
  }, [translations.data, roomAuthor, pickedId, malId, kind, preferredAuthors])

  const translation = translations.data?.find((x) => x.id === translationId)
  const favorite = translation ? isFavorite(preferredAuthors, kind, translation.author) : false
  const stream = useQuery({
    queryKey: ['stream', malId, source, episode, translationId],
    queryFn: () => api.stream(malId, source!, episode!, translationId!, translation?.author ?? ''),
    enabled: Boolean(source && episode && translationId),
    staleTime: 10 * 60_000,
    retry: false,
  })

  const nextEpisode = useMemo(() => list.find((e) => e.number > (episode ?? 0) && e.available)?.number, [list, episode])
  const prevEpisode = useMemo(() => [...list].reverse().find((e) => e.number < (episode ?? 0) && e.available)?.number, [list, episode])
  const shareMedia = (patch: Partial<RoomMedia>) => {
    if (room?.status !== 'open') return
    if (!source) return
    room.sendMedia({ episode, source, kind, author: translation?.author ?? null, ...patch })
  }
  const goTo = (n: number) => {
    setParam({ episode: String(n) })
    shareMedia({ episode: n })
  }

  const appliedMediaRef = useRef(0)
  const roomMedia = room?.media ?? null
  const roomMediaSeq = room?.mediaSeq ?? 0
  useEffect(() => {
    const media = roomMedia
    if (!media || roomMediaSeq === appliedMediaRef.current) return
    appliedMediaRef.current = roomMediaSeq
    const patch: Record<string, string> = {}
    if (media.episode && media.episode !== episode) patch.episode = String(media.episode)
    if (media.source !== source) patch.source = media.source
    if (media.kind !== kind) patch.kind = media.kind
    if (Object.keys(patch).length) setParam(patch)
  }, [roomMedia, roomMediaSeq, episode, source, kind, setParam])


  const markedRef = useRef<string | null>(null)
  const onProgress = useCallback(
    (position: number, duration: number) => {
      if (!episode) return
      void api.saveProgress(malId, episode, position, duration, watchedAt).then(() => {
        const key = `${malId}:${episode}`
        if (duration > 0 && position / duration >= watchedAt - 0.001 && markedRef.current !== key) {
          markedRef.current = key
          void client.invalidateQueries({ queryKey: keys.anime(malId) })
          void client.invalidateQueries({ queryKey: keys.episodes(malId) })
          void client.invalidateQueries({ queryKey: keys.home })
          void client.invalidateQueries({ queryKey: ['list'] })
        }
      })
    },
    [malId, episode, client, watchedAt],
  )

  const startAt = current?.position && current.duration && current.position / current.duration < 0.9 ? current.position : 0
  const streamError = stream.error instanceof ApiError ? stream.error : null
  const tokenProblem = streamError?.message === 'ANIME365_TOKEN_MISSING' || streamError?.message === 'ANIME365_TOKEN_INVALID'

  const lengthKey = `${malId}:${episode}:${source}:${translationId}`
  const [videoLength, setVideoLength] = useState<{ key: string; value: number } | null>(null)
  const length = videoLength?.key === lengthKey ? videoLength.value : 0
  const skips = useQuery({
    queryKey: ['skip-times', malId, episode, Math.round(length)],
    queryFn: () => api.skipTimes(malId, episode!, length),
    enabled: Boolean(episode) && length > 0,
    staleTime: Infinity,
  })
  const playerProps = {
    skips: skips.data,
    autoNext,
    onDuration: (value: number) => setVideoLength((prev) => (prev?.key === lengthKey && Math.round(prev.value) === Math.round(value) ? prev : { key: lengthKey, value })),
    startAt: inRoom ? 0 : startAt,
    autoPlay: !inRoom && params.get('autoplay') === '1',
    sync: room?.status === 'open' ? { playback: room.playback, offset: room.offset, onAction: room.sendPlayback } : undefined,
    title: current?.title ? `${t('common.episode')} ${episode} · ${current.title}` : `${t('common.episode')} ${episode}`,
    subtitle: title(anime),
    onProgress,
    onEnded: () => {
      if (!nextEpisode) return
      setParam({ episode: String(nextEpisode), autoplay: '1' })
      shareMedia({ episode: nextEpisode })
    },
    onNext: nextEpisode ? () => goTo(nextEpisode) : undefined,
    onPrev: prevEpisode ? () => goTo(prevEpisode) : undefined,
  }

  const providerName = provider?.name ?? ''
  let body: ReactNode
  if (providers.isSuccess && !providerList.length) {
    body = <PlayerMessage>{t('player.noVideoProviders')}</PlayerMessage>
  } else if (sourcePending || episodes.isPending) {
    body = (
      <PlayerMessage mood="sleepy">
        <Spinner />
      </PlayerMessage>
    )
  } else if (!sourceEpisodes) {
    body = (
      <PlayerMessage
        mood="error"
        action={
          <Button size="sm" variant="secondary" onClick={() => void sourceQuery.refetch()}>
            {t('common.retry')}
          </Button>
        }
      >
        {errorMessage(sourceQuery.error, t)}
      </PlayerMessage>
    )
  } else if (!sourceEpisodes.matched) {
    body = <PlayerMessage>{t('player.noMatch', { provider: providerName })}</PlayerMessage>
  } else if (!episode) {
    body = <PlayerMessage mood="sleepy" />
  } else if (!available) {
    body = <PlayerMessage mood="sleepy">{t('player.notAvailable', { provider: providerName })}</PlayerMessage>
  } else if (translations.isPending || (translationId && stream.isPending)) {
    body = (
      <PlayerMessage mood="thinking">
        <Spinner />
      </PlayerMessage>
    )
  } else if (translations.isError) {
    body = <PlayerMessage mood="error">{errorMessage(translations.error, t)}</PlayerMessage>
  } else if (!translations.data?.length) {
    body = <PlayerMessage>{t('player.noTranslations')}</PlayerMessage>
  } else if (stream.isError) {
    body = (
      <PlayerMessage
        mood="error"
        action={
          tokenProblem ? (
            <Button asChild size="sm" variant="secondary">
              <TLink to="/settings/account">
                <RiSettings3Fill />
                {t('nav.settings')}
              </TLink>
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => stream.refetch()}>
              {t('common.retry')}
            </Button>
          )
        }
      >
        {errorMessage(stream.error, t)}
      </PlayerMessage>
    )
  } else if (stream.data?.embedUrl) {
    body = (
      <EmbedPlayer
        key={`${episode}:${stream.data.translationId}`}
        url={stream.data.embedUrl}
        startAt={playerProps.startAt}
        onProgress={onProgress}
        onEnded={playerProps.onEnded}
        onDuration={playerProps.onDuration}
      />
    )
  } else if (stream.data) {
    body = (
      <Player
        key={`${episode}:${stream.data.translationId}`}
        sources={stream.data.sources}
        subtitlesUrl={kind === 'sub' || kind === 'subEn' ? stream.data.subtitlesUrl : null}
        {...playerProps}
      />
    )
  }

  if (room && !room.media) {
    body = (
      <PlayerMessage mood="thinking">
        <Spinner />
      </PlayerMessage>
    )
  }

  return (
    <section id="watch" className="min-w-0 scroll-mt-20">
      <div
        className={cn(
          'mb-3 grid min-w-0 gap-2',
          'grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]',
          side && 'sm:flex sm:flex-wrap sm:items-center',
        )}
      >
        <Select
          className={cn('h-10 w-full min-w-0 rounded-xl px-3.5', side && 'sm:w-40')}
          disabled={!providerList.length}
          value={source ?? undefined}
          onValueChange={(v) => {
            writeStorage(sourceKey(malId), v)
            setParam({ source: v })
            const next = providerList.find((p) => p.id === v)
            shareMedia({ source: v, kind: next && !next.kinds.includes(kind) ? (next.kinds[0] ?? kind) : kind, author: null })
          }}
          icon={source ? <ProviderMark id={source} /> : undefined}
          options={providerList.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select
          className={cn('h-10 w-full min-w-0 rounded-xl px-3.5', side && 'sm:w-56')}
          disabled={singleKind}
          value={kind}
          icon={(() => {
            const Icon = KIND_ICONS[kind]
            return <Icon />
          })()}
          onValueChange={(v) => {
            writeStorage(kindKey(malId), v)
            setParam({ kind: v })
            shareMedia({ kind: parseKind(v) ?? kind, author: null })
          }}
          options={kinds.map((k) => ({ value: k, label: t(`player.${k}`) }))}
        />
        <div className={cn('col-span-full flex min-w-0 gap-2', side ? 'max-sm:order-1' : 'order-1')}>
          <Select
            className={cn('h-10 w-full min-w-0 flex-1 rounded-xl px-3.5', side && 'sm:w-72 sm:flex-none')}
            disabled={!translations.data?.length}
            placeholder={t('player.author')}
            value={translationId ?? undefined}
            onValueChange={(v) => {
              const tr = translations.data?.find((x) => x.id === v)
              if (tr) writeStorage(authorKey(malId, kind), tr.author)
              setPickedId(v)
              if (tr) shareMedia({ author: tr.author })
            }}
            options={(translations.data ?? []).map((x) => ({
              value: x.id,
              label: x.author,
              hint: [x.height ? `${x.height}p` : null, x.qualityType?.toUpperCase()].filter(Boolean).join(' · ') || undefined,
            }))}
          />
          <Tooltip content={t(favorite ? 'player.unfavorite' : 'player.favorite')}>
            <Button
              variant="secondary"
              size="icon"
              disabled={!translation}
              aria-label={t(favorite ? 'player.unfavorite' : 'player.favorite')}
              aria-pressed={favorite}
              onClick={() => {
                if (!translation) return
                writeStorage(authorKey(malId, kind), translation.author)
                setPreferredAuthors(toggleFavorite(preferredAuthors, kind, translation.author))
              }}
              className={cn('size-10 shrink-0 rounded-xl bg-foreground/[0.05] hover:bg-foreground/[0.08]', favorite && 'text-accent')}
            >
              {favorite ? <StarIcon /> : <StarIcon outline />}
            </Button>
          </Tooltip>
        </div>
        <div className={cn('flex justify-end gap-2', side && 'sm:ml-auto')}>
          {provider?.manualMatch ? <MatchDialog malId={malId} match={match.data} defaultQuery={anime.title} /> : null}
        </div>
      </div>
      <div className={cn('grid gap-5', side && !single && 'desk:grid-cols-[minmax(0,1fr)_22rem]')}>
        <div ref={playerColumnRef} className="min-w-0">
          {body}
          {room ? <RoomDebug room={room} container={playerColumnRef} /> : null}
        </div>
        {single ? null : (
          <div className={cn(side && 'desk:relative')}>
            <div className={cn('flex max-h-[26rem] flex-col', side && 'desk:absolute desk:inset-0 desk:max-h-none')}>
              <EpisodeList episodes={list} current={episode ?? 0} loading={episodes.isPending} onSelect={goTo} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
