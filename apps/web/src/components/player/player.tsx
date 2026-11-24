import type { RoomPlayback, RoomPlaybackInput, SkipTime, StreamSource } from '@yoru/shared'
import { Spinner, cn } from '@yoru/ui'
import type Hls from 'hls.js'
import type JASSUB from 'jassub'
import { RiArrowLeftSFill, RiCheckFill, RiCloseLine, RiKeyboardBoxFill, RiClosedCaptioningFill, RiClosedCaptioningLine, RiDashboard3Fill, RiFullscreenExitFill, RiFullscreenFill, RiPauseLargeFill, RiPictureInPicture2Fill, RiPlayLargeFill, RiRewindFill, RiSpeedFill, RiSettings3Fill, RiSkipBackFill, RiSkipForwardFill, RiVolumeDownFill, RiVolumeMuteFill, RiVolumeUpFill } from '@remixicon/react'
import { useQuery } from '@tanstack/react-query'
import { Fragment, type MouseEvent, type PointerEvent, type ReactNode, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTime } from '../../lib/format'
import { assToVtt } from './ass-to-vtt'
import { FramePreview } from './frame-preview'
import { useAppearance } from '../../lib/appearance'
import { IS_IOS } from '../../lib/device'
import { duckSounds } from '../../lib/sounds'
import { readStorage, writeStorage } from '../../lib/storage'

const RATES = [0.75, 1, 1.25, 1.5, 2]
const QUALITY_KEY = 'yoru:quality'
const VOLUME_KEY = 'yoru:volume'
const SUBS_KEY = 'yoru:subs'
const AUTOSKIP_KEY = 'yoru:autoskip'
const AUTOSKIP_DELAY = 4

