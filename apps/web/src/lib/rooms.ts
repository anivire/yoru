import type { RoomClientMessage, RoomMedia, RoomMember, RoomPlayback, RoomPlaybackInput, RoomServerMessage } from '@yoru/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

export type RoomStatus = 'connecting' | 'open' | 'missing' | 'offline'

export interface RoomAction {
  by: RoomMember
  kind: 'play' | 'pause' | 'seek' | 'media'
  at: number
}

export interface RoomState {
  status: RoomStatus
  media: RoomMedia | null
  mediaSeq: number
  playback: (RoomPlayback & { seq: number }) | null
  members: RoomMember[]
  offset: number
  action: RoomAction | null
  rtt: number | null
  messages: number
  reconnects: number
}

const INITIAL: RoomState = { status: 'connecting', media: null, mediaSeq: 0, playback: null, members: [], offset: 0, action: null, rtt: null, messages: 0, reconnects: 0 }
const PING_MS = 10_000
const MAX_RETRY_MS = 10_000

function socketUrl(id: string) {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rooms/${encodeURIComponent(id)}/ws`
}

function playbackAction(prev: RoomPlayback | null, next: RoomPlayback): RoomAction['kind'] {
  if (!prev || prev.playing !== next.playing) return next.playing ? 'play' : 'pause'
  return 'seek'
}

export function useRoom(id: string | null) {
  const [state, setState] = useState<RoomState>(INITIAL)
  const socketRef = useRef<WebSocket | null>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!id) return
    let closed = false
    let retry = 500
    let retryTimer: number | undefined
    let pingTimer: number | undefined
    let pingSentAt = 0
    let bestRtt = Infinity
    let attempts = 0
    setState(INITIAL)

    const connect = () => {
      const reconnects = attempts++
      const ws = new WebSocket(socketUrl(id))
      socketRef.current = ws
      setState((s) => ({ ...s, reconnects, status: s.status === 'open' ? 'offline' : s.status }))
      ws.onopen = () => {
        retry = 500
        const ping = () => {
          if (ws.readyState !== WebSocket.OPEN) return
          pingSentAt = Date.now()
          ws.send(JSON.stringify({ type: 'ping' } satisfies RoomClientMessage))
        }
        ping()
        pingTimer = window.setInterval(ping, PING_MS)
      }
      ws.onmessage = (event) => {
        let message: RoomServerMessage
        try {
          message = JSON.parse(String(event.data)) as RoomServerMessage
        } catch {
          return
        }
        const received = Date.now()
        let offset: number | undefined
        if (message.type === 'pong' && pingSentAt) {
          const rtt = received - pingSentAt
          if (rtt <= bestRtt) {
            bestRtt = rtt
            offset = message.now - (received - rtt / 2)
          }
        } else if ('now' in message && bestRtt === Infinity) {
          offset = message.now - received
        }
        setState((s) => {
          const counted = { ...s, messages: s.messages + 1 }
          const base = offset === undefined ? counted : { ...counted, offset }
          if (message.type === 'snapshot') {
            return { ...base, status: 'open', media: message.media, mediaSeq: s.mediaSeq + 1, playback: { ...message.playback, seq: ++seqRef.current }, members: message.members }
          }
          if (message.type === 'media') {
            return { ...base, media: message.media, mediaSeq: s.mediaSeq + 1, playback: { ...message.playback, seq: ++seqRef.current }, action: { by: message.by, kind: 'media', at: Date.now() } }
          }
          if (message.type === 'playback') {
            return { ...base, playback: { ...message.playback, seq: ++seqRef.current }, action: { by: message.by, kind: playbackAction(s.playback, message.playback), at: Date.now() } }
          }
          if (message.type === 'members') return { ...base, members: message.members }
          if (message.type === 'pong' && pingSentAt) return { ...base, rtt: received - pingSentAt }
          return base
        })
      }
      ws.onclose = (event) => {
        window.clearInterval(pingTimer)
        if (socketRef.current === ws) socketRef.current = null
        if (closed) return
        if (event.code === 4404) {
          setState((s) => ({ ...s, status: 'missing' }))
          return
        }
        setState((s) => ({ ...s, status: 'offline' }))
        retryTimer = window.setTimeout(connect, retry)
        retry = Math.min(MAX_RETRY_MS, retry * 2)
      }
    }

    connect()
    return () => {
      closed = true
      window.clearTimeout(retryTimer)
      window.clearInterval(pingTimer)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [id])

  const send = useCallback((message: RoomClientMessage) => {
    const ws = socketRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }, [])

  const sendMedia = useCallback(
    (media: RoomMedia) => {
      send({ type: 'media', media })
      setState((s) => ({ ...s, media, playback: s.playback ? { ...s.playback, position: 0, at: Date.now() + s.offset } : s.playback }))
    },
    [send],
  )

  const sendPlayback = useCallback(
    (playback: RoomPlaybackInput) => {
      send({ type: 'playback', playback })
      setState((s) => ({ ...s, playback: { ...playback, at: Date.now() + s.offset, seq: s.playback?.seq ?? 0 } }))
    },
    [send],
  )

  return { ...state, active: Boolean(id), sendMedia, sendPlayback }
}

export type Room = ReturnType<typeof useRoom>

export function roomUrl(id: string) {
  return `${location.origin}/together/${encodeURIComponent(id)}`
}
