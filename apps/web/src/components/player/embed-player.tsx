import { useEffect, useEffectEvent, useRef } from 'react'

const SAVE_INTERVAL_MS = 15_000

interface KodikMessage {
  key?: unknown
  value?: unknown
}

export function EmbedPlayer({
  url,
  startAt,
  onProgress,
  onEnded,
  onDuration,
}: {
  url: string
  startAt: number
  onProgress: (position: number, duration: number) => void
  onEnded: () => void
  onDuration?: (duration: number) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const state = useRef({ position: 0, duration: 0, savedAt: 0, seeked: false })

  const handle = useEffectEvent((message: KodikMessage) => {
    const s = state.current
    const value = typeof message.value === 'number' && Number.isFinite(message.value) ? message.value : null
    if (message.key === 'kodik_player_duration_update' && value) {
      s.duration = value
      onDuration?.(value)
      if (!s.seeked && startAt > 0) {
        s.seeked = true
        frame.current?.contentWindow?.postMessage({ key: 'kodik_player_api', value: { method: 'seek', seconds: startAt } }, '*')
      }
    } else if (message.key === 'kodik_player_time_update' && value !== null) {
      s.position = value
      if (s.duration && Date.now() - s.savedAt > SAVE_INTERVAL_MS) {
        s.savedAt = Date.now()
        onProgress(s.position, s.duration)
      }
    } else if (message.key === 'kodik_player_pause' && s.duration) {
      s.savedAt = Date.now()
      onProgress(s.position, s.duration)
    } else if (message.key === 'kodik_player_video_ended') {
      if (s.duration) onProgress(s.duration, s.duration)
      onEnded()
    }
  })

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== 'object') return
      handle(event.data as KodikMessage)
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [])

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe ref={frame} src={url} title="player" className="size-full border-0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
    </div>
  )
}
