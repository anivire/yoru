import type { RoomPlayback, RoomPlaybackInput, SkipTime, StreamSource } from '@yoru/shared'
import { Spinner, cn } from '@yoru/ui'
import type Hls from 'hls.js'
import type JASSUB from 'jassub'
import { RiArrowLeftSFill, RiCheckFill, RiClosedCaptioningFill, RiClosedCaptioningLine, RiDashboard3Fill, RiFullscreenExitFill, RiFullscreenFill, RiPauseLargeFill, RiPictureInPicture2Fill, RiPlayLargeFill, RiSettings3Fill, RiSkipBackFill, RiSkipForwardFill, RiVolumeDownFill, RiVolumeMuteFill, RiVolumeUpFill } from '@remixicon/react'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTime } from '../../lib/format'
import { assToVtt } from './ass-to-vtt'
import { useAppearance } from '../../lib/appearance'
import { IS_IOS } from '../../lib/device'

const RATES = [0.75, 1, 1.25, 1.5, 2]
const QUALITY_KEY = 'yoru:quality'
const VOLUME_KEY = 'yoru:volume'
const SUBS_KEY = 'yoru:subs'

export interface PlayerProps {
  sources: StreamSource[]
  subtitlesUrl: string | null
  startAt: number
  title: ReactNode
  subtitle?: ReactNode
  autoPlay?: boolean
  onProgress: (position: number, duration: number) => void
  onEnded: () => void
  onNext?: () => void
  onPrev?: () => void
  onDuration?: (duration: number) => void
  skips?: SkipTime[]
  autoNext?: boolean
  sync?: PlayerSync
}

export interface PlayerSync {
  playback: (RoomPlayback & { seq: number }) | null
  offset: number
  onAction: (playback: RoomPlaybackInput) => void
}

const SYNC_TOLERANCE = 2
const DRIFT_SEEK = 5
const DRIFT_NUDGE = 0.3
const NUDGE_FACTOR = 0.08
const DRIFT_CHECK_MS = 1000
const DRIFT_COOLDOWN_MS = 10_000
const ECHO_MS = 6000

function syncTarget(playback: RoomPlayback, offset: number) {
  if (!playback.playing) return playback.position
  return playback.position + (Math.max(0, Date.now() + offset - playback.at) / 1000) * playback.rate
}

const COUNTDOWN_SECONDS = 5

const SEGMENT_TONES: Record<SkipTime['kind'], string> = {
  op: 'bg-amber-300/75',
  ed: 'bg-amber-300/75',
  recap: 'bg-sky-300/70',
}

function pickSource(sources: StreamSource[]): StreamSource {
  const preferred = Number(localStorage.getItem(QUALITY_KEY)) || 1080
  return sources.find((s) => s.height <= preferred) ?? sources[sources.length - 1] ?? sources[0]!
}

type Menu = null | 'root' | 'quality' | 'speed' | 'subs'

const SAFE_SIDES = { paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }
const SAFE_TOP = { ...SAFE_SIDES, paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }
const SAFE_BOTTOM = { ...SAFE_SIDES, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void }
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

function fullscreenElement() {
  return document.fullscreenElement ?? (document as FullscreenDocument).webkitFullscreenElement ?? null
}

