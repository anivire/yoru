import type { StreamSource } from '@yoru/shared'
import { Kbd, Spinner, cn } from '@yoru/ui'
import type Hls from 'hls.js'
import type JASSUB from 'jassub'
import {
  Captions,
  CaptionsOff,
  Check,
  ChevronLeft,
  Gauge,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTime } from '../../lib/format'

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
}

function pickSource(sources: StreamSource[]): StreamSource {
  const preferred = Number(localStorage.getItem(QUALITY_KEY)) || 1080
  return sources.find((s) => s.height <= preferred) ?? sources[sources.length - 1] ?? sources[0]!
}

type Menu = null | 'root' | 'quality' | 'speed' | 'subs'

export function Player({ sources, subtitlesUrl, startAt, title, subtitle, autoPlay, onProgress, onEnded, onNext, onPrev }: PlayerProps) {
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
  const [controls, setControls] = useState(true)
  const [menu, setMenu] = useState<Menu>(null)
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSource(pickSource(sources))
    resumeRef.current = startAt
  }, [sources, startAt])

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
    }

    if (source.type === 'm3u8' && !video.canPlayType('application/vnd.apple.mpegurl')) {
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
    const onFs = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
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
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen()
  }, [])

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

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const pct = duration ? (time / duration) * 100 : 0

  return (
    <div
      ref={rootRef}
      className={cn('group/player relative aspect-video w-full overflow-hidden bg-black text-white', fullscreen ? 'rounded-none' : 'rounded-xl', !controls && 'cursor-none')}
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
            poke()
          }}
          onPause={() => {
            setPlaying(false)
            setControls(true)
            save(true)
          }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget
            setTime(v.currentTime)
            if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
            save()
          }}
          onEnded={() => {
            save(true)
            onEnded()
          }}
          onError={() => setError(t('player.noSources'))}
        />
      </div>

      {waiting && !error ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Spinner className="size-10 text-white/80" />
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center text-sm text-white/80">{error}</div>
      ) : null}

      {!playing && !waiting && !error ? (
        <button type="button" onClick={toggle} className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/90 text-black shadow-2xl">
          <Play className="ml-1 size-7 fill-current" />
        </button>
      ) : null}

      <div className={cn('pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pb-10 pt-4 transition-opacity', controls ? 'opacity-100' : 'opacity-0')}>
        <div className="text-[13px] text-white/70">{subtitle}</div>
        <div className="text-[15px] font-medium">{title}</div>
      </div>

      <div className={cn('absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-14 transition-opacity', controls ? 'opacity-100' : 'pointer-events-none opacity-0')}>
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
          </div>
          <div className="absolute size-3 -translate-x-1/2 scale-0 rounded-full bg-accent shadow transition-transform group-hover/seek:scale-100" style={{ left: `${pct}%` }} />
          {hover ? (
            <div className="absolute -top-8 -translate-x-1/2 rounded-md bg-black/80 px-2 py-0.5 font-mono text-xs" style={{ left: hover.x }}>
              {formatTime(hover.time)}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {onPrev ? <ControlButton label={t('player.prev')} onClick={onPrev} icon={<SkipBack className="fill-current" />} /> : null}
          <ControlButton label={playing ? t('player.pause') : t('player.play')} onClick={toggle} icon={playing ? <Pause className="fill-current" /> : <Play className="fill-current" />} />
          {onNext ? <ControlButton label={t('player.next')} onClick={onNext} icon={<SkipForward className="fill-current" />} /> : null}
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
              className="w-0 cursor-pointer accent-[var(--accent)] opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:opacity-100"
            />
          </div>
          <span className="ml-2 font-mono text-xs text-white/80">
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {subtitlesUrl ? (
              <ControlButton label={t('player.subtitles')} onClick={() => setSubs(!subsOn)} icon={subsOn ? <Captions /> : <CaptionsOff />} active={subsOn} />
            ) : null}
            <div className="relative">
              <ControlButton label={t('player.quality')} onClick={() => setMenu(menu ? null : 'root')} icon={<Settings />} badge={`${source.height}p`} />
              {menu ? (
                <div className="absolute bottom-11 right-0 w-60 overflow-hidden rounded-xl bg-black/85 p-1 text-sm shadow-2xl backdrop-blur-xl animate-pop" onClick={(e) => e.stopPropagation()}>
                  {menu === 'root' ? (
                    <>
                      <MenuRow icon={<Settings />} label={t('player.quality')} value={`${source.height}p`} onClick={() => setMenu('quality')} />
                      <MenuRow icon={<Gauge />} label={t('player.speed')} value={`${rate}×`} onClick={() => setMenu('speed')} />
                      {subtitlesUrl ? (
                        <MenuRow icon={<Captions />} label={t('player.subtitles')} value={subsOn ? 'ASS' : t('player.subtitlesOff')} onClick={() => setMenu('subs')} />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setMenu('root')} className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-white/70 hover:bg-white/10">
                        <ChevronLeft className="size-4" />
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
              <ControlButton label={t('player.pip')} onClick={() => void videoRef.current?.requestPictureInPicture().catch(() => undefined)} icon={<PictureInPicture2 />} />
            ) : null}
            <ControlButton label={t('player.fullscreen')} onClick={toggleFullscreen} icon={fullscreen ? <Minimize /> : <Maximize />} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ControlButton({ label, onClick, icon, active, badge }: { label: string; onClick: () => void; icon: ReactNode; active?: boolean; badge?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn('relative grid size-9 cursor-pointer place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/10 [&_svg]:size-[18px]', active && 'text-accent')}
    >
      {icon}
      {badge ? <span className="absolute -right-1 -top-0.5 rounded bg-accent px-1 font-mono text-[9px] font-semibold leading-3.5 text-accent-foreground">{badge}</span> : null}
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
      <Check className={cn('size-4 text-accent', !active && 'invisible')} />
      <span className="flex-1 text-left">{label}</span>
      {hint ? <span className="font-mono text-[11px] text-white/50">{hint}</span> : null}
    </button>
  )
}

export function PlayerShortcuts() {
  const keysList: [string, string][] = [
    ['Space', '⏯'],
    ['← →', '±5s'],
    ['J L', '±10s'],
    ['S', '+85s'],
    ['F', '⛶'],
    ['M', '🔇'],
    ['C', 'CC'],
    ['⇧N', '⏭'],
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-subtle-foreground">
      {keysList.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <Kbd>{k}</Kbd>
          {v}
        </span>
      ))}
    </div>
  )
}
