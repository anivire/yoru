import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type AnimeDetails, type Episode, type ListEntry, STREAM_KINDS, type StreamKind } from '@yoru/shared'
import { Button, Mascot, Select, Spinner } from '@yoru/ui'
import { RiClosedCaptioningFill, RiMicFill, RiSettings3Fill, RiVolumeUpFill } from '@remixicon/react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ApiError, api } from '../lib/api'
import { errorMessage, keys } from '../lib/queries'
import { EpisodeList } from './episode-list'
import { MatchDialog } from './match-dialog'
import { Player } from './player/player'
import { TLink } from './transition-link'
import { useAppearance } from '../lib/appearance'
import { useAnimeTitle } from '../lib/anime-title'

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

function authorKey(malId: number, kind: StreamKind) {
  return `yoru:author:${malId}:${kind}`
}

function PlayerMessage({ children, mood = 'thinking', action }: { children: ReactNode; mood?: 'thinking' | 'error' | 'sleepy'; action?: ReactNode }) {
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
  if (!available.length) return episodes[0]?.number ?? null
  const next = (entry?.progress ?? 0) + 1
  return available.find((e) => e.number === next)?.number ?? available.find((e) => e.number > next)?.number ?? available[0]!.number
}

export function WatchSection({ anime, entry }: { anime: AnimeDetails; entry: ListEntry | null }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const malId = anime.malId
  const title = useAnimeTitle()
  const [params, setParams] = useSearchParams()
  const { defaultKind, preferredAuthors } = useAppearance()
  const kind = parseKind(params.get('kind')) ?? parseKind(localStorage.getItem(kindKey(malId))) ?? defaultKind

  const match = useQuery({ queryKey: keys.match(malId), queryFn: () => api.match(malId) })
  const episodes = useQuery({ queryKey: keys.episodes(malId), queryFn: () => api.episodes(malId) })
  const list = episodes.data ?? []
  const paramEpisode = Number(params.get('episode')) || null
  const episode = paramEpisode ?? (episodes.data ? defaultEpisode(list, entry) : null)
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
    queryKey: ['translations', malId, episode, kind],
    queryFn: () => api.translations(malId, episode!, kind),
    enabled: Boolean(episode && available && match.data?.providerId),
  })

  const [translationId, setTranslationId] = useState<number | null>(null)
  useEffect(() => {
    const items = translations.data
    if (!items?.length) {
      setTranslationId(null)
      return
    }
    const remembered = localStorage.getItem(authorKey(malId, kind))
    const favorite = preferredAuthors.map((p) => p.toLowerCase()).reduce<(typeof items)[number] | undefined>((found, p) => found ?? items.find((x) => x.author.toLowerCase().includes(p)), undefined)
    setTranslationId((items.find((x) => x.author === remembered) ?? favorite ?? items[0]!).id)
  }, [translations.data, malId, kind, preferredAuthors])

  const translation = translations.data?.find((x) => x.id === translationId)
  const stream = useQuery({
    queryKey: ['stream', translationId],
    queryFn: () => api.stream(translationId!, translation?.author ?? ''),
    enabled: Boolean(translationId),
    staleTime: 10 * 60_000,
    retry: false,
  })

  const nextEpisode = useMemo(() => list.find((e) => e.number > (episode ?? 0) && e.available)?.number, [list, episode])
  const prevEpisode = useMemo(() => [...list].reverse().find((e) => e.number < (episode ?? 0) && e.available)?.number, [list, episode])
  const goTo = useCallback((n: number) => setParam({ episode: String(n) }), [setParam])

  const markedRef = useRef<string | null>(null)
  const onProgress = useCallback(
    (position: number, duration: number) => {
      if (!episode) return
      void api.saveProgress(malId, episode, position, duration).then(() => {
        const key = `${malId}:${episode}`
        if (duration > 0 && position / duration >= 0.85 && markedRef.current !== key) {
          markedRef.current = key
          void client.invalidateQueries({ queryKey: keys.anime(malId) })
          void client.invalidateQueries({ queryKey: keys.episodes(malId) })
          void client.invalidateQueries({ queryKey: keys.home })
          void client.invalidateQueries({ queryKey: ['list'] })
        }
      })
    },
    [malId, episode, client],
  )

  const startAt = current?.position && current.duration && current.position / current.duration < 0.9 ? current.position : 0
  const streamError = stream.error instanceof ApiError ? stream.error : null
  const tokenProblem = streamError?.message === 'ANIME365_TOKEN_MISSING' || streamError?.message === 'ANIME365_TOKEN_INVALID'

  let body: ReactNode
  if (match.isPending || episodes.isPending) {
    body = (
      <PlayerMessage mood="sleepy">
        <Spinner />
      </PlayerMessage>
    )
  } else if (!match.data?.providerId) {
    body = <PlayerMessage>{t('player.noMatch')}</PlayerMessage>
  } else if (!episode) {
    body = <PlayerMessage>{t('player.selectEpisode')}</PlayerMessage>
  } else if (!available) {
    body = <PlayerMessage mood="sleepy">{t('player.notAvailable')}</PlayerMessage>
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
  } else if (stream.data) {
    body = (
      <Player
        key={`${episode}:${stream.data.translationId}`}
        sources={stream.data.sources}
        subtitlesUrl={kind === 'sub' || kind === 'subEn' ? stream.data.subtitlesUrl : null}
        startAt={startAt}
        autoPlay={params.get('autoplay') === '1'}
        title={current?.title ? `${t('common.episode')} ${episode} · ${current.title}` : `${t('common.episode')} ${episode}`}
        subtitle={title(anime)}
        onProgress={onProgress}
        onEnded={() => nextEpisode && setParam({ episode: String(nextEpisode), autoplay: '1' })}
        onNext={nextEpisode ? () => goTo(nextEpisode) : undefined}
        onPrev={prevEpisode ? () => goTo(prevEpisode) : undefined}
      />
    )
  }

  return (
    <section id="watch" className="min-w-0 scroll-mt-20">
      <div className="mb-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select className="h-10 w-full min-w-0 rounded-xl px-3.5 sm:w-40" value="anime365" onValueChange={() => undefined} icon={<img src="/anime365.webp" alt="" className="size-4 rounded-sm bg-white object-contain" />} options={[{ value: 'anime365', label: 'Anime365' }]} />
        <Select
          className="h-10 w-full min-w-0 rounded-xl px-3.5 sm:w-56"
          value={kind}
          icon={(() => {
            const Icon = KIND_ICONS[kind]
            return <Icon />
          })()}
          onValueChange={(v) => {
            localStorage.setItem(kindKey(malId), v)
            setParam({ kind: v })
          }}
          options={STREAM_KINDS.map((k) => ({ value: k, label: t(`player.${k}`) }))}
        />
        <div className="flex justify-end sm:order-last sm:ml-auto">
          <MatchDialog malId={malId} match={match.data} defaultQuery={anime.title} />
        </div>
        <Select
          className="col-span-3 h-10 w-full min-w-0 rounded-xl px-3.5 sm:w-72"
          disabled={!translations.data?.length}
          placeholder={t('player.author')}
          value={translationId ? String(translationId) : undefined}
          onValueChange={(v) => {
            const tr = translations.data?.find((x) => String(x.id) === v)
            if (tr) localStorage.setItem(authorKey(malId, kind), tr.author)
            setTranslationId(Number(v))
          }}
          options={(translations.data ?? []).map((x) => ({
            value: String(x.id),
            label: x.author,
            hint: [x.height ? `${x.height}p` : null, x.qualityType?.toUpperCase()].filter(Boolean).join(' · ') || undefined,
          }))}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">{body}</div>
        <div className="lg:relative">
          <div className="flex max-h-[26rem] flex-col lg:absolute lg:inset-0 lg:max-h-none">
            <EpisodeList episodes={list} current={episode ?? 0} loading={episodes.isPending} onSelect={goTo} />
          </div>
        </div>
      </div>
    </section>
  )
}