function readAutoSkip(): SkipTime['kind'][] {
  try {
    const value: unknown = JSON.parse(readStorage(AUTOSKIP_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((k): k is SkipTime['kind'] => k === 'op' || k === 'ed' || k === 'recap') : []
  } catch {
    return []
  }
}

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
const DOUBLE_TAP_MS = 300
const TAP_SEEK = 5
const HOLD_MS = 450
const HOLD_RATE = 2
const FLASH_MS = 650
const NOTICE_MS = 900
const ICON_FLASH_MS = 500
const CONTROLS_MS = 3000
const FRAME = 1 / 24
const SWIPE_EXIT = 80

function coarsePointer() {
  return window.matchMedia('(pointer: coarse)').matches
}

function lockOrientation(video: HTMLVideoElement | null) {
  if (!coarsePointer() || (video && video.videoHeight > video.videoWidth)) return
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
  void orientation.lock?.('landscape').catch(() => undefined)
}

function unlockOrientation() {
  try {
    screen.orientation?.unlock?.()
  } catch {
    return
  }
}
const RESUME_NOTICE_MS = 8000

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Space', 'K'], label: 'playPause' },
  { keys: ['←', '→'], label: 'seek5' },
  { keys: ['J', 'L'], label: 'seek10' },
  { keys: ['S'], label: 'skip85' },
  { keys: ['0–9'], label: 'jump' },
  { keys: ['Home', 'End'], label: 'startEnd' },
  { keys: [',', '.'], label: 'frame' },
  { keys: ['↑', '↓'], label: 'volume' },
  { keys: ['M'], label: 'mute' },
  { keys: ['<', '>'], label: 'speed' },
  { keys: ['C'], label: 'subtitles' },
  { keys: ['F'], label: 'fullscreen' },
  { keys: ['Shift+N', 'Shift+P'], label: 'episodes' },
  { keys: ['?'], label: 'help' },
]

const SEGMENT_TONES: Record<SkipTime['kind'], string> = {
  op: 'bg-accent/50',
  ed: 'bg-accent/50',
  recap: 'bg-accent/30',
}

function pickSource(sources: StreamSource[]): StreamSource {
  const preferred = Number(readStorage(QUALITY_KEY)) || 1080
  return sources.find((s) => s.height <= preferred) ?? sources[sources.length - 1] ?? sources[0]!
}

type Menu = null | 'root' | 'quality' | 'speed' | 'subs'

const SAFE_SIDES = { paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }
const SAFE_TOP = { ...SAFE_SIDES, paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }
const SAFE_BOTTOM = { ...SAFE_SIDES, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void }
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

function fullscreenTarget(root: HTMLElement | null): FullscreenElement | null {
  return (root?.closest<HTMLElement>('[data-player-frame]') ?? root) as FullscreenElement | null
}

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
  const [volume, setVolume] = useState(() => Number(readStorage(VOLUME_KEY) ?? 1))
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [subsOn, setSubsOn] = useState(() => readStorage(SUBS_KEY) !== 'off')
  const [fullscreen, setFullscreen] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [stretched, setStretched] = useState(false)
  const { iosFullscreen } = useAppearance()
  const nativeIos = IS_IOS && iosFullscreen === 'native'
  const full = fullscreen || stretched
  const [controls, setControls] = useState(true)
  const [menu, setMenu] = useState<Menu>(null)
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [autoSkip, setAutoSkip] = useState(readAutoSkip)
  const [entry, setEntry] = useState<{ key: string; from: number } | null>(null)
  const [help, setHelp] = useState(false)
  const [pip, setPip] = useState(false)
  const [seekFlash, setSeekFlash] = useState<{ side: -1 | 1; amount: number; at: number } | null>(null)
  const [notice, setNotice] = useState<{ text: string; at: number } | null>(null)
  const [holding, setHolding] = useState(false)
  const [touch, setTouch] = useState(coarsePointer)
  const [started, setStarted] = useState(false)
  const [iconFlash, setIconFlash] = useState<{ play: boolean; at: number } | null>(null)
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const pointerRef = useRef('mouse')
  const tapRef = useRef<{ at: number; side: number } | null>(null)
  const holdRef = useRef<{ timer?: number; active: boolean; consumed: boolean }>({ active: false, consumed: false })
  const rotatedRef = useRef(false)
  const flashSeek = (side: -1 | 1, amount: number) =>
    setSeekFlash((prev) => ({ side, amount: prev && prev.side === side ? prev.amount + amount : amount, at: performance.now() }))
  const [preview, setPreview] = useState(false)
  const [resumeFrom, setResumeFrom] = useState(startAt > 0 ? startAt : null)
  const changeAutoSkip = (kind: SkipTime['kind'], on: boolean) => {
    const next = on ? [...new Set([...autoSkip, kind])] : autoSkip.filter((k) => k !== kind)
    setAutoSkip(next)
    writeStorage(AUTOSKIP_KEY, JSON.stringify(next))
  }
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
  useEffect(() => () => duckSounds(false), [])
  useEffect(() => {
    rateRef.current = rate
  }, [rate])
  useEffect(() => {
    if (!seekFlash) return
    const id = window.setTimeout(() => setSeekFlash(null), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [seekFlash])
  useEffect(() => {
    if (!iconFlash) return
    const id = window.setTimeout(() => setIconFlash(null), ICON_FLASH_MS)
    return () => window.clearTimeout(id)
  }, [iconFlash])
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(id)
  }, [notice])
  useEffect(() => {
    if (resumeFrom === null || !playing) return
    const id = window.setTimeout(() => setResumeFrom(null), RESUME_NOTICE_MS)
    return () => window.clearTimeout(id)
  }, [resumeFrom, playing])
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
    if (!video) return
    const enter = () => setPip(true)
    const leave = () => setPip(false)
    video.addEventListener('enterpictureinpicture', enter)
    video.addEventListener('leavepictureinpicture', leave)
    return () => {
      video.removeEventListener('enterpictureinpicture', enter)
      video.removeEventListener('leavepictureinpicture', leave)
      if (document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => undefined)
    }
  }, [])

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
    writeStorage(VOLUME_KEY, String(volume))
  }, [volume, muted])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate
  }, [rate])

  useEffect(() => {
    const onFs = () => {
      const on = Boolean(rootRef.current) && fullscreenElement() === fullscreenTarget(rootRef.current)
      setFullscreen(on)
      if (!on) {
        rotatedRef.current = false
        unlockOrientation()
      }
    }
    onFs()
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
    }, CONTROLS_MS)
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
    const root = fullscreenTarget(rootRef.current)
    const video = videoRef.current as IosVideo | null
    const native = () => video?.webkitEnterFullscreen?.()
    const fallback = () => (IS_IOS ? setStretched(true) : native())
    if (nativeIos) native()
    else if (root?.requestFullscreen) void root.requestFullscreen().then(() => lockOrientation(video), fallback)
    else if (root?.webkitRequestFullscreen) root.webkitRequestFullscreen()
    else fallback()
  }, [stretched, nativeIos])

  useEffect(() => {
    if (nativeIos) return
    const media = window.matchMedia('(orientation: landscape)')
    const onChange = () => {
      const root = fullscreenTarget(rootRef.current)
      const video = videoRef.current
      if (!coarsePointer() || !root) return
      if (media.matches) {
        if (!video || video.paused || fullscreenElement() || !root.requestFullscreen) return
        rotatedRef.current = true
        void root.requestFullscreen().catch(() => {
          rotatedRef.current = false
        })
      } else if (rotatedRef.current && fullscreenElement() === root) {
        rotatedRef.current = false
        void document.exitFullscreen().catch(() => undefined)
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [nativeIos])

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
    writeStorage(SUBS_KEY, on ? 'on' : 'off')
  }

  const chooseQuality = (s: StreamSource) => {
    resumeRef.current = videoRef.current?.currentTime ?? 0
    writeStorage(QUALITY_KEY, String(s.height))
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
          setIconFlash({ play: v.paused, at: performance.now() })
          toggle()
          break
        case ',':
        case '.':
          if (!v.paused) return
          v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + (e.key === '.' ? FRAME : -FRAME)))
          break
        case 'Home':
          v.currentTime = 0
          break
        case 'End':
          if (v.duration) v.currentTime = v.duration
          break
        case 'ArrowLeft':
        case 'j':
          seekBy(e.key === 'j' ? -10 : -5)
          flashSeek(-1, e.key === 'j' ? 10 : 5)
          break
        case 'ArrowRight':
        case 'l':
          seekBy(e.key === 'l' ? 10 : 5)
          flashSeek(1, e.key === 'l' ? 10 : 5)
          break
        case 'ArrowUp':
        case 'ArrowDown': {
          const next = Math.round(Math.max(0, Math.min(1, (muted ? 0 : volume) + (e.key === 'ArrowUp' ? 0.1 : -0.1))) * 100) / 100
          setVolume(next)
          setMuted(false)
          setNotice({ text: `${Math.round(next * 100)}%`, at: performance.now() })
          break
        }
        case 'f':
          toggleFullscreen()
          break
        case 'm':
          setMuted(!muted)
          setNotice({ text: muted ? `${Math.round(volume * 100)}%` : t('player.muted'), at: performance.now() })
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
        case '>':
        case '<': {
          const i = RATES.indexOf(rateRef.current)
          const next = RATES[Math.max(0, Math.min(RATES.length - 1, (i === -1 ? RATES.indexOf(1) : i) + (e.key === '>' ? 1 : -1)))] ?? 1
          setRate(next)
          setNotice({ text: `${next}×`, at: performance.now() })
          break
        }
        case '?':
          setHelp((h) => !h)
          break
        case 'Escape':
          if (!help) return
          setHelp(false)
          break
        default:
          if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey && v.duration) {
            v.currentTime = (v.duration * Number(e.key)) / 10
            break
          }
          return
      }
      e.preventDefault()
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, seekBy, toggleFullscreen, poke, onNext, onPrev, subsOn, help, volume, muted, t])

  const startHold = () => {
    const v = videoRef.current
    if (!v || v.paused || sync) return
    holdRef.current.active = true
    setVideoRate(v, HOLD_RATE)
    setHolding(true)
  }
  const endHold = () => {
    window.clearTimeout(holdRef.current.timer)
    if (!holdRef.current.active) return
    holdRef.current.active = false
    holdRef.current.consumed = true
    const v = videoRef.current
    if (v) setVideoRate(v, rateRef.current)
    setHolding(false)
  }
  const tap = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const side = x < 0.4 ? -1 : x > 0.6 ? 1 : 0
    const last = tapRef.current
    tapRef.current = { at: e.timeStamp, side }
    if (side && last && last.side === side && e.timeStamp - last.at < DOUBLE_TAP_MS) {
      seekBy(side * TAP_SEEK)
      flashSeek(side, TAP_SEEK)
      setMenu(null)
      if (videoRef.current && !videoRef.current.paused) setControls(false)
      return
    }
    if (menu) setMenu(null)
    else if (controls) setControls(false)
    else poke()
  }

  const segmentAt = (at: number) => skips?.find((s) => at >= s.start && at < s.end - 1)
  const activeSkip = segmentAt(time)
  const skipSegment = (s: SkipTime) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.min(s.end, v.duration || s.end)
  }
  const autoLeft = activeSkip && autoSkip.includes(activeSkip.kind) ? Math.max(1, Math.ceil(AUTOSKIP_DELAY - (entry?.key === `${activeSkip.kind}:${activeSkip.start}` ? time - entry.from : 0))) : null

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
  const seekPoint = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    return { x: ratio * r.width, time: ratio * duration }
  }
  const pct = duration ? ((drag ?? time) / duration) * 100 : 0
  const hoverSegment = hover ? skips?.find((s) => hover.time >= s.start && hover.time <= s.end) : undefined

  return (
    <div
      ref={rootRef}
      data-sound="none"
      data-player-stretched={stretched ? '' : undefined}
      className={cn(
        'group/player overflow-hidden bg-black text-white',
        stretched ? 'fixed inset-0 z-[100] h-dvh w-screen' : fullscreen ? 'relative h-full w-full' : 'relative aspect-video w-full',
        full ? 'rounded-none' : 'rounded-xl',
        !controls && 'cursor-none',
      )}
      onPointerDownCapture={(e) => {
        pointerRef.current = e.pointerType
        setTouch(e.pointerType === 'touch')
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') poke()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && playing) setControls(false)
      }}
    >
      <div
        className={cn('absolute inset-0 select-none [-webkit-touch-callout:none]', full && 'touch-none')}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          window.clearTimeout(holdRef.current.timer)
          holdRef.current.consumed = false
          holdRef.current.timer = window.setTimeout(startHold, HOLD_MS)
          swipeRef.current = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null
        }}
        onPointerMove={(e) => {
          const start = swipeRef.current
          if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) window.clearTimeout(holdRef.current.timer)
        }}
        onPointerUp={(e) => {
          const start = swipeRef.current
          swipeRef.current = null
          if (start && full && e.clientY - start.y > SWIPE_EXIT && Math.abs(e.clientX - start.x) < SWIPE_EXIT) {
            holdRef.current.consumed = true
            toggleFullscreen()
          }
          endHold()
        }}
        onPointerCancel={endHold}
        onPointerLeave={endHold}
        onContextMenu={(e) => {
          if (pointerRef.current === 'touch') e.preventDefault()
        }}
        onClick={(e) => {
          if (holdRef.current.consumed) {
            holdRef.current.consumed = false
            return
          }
          if (pointerRef.current === 'touch') tap(e)
          else if (menu) setMenu(null)
          else {
            setIconFlash({ play: Boolean(videoRef.current?.paused), at: performance.now() })
            toggle()
          }
        }}
        onDoubleClick={() => {
          if (pointerRef.current !== 'touch') toggleFullscreen()
        }}
      >
        <video
          ref={videoRef}
          className="h-full w-full"
          playsInline
          preload="metadata"
          onPlay={() => {
            duckSounds(true)
            setPlaying(true)
            setStarted(true)
            setCountdown(null)
            setBlocked(false)
            poke()
            reportSync()
          }}
          onPause={() => {
            duckSounds(false)
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
            const segment = segmentAt(v.currentTime)
            const key = segment ? `${segment.kind}:${segment.start}` : null
            if (entry?.key !== key) setEntry(key ? { key, from: v.currentTime } : null)
            else if (segment && entry && autoSkip.includes(segment.kind) && v.currentTime - entry.from >= AUTOSKIP_DELAY) skipSegment(segment)
            save()
          }}
          onEnded={() => {
            duckSounds(false)
            save(true)
            if (autoNext && onNext) setCountdown(COUNTDOWN_SECONDS)
          }}
          onError={() => setError(t('player.noSources'))}
        >
          {vttUrl && subsOn ? <track key={vttUrl} kind="subtitles" srcLang="ru" label={t('player.subtitles')} src={vttUrl} /> : null}
        </video>
      </div>

      {waiting && !error && !pip ? (
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
        <div className={cn('absolute right-3 z-10 flex gap-2 transition-[bottom] sm:right-5', controls ? 'bottom-20 sm:bottom-24' : 'bottom-5')}>
          {autoLeft !== null ? (
            <button
              type="button"
              onClick={() => {
                changeAutoSkip(activeSkip.kind, false)
                poke()
              }}
              className="h-10 cursor-pointer rounded-xl bg-black/60 px-4 text-sm font-medium text-white shadow-2xl hover:bg-black/75"
            >
              {t(`player.watch.${activeSkip.kind}`)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              changeAutoSkip(activeSkip.kind, true)
              skipSegment(activeSkip)
              poke()
            }}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white/90 px-4 text-sm font-semibold text-black shadow-2xl hover:bg-white"
          >
            <RiSkipForwardFill className="size-4" />
            {t(`player.skip.${activeSkip.kind}`)}
            {autoLeft !== null ? <span className="tabular-nums text-black/50">{autoLeft}</span> : null}
          </button>
        </div>
      ) : null}

      {resumeFrom !== null && !error && countdown === null && !activeSkip && !(touch && controls) ? (
        <div
          className={cn(
            'absolute left-3 z-10 flex items-center whitespace-nowrap bg-black/60 text-white shadow-2xl transition-[bottom] sm:left-5',
            touch ? 'bottom-3 h-8 gap-2 rounded-lg pl-3 pr-1 text-xs' : 'h-10 gap-3 rounded-xl pl-4 pr-1 text-sm',
            !touch && (controls ? 'bottom-24' : 'bottom-5'),
          )}
        >
          {t('player.resumed', { time: formatTime(resumeFrom) })}
          <button
            type="button"
            onClick={() => {
              const v = videoRef.current
              if (v) v.currentTime = 0
              setResumeFrom(null)
              poke()
            }}
            className={cn('cursor-pointer bg-white/15 font-medium hover:bg-white/25', touch ? 'h-6 rounded-md px-2' : 'h-8 rounded-lg px-3')}
          >
            {t('player.fromStart')}
          </button>
        </div>
      ) : null}

      {help ? (
        <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/70 p-4" onClick={() => setHelp(false)}>
          <div className="w-full max-w-md rounded-2xl bg-black/85 p-4 shadow-2xl backdrop-blur-xl animate-pop sm:p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[0.9375rem] font-semibold">{t('player.keys.title')}</div>
              <button type="button" onClick={() => setHelp(false)} aria-label={t('common.close')} className="grid size-8 cursor-pointer place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
                <RiCloseLine className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[0.8125rem]">
              {SHORTCUTS.map((s) => (
                <Fragment key={s.label}>
                  <div className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className="min-w-7 rounded-md bg-white/15 px-1.5 py-0.5 text-center text-xs">
                        {k}
                      </kbd>
                    ))}
                  </div>
                  <span className="text-white/80">{t(`player.keys.${s.label}`)}</span>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {countdown !== null ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-sm text-white/70">{t('player.nextIn')}</div>
            <div className="text-5xl font-semibold tabular-nums">{countdown}</div>
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

      {seekFlash ? (
        <div
          key={seekFlash.side}
          className={cn('pointer-events-none absolute inset-y-0 z-10 grid w-[38%] place-items-center bg-white/10 animate-fade', seekFlash.side < 0 ? 'left-0 rounded-r-[50%]' : 'right-0 rounded-l-[50%]')}
        >
          <div className="flex flex-col items-center gap-1">
            {seekFlash.side < 0 ? <RiRewindFill className="size-7" /> : <RiSpeedFill className="size-7" />}
            <span className="text-xs font-semibold">{t('player.seekSeconds', { count: seekFlash.amount })}</span>
          </div>
        </div>
      ) : null}

      {iconFlash && !touch ? (
        <div key={iconFlash.at} className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 animate-icon-flash">
          {iconFlash.play ? <RiPlayLargeFill className="size-8" /> : <RiPauseLargeFill className="size-8" />}
        </div>
      ) : null}

      {!started && !touch && !playing && !waiting && !error && !blocked && countdown === null ? (
        <button type="button" onClick={toggle} aria-label={t('player.play')} className="absolute left-1/2 top-1/2 z-10 grid size-16 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/90 text-black shadow-2xl">
          <RiPlayLargeFill className="size-8" />
        </button>
      ) : null}

      {touch && !error && !pip && countdown === null ? (
        <div className={cn('pointer-events-none absolute inset-0 z-[5] flex items-center justify-center gap-10 bg-black/40 transition-opacity duration-200', controls && !seekFlash ? 'opacity-100' : 'opacity-0')}>
          <TouchButton label={t('player.prev')} onClick={onPrev} enabled={controls && !seekFlash} icon={<RiSkipBackFill className="size-6" />} />
          {waiting ? (
            <span className="size-16" />
          ) : (
            <TouchButton label={playing ? t('player.pause') : t('player.play')} onClick={toggle} enabled={controls && !seekFlash} large icon={playing ? <RiPauseLargeFill className="size-8" /> : <RiPlayLargeFill className="size-8" />} />
          )}
          <TouchButton label={t('player.next')} onClick={onNext} enabled={controls && !seekFlash} icon={<RiSkipForwardFill className="size-6" />} />
        </div>
      ) : null}

      {touch && !controls && !full && duration ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/25">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      {holding || notice ? (
        <div className="pointer-events-none absolute left-1/2 top-14 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/65 px-3.5 py-1.5 text-sm font-semibold shadow-2xl animate-fade">
          {holding ? (
            <>
              {HOLD_RATE}×
              <RiSpeedFill className="size-4" />
            </>
          ) : (
            notice?.text
          )}
        </div>
      ) : null}

      <div style={stretched ? SAFE_TOP : undefined} className={cn('pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-2.5 transition-opacity sm:px-5 sm:pb-10 sm:pt-4', controls ? 'opacity-100' : 'opacity-0')}>
        <div className="truncate text-xs text-white/70 sm:text-[0.8125rem]">{subtitle}</div>
        <div className="truncate text-sm font-medium sm:text-[0.9375rem]">{title}</div>
      </div>

      <div onPointerDown={poke} style={stretched ? SAFE_BOTTOM : undefined} className={cn('absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-1.5 pt-10 transition-opacity sm:px-4 sm:pb-3 sm:pt-14', controls ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <div
          className="group/seek relative mb-2 flex h-4 cursor-pointer touch-none items-center"
          onPointerDown={(e) => {
            if (!duration || e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            const point = seekPoint(e)
            setHover(point)
            setDrag(point.time)
          }}
          onPointerMove={(e) => {
            const point = seekPoint(e)
            if (e.pointerType === 'mouse' || drag !== null) {
              setHover(point)
              setPreview(true)
            }
            if (drag !== null) {
              setDrag(point.time)
              poke()
            }
          }}
          onPointerUp={(e) => {
            if (drag === null) return
            const target = seekPoint(e).time
            const v = videoRef.current
            if (v) v.currentTime = target
            setTime(target)
            setDrag(null)
            if (e.pointerType !== 'mouse') setHover(null)
          }}
          onPointerCancel={() => {
            setDrag(null)
            setHover(null)
          }}
          onPointerLeave={() => drag === null && setHover(null)}
        >
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            {duration
              ? (skips ?? []).map((s) => (
                  <div
                    key={`${s.kind}:${s.start}`}
                    className={cn('absolute inset-y-0', SEGMENT_TONES[s.kind])}
                    style={{ left: `${(Math.max(0, s.start) / duration) * 100}%`, width: `${((Math.min(duration, s.end) - Math.max(0, s.start)) / duration) * 100}%` }}
                  />
                ))
              : null}
            <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <div className={cn('absolute size-3 -translate-x-1/2 rounded-full bg-accent shadow zoom-layer transition-transform group-hover/seek:[--zoom:1]', drag === null ? '[--zoom:0]' : '[--zoom:1]')} style={{ left: `${pct}%` }} />
          {hover || preview ? (
            <div
              className={cn('pointer-events-none absolute bottom-full mb-3 flex -translate-x-1/2 flex-col items-center gap-1.5', !hover && 'invisible')}
              style={{ left: preview ? `clamp(6rem, ${hover?.x ?? 0}px, calc(100% - 6rem))` : hover?.x }}
            >
              {preview ? <FramePreview sources={sources} time={hover?.time ?? null} /> : null}
              <div className="rounded-md bg-black/80 px-2 py-0.5 text-xs tabular-nums">
                {formatTime(hover?.time ?? 0)}
                {hoverSegment ? <span className="ml-1.5 text-white/70">{t(`player.segment.${hoverSegment.kind}`)}</span> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {touch ? null : (
            <div className={PILL}>
              {onPrev ? <ControlButton label={t('player.prev')} onClick={onPrev} icon={<RiSkipBackFill className="fill-current" />} className="hidden sm:grid" /> : null}
              <ControlButton label={playing ? t('player.pause') : t('player.play')} onClick={toggle} icon={playing ? <RiPauseLargeFill /> : <RiPlayLargeFill />} />
              {onNext ? <ControlButton label={t('player.next')} onClick={onNext} icon={<RiSkipForwardFill className="fill-current" />} /> : null}
            </div>
          )}
          <div className={cn(PILL, 'group/vol')}>
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
              className="hidden w-0 cursor-pointer accent-[var(--accent)] opacity-0 transition-all group-hover/vol:mr-3 group-hover/vol:w-20 group-hover/vol:opacity-100 sm:block"
            />
          </div>
          <span className={cn(PILL, 'whitespace-nowrap px-3 text-[0.6875rem] tabular-nums text-white/90 sm:px-3.5 sm:text-xs')}>
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <div className={cn(PILL, 'ml-auto')}>
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
                      <MenuRow
                        icon={<RiKeyboardBoxFill />}
                        label={t('player.keys.title')}
                        value="?"
                        onClick={() => {
                          setMenu(null)
                          setHelp(true)
                        }}
                      />
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
              <ControlButton
                label={t('player.pip')}
                active={pip}
                onClick={() => void (pip ? document.exitPictureInPicture() : videoRef.current?.requestPictureInPicture())?.catch(() => undefined)}
                icon={<RiPictureInPicture2Fill />}
              />
            ) : null}
            <ControlButton label={t('player.fullscreen')} onClick={toggleFullscreen} icon={full ? <RiFullscreenExitFill /> : <RiFullscreenFill />} />
          </div>
        </div>
      </div>
    </div>
  )
}

const PILL = 'flex h-9 items-center rounded-full bg-black/50 px-0.5 sm:h-10'

function TouchButton({ label, onClick, icon, enabled, large }: { label: string; onClick?: () => void; icon: ReactNode; enabled: boolean; large?: boolean }) {
  if (!onClick) return <span className={large ? 'size-16' : 'size-12'} />
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={enabled ? 0 : -1}
      onClick={onClick}
      className={cn('grid cursor-pointer place-items-center rounded-full bg-black/35 text-white', large ? 'size-16' : 'size-12', enabled && 'pointer-events-auto')}
    >
      {icon}
    </button>
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
      className={cn('relative grid size-8 cursor-pointer place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 sm:size-9 [&_svg]:size-4 sm:[&_svg]:size-[1.125rem]', active && 'text-accent', className)}
    >
      {icon}
      {badge ? <span className="absolute -right-1 -top-0.5 rounded bg-accent px-1 text-[0.5625rem] font-semibold leading-3.5 text-accent-foreground">{badge}</span> : null}
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
      {hint ? <span className="text-[0.6875rem] text-white/50">{hint}</span> : null}
    </button>
  )
}
