import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'
import { compareSchemas } from '../../../lib/compare'
import { encodeComparison, MAX_REDIS_VALUE_BYTES, storedComparisonBytes } from '../../../lib/share-storage'
import { apiRateLimit, MAX_SCHEMA_BYTES, requestIp, utf8Bytes } from '../../../lib/request-limits'
import { diff, emitDbml, emitJson, emitMigration, emitText } from 'dbml-diff'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const limit = await apiRateLimit.limit(`share:${requestIp(request)}`)
    if (!limit.success) return Response.json({ error: 'Rate limit exceeded. Please try again in a minute.' }, { status: 429 })

    const body = await request.json()
    const oldDbml = typeof body.oldDbml === 'string' ? body.oldDbml : ''
    const newDbml = typeof body.newDbml === 'string' ? body.newDbml : ''
    if (utf8Bytes(oldDbml) > MAX_SCHEMA_BYTES || utf8Bytes(newDbml) > MAX_SCHEMA_BYTES) {
      return Response.json({ error: 'Each schema must be 500 KB or smaller.' }, { status: 413 })
    }
    if (!oldDbml.trim() || !newDbml.trim()) {
      return Response.json({ error: 'Both DBML schemas are required.' }, { status: 400 })
    }

    const result = diff(oldDbml, newDbml)
    const parsedResult = JSON.parse(emitJson(result))
    const comparison = {
      id: nanoid(10), oldDbml, newDbml,
      createdAt: new Date().toISOString(), parsedResult,
      text: emitText(result), migration: emitMigration(result), dbml: emitDbml(result),
    }
    const stored = encodeComparison(comparison)
    const storedBytes = storedComparisonBytes(stored)
    if (storedBytes > MAX_REDIS_VALUE_BYTES) {
      return Response.json({ error: 'This comparison is too large to share. It is still available on screen.' }, { status: 413 })
    }
    await new Redis({ url: process.env.KV_REST_API_URL ?? '', token: process.env.KV_REST_API_TOKEN ?? '' }).set(`comparison:${comparison.id}`, stored, { ex: 60 * 60 * 24 * 30 })
    return Response.json({ id: comparison.id, storedBytes })
  } catch {
    return Response.json({ error: 'Unable to create a share link.' }, { status: 400 })
  }
}
