import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { z } from 'zod'

export async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' })
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new HTTPException(400, { message: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid body' })
  }
  return result.data
}

export function intParam(c: Context, name: string): number {
  const value = Number(c.req.param(name))
  if (!Number.isInteger(value) || value <= 0) throw new HTTPException(400, { message: `Invalid ${name}` })
  return value
}
