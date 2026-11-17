import type { StreamSource } from '@yoru/shared'
import { cn } from '@yoru/ui'
import type Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'

export function FramePreview({ sources, time, className }: { sources: StreamSource[]; time: number | null; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const seekingRef = useRef(false)
  const pendingRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const [shown, setShown] = useState(false)
  const source = useMemo(() => sources.reduce<StreamSource | undefined>((low, s) => (!low || s.height < low.height ? s : low), undefined), [sources])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !source) return
    let hls: Hls | null = null
    let cancelled = false
    const onMeta = () => setReady(true)
    video.addEventListener('loadedmetadata', onMeta)
    const mse = 'MediaSource' in window || 'ManagedMediaSource' in window
    if (source.type === 'm3u8' && (mse || !video.canPlayType('application/vnd.apple.mpegurl'))) {
      void import('hls.js').then(({ default: HlsCtor }) => {
        if (cancelled) return
        hls = new HlsCtor({ maxBufferLength: 1, maxMaxBufferLength: 2, startLevel: 0, capLevelToPlayerSize: true })
        hls.loadSource(source.url)
        hls.attachMedia(video)
      })
    } else {
      video.src = source.url
    }
    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', onMeta)
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [source])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !ready || time === null) return
    const target = Math.floor(time)
    if (seekingRef.current) {
      pendingRef.current = target
      return
    }
    seekingRef.current = true
    video.currentTime = target
  }, [time, ready])

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      disablePictureInPicture
      preload="metadata"
      onSeeked={(e) => {
        setShown(true)
        const pending = pendingRef.current
        pendingRef.current = null
        if (pending !== null && pending !== Math.floor(e.currentTarget.currentTime)) e.currentTarget.currentTime = pending
        else seekingRef.current = false
      }}
      className={cn('aspect-video w-40 rounded-md bg-black object-cover shadow-xl sm:w-48', !shown && 'hidden', className)}
    />
  )
}