export function Player({ sources, subtitlesUrl, startAt, title, subtitle, autoPlay, onProgress, onEnded, onNext, onPrev, onDuration, skips, autoNext = true, sync }: PlayerProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const subsRef = useRef<JASSUB | null>(null)
  const resumeRef = useRef(startAt)
  const lastSaveRef = useRef(0)
  const hideTimer = useRef<number | undefined>(undefined)

  const [source, setSource] = useState(() => pickSource(sources))
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(() => Number(localStorage.getItem(VOLUME_KEY) ?? 1))
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [subsOn, setSubsOn] = useState(() => localStorage.getItem(SUBS_KEY) !== 'off')
  const [fullscreen, setFullscreen] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [stretched, setStretched] = useState(false)
  const { iosFullscreen } = useAppearance()
  const nativeIos = IS_IOS && iosFullscreen === 'native'
  const full = fullscreen || stretched
  const [controls, setControls] = useState(true)
  const [menu, setMenu] = useState<Menu>(null)
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const syncRef = useRef(sync)
  const expectRef = useRef<{ playing: boolean; position: number; until: number } | null>(null)
  const syncSeekRef = useRef(0)
  const rateRef = useRef(rate)
  const nudgeRef = useRef(false)
  const setVideoRate = (v: HTMLVideoElement, value: number) => {
    if (v.playbackRate === value) return
    nudgeRef.current = true
    v.playbackRate = value
  }
  useEffect(() => {
    rateRef.current = rate
  }, [rate])
  useEffect(() => {
    syncRef.current = sync
  })

  const applySync = useCallback(() => {
    const v = videoRef.current
    const current = syncRef.current
    if (!v || !current?.playback || v.readyState < 1) return
    const playback = current.playback
    const target = Math.min(syncTarget(playback, current.offset), Number.isFinite(v.duration) ? v.duration : Infinity)
    expectRef.current = { playing: playback.playing, position: target, until: performance.now() + ECHO_MS }
    if (rateRef.current !== playback.rate) setRate(playback.rate)
    if (Math.abs(v.currentTime - target) > SYNC_TOLERANCE) {
      syncSeekRef.current = performance.now()
      v.currentTime = target
    }
    if (playback.playing && v.paused) {
      void v.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      )
    }
    if (!playback.playing && !v.paused) v.pause()
  }, [])

  const reportSync = useCallback(() => {
    const v = videoRef.current
    const current = syncRef.current
    if (!v || !current) return
    const expected = expectRef.current
    if (expected && performance.now() < expected.until && expected.playing === !v.paused && Math.abs(v.currentTime - expected.position) < 2) return
    expectRef.current = null
    const shared = current.playback
    const nominal = rateRef.current
    if (shared && shared.playing === !v.paused && shared.rate === nominal && Math.abs(v.currentTime - syncTarget(shared, current.offset)) < SYNC_TOLERANCE) return
    current.onAction({ playing: !v.paused, position: v.currentTime, rate: nominal })
  }, [])

  const syncSeq = sync?.playback?.seq
  useEffect(() => {
    if (syncSeq !== undefined) applySync()
  }, [syncSeq, applySync])

  const syncing = Boolean(sync)
  useEffect(() => {
    if (!syncing) return
    const timer = window.setInterval(() => {
      const v = videoRef.current
      const current = syncRef.current
      if (!v) return
      const playback = current?.playback
      const nominal = playback?.rate ?? rateRef.current
      if (!current || !playback?.playing || v.paused || v.seeking || v.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        setVideoRate(v, nominal)
        return
      }
      const drift = v.currentTime - syncTarget(playback, current.offset)
      if (Math.abs(drift) > DRIFT_SEEK && performance.now() - syncSeekRef.current >= DRIFT_COOLDOWN_MS) {
        setVideoRate(v, nominal)
        expectRef.current = { playing: true, position: v.currentTime - drift, until: performance.now() + ECHO_MS }
        syncSeekRef.current = performance.now()
        v.currentTime -= drift
        return
      }
      if (Math.abs(drift) <= DRIFT_NUDGE) setVideoRate(v, nominal)
      else setVideoRate(v, nominal * (drift < 0 ? 1 + NUDGE_FACTOR : 1 - NUDGE_FACTOR))
    }, DRIFT_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [syncing])

  const save = useCallback(
    (force = false) => {
      const v = videoRef.current
      if (!v || !v.duration || !Number.isFinite(v.duration)) return
      if (!force && Date.now() - lastSaveRef.current < 15_000) return
      lastSaveRef.current = Date.now()
      onProgress(v.currentTime, v.duration)
    },
    [onProgress],
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let cancelled = false
    setError(null)
    setWaiting(true)
    const resumeAt = resumeRef.current
    const wasPlaying = autoPlay || !video.paused
    hlsRef.current?.destroy()
    hlsRef.current = null

    const start = () => {
      if (resumeAt > 0) video.currentTime = resumeAt
      if (wasPlaying) void video.play().catch(() => setPlaying(false))
      applySync()
    }

    const mse = typeof window !== 'undefined' && ('MediaSource' in window || 'ManagedMediaSource' in window)
    if (source.type === 'm3u8' && (mse || !video.canPlayType('application/vnd.apple.mpegurl'))) {
      void import('hls.js').then(({ default: HlsCtor }) => {
        if (cancelled) return
        const hls = new HlsCtor({ maxBufferLength: 60 })
        hlsRef.current = hls
        hls.loadSource(source.url)
        hls.attachMedia(video)
        hls.on(HlsCtor.Events.MANIFEST_PARSED, start)
        hls.on(HlsCtor.Events.ERROR, (_e, data) => {
          if (data.fatal) setError(data.details)
        })
      })
    } else {
      video.src = source.url
      video.addEventListener('loadedmetadata', start, { once: true })
    }
    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', start)
    }
  }, [source])

  useEffect(() => () => hlsRef.current?.destroy(), [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !subtitlesUrl || !subsOn) return
    let instance: JASSUB | null = null
    let cancelled = false
    void import('jassub').then(({ default: JassubCtor }) => {
      if (cancelled) return
      try {
        instance = new JassubCtor({ video, subUrl: subtitlesUrl })
        subsRef.current = instance
      } catch (e) {
        console.warn('JASSUB failed', e)
      }
    })
    return () => {
      cancelled = true
      void instance?.destroy()
      subsRef.current = null
    }
  }, [subtitlesUrl, subsOn])

  const vtt = useQuery({
    queryKey: ['subtitles-vtt', subtitlesUrl],
    queryFn: async () => {
      const res = await fetch(subtitlesUrl!)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return assToVtt(await res.text())
    },
    enabled: nativeIos && Boolean(subtitlesUrl) && subsOn,
    staleTime: Infinity,
  }).data
  const vttUrl = useMemo(() => (vtt ? URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })) : null), [vtt])
  useEffect(() => {
    const video = videoRef.current
    if (!video || !vttUrl || !subsOn) return
    const setMode = (mode: TextTrackMode) => {
      for (const track of Array.from(video.textTracks)) track.mode = mode
    }
    setMode('hidden')
    const show = () => setMode('showing')
    const hide = () => setMode('hidden')
    video.addEventListener('webkitbeginfullscreen', show)
    video.addEventListener('webkitendfullscreen', hide)
    return () => {
      video.removeEventListener('webkitbeginfullscreen', show)
      video.removeEventListener('webkitendfullscreen', hide)
    }
  }, [vttUrl, subsOn])
  useEffect(() => () => {
    if (vttUrl) URL.revokeObjectURL(vttUrl)
  }, [vttUrl])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = muted
    localStorage.setItem(VOLUME_KEY, String(volume))
  }, [volume, muted])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate
  }, [rate])

  useEffect(() => {
    const onFs = () => setFullscreen(fullscreenElement() === rootRef.current)
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('webkitfullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('webkitfullscreenchange', onFs)
    }
  }, [])

  useEffect(() => {
    const onHide = () => save(true)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      save(true)
    }
  }, [save])

  const poke = useCallback(() => {
    setControls(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControls(false)
        setMenu(null)
      }
    }, 2500)
  }, [])

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }, [])

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta))
  }, [])

  const toggleFullscreen = useCallback(() => {
    const doc = document as FullscreenDocument
    if (stretched) {
      setStretched(false)
      return
    }
    if (fullscreenElement()) {
      if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => undefined)
      else doc.webkitExitFullscreen?.()
      return
    }
    const root = rootRef.current as FullscreenElement | null
    const video = videoRef.current as IosVideo | null
    const native = () => video?.webkitEnterFullscreen?.()
    const fallback = () => (IS_IOS ? setStretched(true) : native())
    if (nativeIos) native()
    else if (root?.requestFullscreen) void root.requestFullscreen().catch(fallback)
    else if (root?.webkitRequestFullscreen) root.webkitRequestFullscreen()
    else fallback()
  }, [stretched, nativeIos])

  useEffect(() => {
    if (!stretched) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    root.setAttribute('data-player-stretched', '')
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const previousViewport = viewport?.content
    if (viewport && previousViewport && !previousViewport.includes('viewport-fit')) viewport.content = `${previousViewport}, viewport-fit=cover`
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previousThemeColor = themeColor?.content
    if (themeColor) themeColor.content = '#000000'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStretched(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = previous
      root.removeAttribute('data-player-stretched')
      if (viewport && previousViewport) viewport.content = previousViewport
      if (themeColor && previousThemeColor) themeColor.content = previousThemeColor
      window.removeEventListener('keydown', onKey)
    }
  }, [stretched])

  const setSubs = (on: boolean) => {
    setSubsOn(on)
    localStorage.setItem(SUBS_KEY, on ? 'on' : 'off')
  }

  const chooseQuality = (s: StreamSource) => {
    resumeRef.current = videoRef.current?.currentTime ?? 0
    localStorage.setItem(QUALITY_KEY, String(s.height))
    setSource(s)
    setMenu(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [role="combobox"], [role="dialog"]')) return
      const v = videoRef.current
      if (!v) return
      switch (e.key) {
        case ' ':
        case 'k':
          toggle()
          break
        case 'ArrowLeft':
        case 'j':
          seekBy(e.key === 'j' ? -10 : -5)
          break
        case 'ArrowRight':
        case 'l':
          seekBy(e.key === 'l' ? 10 : 5)
          break
        case 'ArrowUp':
          setVolume((x) => Math.min(1, x + 0.1))
          break
        case 'ArrowDown':
          setVolume((x) => Math.max(0, x - 0.1))
          break
        case 'f':
          toggleFullscreen()
          break
        case 'm':
          setMuted((x) => !x)
          break
        case 'c':
          setSubs(!subsOn)
          break
        case 's':
          seekBy(85)
          break
        case 'N':
          onNext?.()
          break
        case 'P':
          onPrev?.()
          break
        default:
          return
      }
      e.preventDefault()
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, seekBy, toggleFullscreen, poke, onNext, onPrev, subsOn])

  const activeSkip = skips?.find((s) => time >= s.start && time < s.end - 1)

  const goNext = useEffectEvent(() => onEnded())

  useEffect(() => {
    if (countdown === null) return
    const id = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null)
        goNext()
      } else setCountdown(countdown - 1)
    }, 1000)
    return () => window.clearTimeout(id)
  }, [countdown])

  const VolumeIcon = muted || volume === 0 ? RiVolumeMuteFill : volume < 0.5 ? RiVolumeDownFill : RiVolumeUpFill
  const pct = duration ? (time / duration) * 100 : 0
  const hoverSegment = hover ? skips?.find((s) => hover.time >= s.start && hover.time <= s.end) : undefined

  return (
    <div
      ref={rootRef}
      data-sound="none"
      className={cn(
        'group/player overflow-hidden bg-black text-white',
        stretched ? 'fixed inset-0 z-[100] h-dvh w-screen' : 'relative aspect-video w-full',
        full ? 'rounded-none' : 'rounded-xl',
        !controls && 'cursor-none',
      )}
      onMouseMove={poke}
      onMouseLeave={() => playing && setControls(false)}
    >
      <div className="absolute inset-0" onClick={() => (menu ? setMenu(null) : toggle())} onDoubleClick={toggleFullscreen}>
        <video
          ref={videoRef}
          className="h-full w-full"
          playsInline
          preload="metadata"
          onPlay={() => {
            setPlaying(true)
            setCountdown(null)
            setBlocked(false)
            poke()
            reportSync()
          }}
          onPause={() => {
            setPlaying(false)
            setControls(true)
            save(true)
            reportSync()
          }}
          onSeeking={reportSync}
          onRateChange={() => {
            if (nudgeRef.current) {
              nudgeRef.current = false
              return
            }
            reportSync()
          }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration
            setDuration(d)
            if (Number.isFinite(d) && d > 0) onDuration?.(d)
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget
            setTime(v.currentTime)
            if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
            save()
          }}
          onEnded={() => {
            save(true)
            if (autoNext && onNext) setCountdown(COUNTDOWN_SECONDS)
          }}
          onError={() => setError(t('player.noSources'))}
        >
          {vttUrl && subsOn ? <track key={vttUrl} kind="subtitles" srcLang="ru" label={t('player.subtitles')} src={vttUrl} /> : null}
        </video>
      </div>

      {waiting && !error ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Spinner className="size-10 text-white/80" />
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center text-sm text-white/80">{error}</div>
      ) : null}

      {blocked && !error ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-4">
          <button
            type="button"
            onClick={() => {
              setBlocked(false)
              const v = videoRef.current
              if (v) void v.play().then(applySync, () => setBlocked(true))
            }}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black shadow-2xl hover:bg-white/90"
          >
            <RiPlayLargeFill className="size-5" />
            {t('room.join')}
          </button>
        </div>
      ) : null}

      {activeSkip && !error && countdown === null ? (
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current
            if (v) v.currentTime = Math.min(activeSkip.end, v.duration || activeSkip.end)
            poke()
          }}
          className={cn(
            'absolute right-3 z-10 flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white/90 px-4 text-sm font-semibold text-black shadow-2xl transition-[bottom] hover:bg-white sm:right-5',
            controls ? 'bottom-20 sm:bottom-24' : 'bottom-5',
          )}
        >
          <RiSkipForwardFill className="size-4" />
          {t(`player.skip.${activeSkip.kind}`)}
        </button>
      ) : null}

      {countdown !== null ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-sm text-white/70">{t('player.nextIn')}</div>
            <div className="font-mono text-5xl font-semibold tabular-nums">{countdown}</div>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCountdown(null)
                  onEnded()
                }}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-white/90">
                <RiSkipForwardFill className="size-4" />
                {t('player.watchNext')}
              </button>
              <button type="button" onClick={() => setCountdown(null)} className="h-10 cursor-pointer rounded-xl bg-white/15 px-4 text-sm font-medium text-white hover:bg-white/25">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!playing && !waiting && !error && countdown === null ? (
        <button type="button" onClick={toggle} className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/90 text-black shadow-2xl sm:size-16">
          <RiPlayLargeFill className="size-6 sm:size-8" />
        </button>
      ) : null}

      <div style={stretched ? SAFE_TOP : undefined} className={cn('pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-2.5 transition-opacity sm:px-5 sm:pb-10 sm:pt-4', controls ? 'opacity-100' : 'opacity-0')}>
        <div className="truncate text-xs text-white/70 sm:text-[0.8125rem]">{subtitle}</div>
        <div className="truncate text-sm font-medium sm:text-[0.9375rem]">{title}</div>
      </div>

      <div style={stretched ? SAFE_BOTTOM : undefined} className={cn('absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-1.5 pt-10 transition-opacity sm:px-4 sm:pb-3 sm:pt-14', controls ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <div
          className="group/seek relative mb-2 flex h-4 cursor-pointer items-center"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
            setHover({ x: ratio * r.width, time: ratio * duration })
          }}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const v = videoRef.current
            if (v && duration) v.currentTime = ((e.clientX - r.left) / r.width) * duration
          }}
        >
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${pct}%` }} />
            {duration
              ? (skips ?? []).map((s) => (
                  <div
                    key={`${s.kind}:${s.start}`}
                    className={cn('absolute inset-y-0', SEGMENT_TONES[s.kind])}
                    style={{ left: `${(Math.max(0, s.start) / duration) * 100}%`, width: `${((Math.min(duration, s.end) - Math.max(0, s.start)) / duration) * 100}%` }}
                  />
                ))
              : null}
          </div>
          <div className="absolute size-3 -translate-x-1/2 rounded-full bg-accent shadow zoom-layer transition-transform [--zoom:0] group-hover/seek:[--zoom:1]" style={{ left: `${pct}%` }} />
          {hover ? (
            <div className="absolute -top-8 -translate-x-1/2 rounded-md bg-black/80 px-2 py-0.5 font-mono text-xs" style={{ left: hover.x }}>
              {formatTime(hover.time)}
              {hoverSegment ? <span className="ml-1.5 font-sans text-white/70">{t(`player.segment.${hoverSegment.kind}`)}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {onPrev ? <ControlButton label={t('player.prev')} onClick={onPrev} icon={<RiSkipBackFill className="fill-current" />} className="hidden sm:grid" /> : null}
          <ControlButton label={playing ? t('player.pause') : t('player.play')} onClick={toggle} icon={playing ? <RiPauseLargeFill /> : <RiPlayLargeFill />} />
          {onNext ? <ControlButton label={t('player.next')} onClick={onNext} icon={<RiSkipForwardFill className="fill-current" />} /> : null}
          <div className="group/vol flex items-center">
            <ControlButton label={t('player.mute')} onClick={() => setMuted((m) => !m)} icon={<VolumeIcon />} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value))
                setMuted(false)
              }}
              className="hidden w-0 cursor-pointer accent-[var(--accent)] opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:opacity-100 sm:block"
            />
          </div>
          <span className="ml-1 whitespace-nowrap font-mono text-[0.6875rem] text-white/80 sm:ml-2 sm:text-xs">
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {subtitlesUrl ? (
              <ControlButton label={t('player.subtitles')} onClick={() => setSubs(!subsOn)} icon={subsOn ? <RiClosedCaptioningFill /> : <RiClosedCaptioningLine />} active={subsOn} />
            ) : null}
            <div className="relative">
              <ControlButton label={t('player.quality')} onClick={() => setMenu(menu ? null : 'root')} icon={<RiSettings3Fill />} badge={`${source.height}p`} />
              {menu ? (
                <div className="absolute bottom-10 right-0 max-h-44 w-56 overflow-y-auto rounded-lg bg-black/85 p-1 sm:bottom-11 sm:max-h-none sm:w-60 sm:overflow-hidden text-sm shadow-2xl backdrop-blur-xl animate-pop" onClick={(e) => e.stopPropagation()}>
                  {menu === 'root' ? (
                    <>
                      <MenuRow icon={<RiSettings3Fill />} label={t('player.quality')} value={`${source.height}p`} onClick={() => setMenu('quality')} />
                      <MenuRow icon={<RiDashboard3Fill />} label={t('player.speed')} value={`${rate}×`} onClick={() => setMenu('speed')} />
                      {subtitlesUrl ? (
                        <MenuRow icon={<RiClosedCaptioningFill />} label={t('player.subtitles')} value={subsOn ? 'ASS' : t('player.subtitlesOff')} onClick={() => setMenu('subs')} />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setMenu('root')} className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-white/70 hover:bg-white/10">
                        <RiArrowLeftSFill className="size-4" />
                        {menu === 'quality' ? t('player.quality') : menu === 'speed' ? t('player.speed') : t('player.subtitles')}
                      </button>
                      {menu === 'quality'
                        ? sources.map((s) => <MenuOption key={s.url} label={`${s.height}p`} hint={s.type.toUpperCase()} active={s.url === source.url} onClick={() => chooseQuality(s)} />)
                        : null}
                      {menu === 'speed' ? RATES.map((r) => <MenuOption key={r} label={`${r}×`} active={r === rate} onClick={() => setRate(r)} />) : null}
                      {menu === 'subs' ? (
                        <>
                          <MenuOption label="ASS" active={subsOn} onClick={() => setSubs(true)} />
                          <MenuOption label={t('player.subtitlesOff')} active={!subsOn} onClick={() => setSubs(false)} />
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
            {document.pictureInPictureEnabled ? (
              <ControlButton label={t('player.pip')} onClick={() => void videoRef.current?.requestPictureInPicture().catch(() => undefined)} icon={<RiPictureInPicture2Fill />} />
            ) : null}
            <ControlButton label={t('player.fullscreen')} onClick={toggleFullscreen} icon={full ? <RiFullscreenExitFill /> : <RiFullscreenFill />} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ControlButton({ label, onClick, icon, active, badge, className }: { label: string; onClick: () => void; icon: ReactNode; active?: boolean; badge?: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn('relative grid size-8 cursor-pointer place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/10 sm:size-9 [&_svg]:size-4 sm:[&_svg]:size-[1.125rem]', active && 'text-accent', className)}
    >
      {icon}
      {badge ? <span className="absolute -right-1 -top-0.5 rounded bg-accent px-1 font-mono text-[0.5625rem] font-semibold leading-3.5 text-accent-foreground">{badge}</span> : null}
    </button>
  )
}

function MenuRow({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/10 [&_svg]:size-4 [&_svg]:text-white/60">
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span className="text-white/60">{value}</span>
    </button>
  )
}

function MenuOption({ label, hint, active, onClick }: { label: string; hint?: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/10">
      <RiCheckFill className={cn('size-4 text-accent', !active && 'invisible')} />
      <span className="flex-1 text-left">{label}</span>
      {hint ? <span className="font-mono text-[0.6875rem] text-white/50">{hint}</span> : null}
    </button>
  )
}
