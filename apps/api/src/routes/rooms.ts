import { upgradeWebSocket } from '@hono/node-server'
import { type RoomServerMessage, roomClientMessageSchema, roomCreateSchema } from '@yoru/shared'
import { Hono } from 'hono'
import { type AppEnv, requireAuth } from '../lib/auth'
import { notFound } from '../lib/http'
import { parseBody } from '../lib/validate'
import { type RoomClient, activeRooms, createRoom, joinRoom, leaveRoom, roomInfo, setRoomMedia, setRoomPlayback } from '../services/rooms'

const MAX_MESSAGE = 4096

export const roomRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => c.json(activeRooms()))
  .post('/', async (c) => {
    const body = await parseBody(c, roomCreateSchema)
    return c.json(createRoom(body.malId, body.media))
  })
  .get('/:id', (c) => {
    const info = roomInfo(c.req.param('id'))
    if (!info) notFound('ROOM_NOT_FOUND')
    return c.json(info)
  })
  .get(
    '/:id/ws',
    upgradeWebSocket((c) => {
      const id = c.req.param('id') ?? ''
      const user = c.get('user')
      let client: RoomClient | null = null
      return {
        onOpen(_event, ws) {
          client = { member: { id: user.id, username: user.username }, send: (message: RoomServerMessage) => ws.send(JSON.stringify(message)) }
          if (!joinRoom(id, client)) ws.close(4404, 'ROOM_NOT_FOUND')
        },
        onMessage(event, ws) {
          if (!client || typeof event.data !== 'string' || event.data.length > MAX_MESSAGE) return
          let parsed
          try {
            parsed = roomClientMessageSchema.safeParse(JSON.parse(event.data))
          } catch {
            return
          }
          if (!parsed.success) return
          const message = parsed.data
          if (message.type === 'ping') ws.send(JSON.stringify({ type: 'pong', now: Date.now() } satisfies RoomServerMessage))
          else if (message.type === 'media') setRoomMedia(id, client, message.media)
          else setRoomPlayback(id, client, message.playback)
        },
        onClose() {
          if (client) leaveRoom(id, client)
          client = null
        },
      }
    }),
  )
