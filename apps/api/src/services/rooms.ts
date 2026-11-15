import type { RoomInfo, RoomListItem, RoomMedia, RoomMember, RoomPlayback, RoomPlaybackInput, RoomServerMessage } from '@yoru/shared'
import { getAnimeRow, toSummary } from './anime'
import { randomToken } from '../lib/crypto'

const IDLE_MS = 30 * 60_000
const MAX_ROOMS = 200

export interface RoomClient {
  member: RoomMember
  send: (message: RoomServerMessage) => void
}

interface Room {
  id: string
  malId: number
  media: RoomMedia
  playback: RoomPlayback
  clients: Set<RoomClient>
  touchedAt: number
}

const rooms = new Map<string, Room>()

function sweep() {
  const cutoff = Date.now() - IDLE_MS
  for (const room of rooms.values()) if (!room.clients.size && room.touchedAt < cutoff) rooms.delete(room.id)
}

setInterval(sweep, 60_000).unref()

function members(room: Room): RoomMember[] {
  const unique = new Map<number, RoomMember>()
  for (const client of room.clients) unique.set(client.member.id, client.member)
  return [...unique.values()]
}

function broadcast(room: Room, message: RoomServerMessage, except?: RoomClient) {
  for (const client of room.clients) if (client !== except) client.send(message)
}

function stopped(): RoomPlayback {
  return { playing: false, position: 0, rate: 1, at: Date.now() }
}

export function createRoom(malId: number, media: RoomMedia): RoomInfo {
  sweep()
  if (rooms.size >= MAX_ROOMS) throw new Error('ROOM_LIMIT')
  const id = randomToken(9)
  rooms.set(id, { id, malId, media, playback: stopped(), clients: new Set(), touchedAt: Date.now() })
  return { id, malId }
}

export function activeRooms(): RoomListItem[] {
  const list: RoomListItem[] = []
  for (const room of rooms.values()) {
    if (!room.clients.size) continue
    const row = getAnimeRow(room.malId)
    if (!row) continue
    list.push({ id: room.id, anime: toSummary(row), episode: room.media.episode, playing: room.playback.playing, members: members(room) })
  }
  return list.sort((a, b) => b.members.length - a.members.length)
}

export function roomInfo(id: string): RoomInfo | null {
  const room = rooms.get(id)
  return room ? { id: room.id, malId: room.malId } : null
}

export function joinRoom(id: string, client: RoomClient): boolean {
  const room = rooms.get(id)
  if (!room) return false
  room.clients.add(client)
  room.touchedAt = Date.now()
  client.send({ type: 'snapshot', room: { id: room.id, malId: room.malId }, media: room.media, playback: room.playback, members: members(room), now: Date.now() })
  broadcast(room, { type: 'members', members: members(room) }, client)
  return true
}

export function leaveRoom(id: string, client: RoomClient) {
  const room = rooms.get(id)
  if (!room || !room.clients.delete(client)) return
  room.touchedAt = Date.now()
  broadcast(room, { type: 'members', members: members(room) })
}

export function setRoomMedia(id: string, client: RoomClient, media: RoomMedia) {
  const room = rooms.get(id)
  if (!room) return
  const episodeChanged = media.episode !== room.media.episode || media.source !== room.media.source || media.kind !== room.media.kind
  room.media = media
  if (episodeChanged) room.playback = { ...stopped(), playing: room.playback.playing, rate: room.playback.rate }
  room.touchedAt = Date.now()
  broadcast(room, { type: 'media', media, playback: room.playback, by: client.member, now: Date.now() }, client)
}

export function setRoomPlayback(id: string, client: RoomClient, input: RoomPlaybackInput) {
  const room = rooms.get(id)
  if (!room) return
  room.playback = { ...input, at: Date.now() }
  room.touchedAt = Date.now()
  broadcast(room, { type: 'playback', playback: room.playback, by: client.member, now: Date.now() }, client)
}
