import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { MAX_SCHEMA_BYTES } from './limits'

export const RATE_LIMIT_REQUESTS = 30
export const RATE_LIMIT_WINDOW = '1 m'

const redis = new Redis({ url: process.env.KV_REST_API_URL ?? '', token: process.env.KV_REST_API_TOKEN ?? '' })
export { MAX_SCHEMA_BYTES }
export const apiRateLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW), prefix: 'dbml-diff:rate' })

export function requestIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

export function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength
}
