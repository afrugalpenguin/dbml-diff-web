import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'
import { compareSchemas } from '../../../lib/compare'
import { encodeComparison, MAX_REDIS_VALUE_BYTES, storedComparisonBytes } from '../../../lib/share-storage'
import { apiRateLimit, MAX_SCHEMA_BYTES, requestIp, utf8Bytes } from '../../../lib/request-limits'
import { parserErrorResponse } from '../../../lib/api-errors'
import { readJsonRequest } from '../../../lib/bounded-request-body'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const limit = await apiRateLimit.limit(`share:${requestIp(request)}`)
    if (!limit.success) return Response.json({ error: 'Rate limit exceeded. Please try again in a minute.' }, { status: 429 })

    const parsedRequest = await readJsonRequest(request)
    if ('response' in parsedRequest) return parsedRequest.response
    const body = parsedRequest.body
    const oldDbml = typeof body.oldDbml === 'string' ? body.oldDbml : ''
    const newDbml = typeof body.newDbml === 'string' ? body.newDbml : ''
    if (utf8Bytes(oldDbml) > MAX_SCHEMA_BYTES || utf8Bytes(newDbml) > MAX_SCHEMA_BYTES) {
      return Response.json({ error: 'Each schema must be 500 KB or smaller.' }, { status: 413 })
    }
    if (!oldDbml.trim() || !newDbml.trim()) {
      return Response.json({ error: 'Both DBML schemas are required.' }, { status: 400 })
    }

    const output = compareSchemas(oldDbml, newDbml)
    const comparison = {
      id: nanoid(10), oldDbml, newDbml,
      createdAt: new Date().toISOString(), parsedResult: output.parsedResult,
      text: output.text, migration: output.migration, dbml: output.dbml,
    }
    const stored = encodeComparison(comparison)
    const storedBytes = storedComparisonBytes(stored)
    if (storedBytes > MAX_REDIS_VALUE_BYTES) {
      return Response.json({ error: 'This comparison is too large to share. It is still available on screen.' }, { status: 413 })
    }
    await new Redis({ url: process.env.KV_REST_API_URL ?? '', token: process.env.KV_REST_API_TOKEN ?? '' }).set(`comparison:${comparison.id}`, stored, { ex: 60 * 60 * 24 * 30 })
    return Response.json({ id: comparison.id, storedBytes })
  } catch (error) {
    return parserErrorResponse(error, 'new') ?? Response.json({ error: 'Unable to create a share link.' }, { status: 500 })
  }
}
