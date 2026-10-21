import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { ipAddress } from '@vercel/functions'
import { isIP } from 'node:net'
import { MAX_SCHEMA_BYTES } from './limits'

export const RATE_LIMIT_REQUESTS = 30
export const MISSING_IP_RATE_LIMIT_REQUESTS = 10
export const RATE_LIMIT_WINDOW = '1 m'

const redis = new Redis({ url: process.env.KV_REST_API_URL ?? '', token: process.env.KV_REST_API_TOKEN ?? '' })
export { MAX_SCHEMA_BYTES }
export const apiRateLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW), prefix: 'dbml-diff:rate' })
export const missingIpRateLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(MISSING_IP_RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW), prefix: 'dbml-diff:rate:missing-ip' })

export function requestIp(request: Request) {
  const value = ipAddress(request)
  return value && isIP(value) ? value : null
}

export function rateLimitForRequest(request: Request, route: 'diff' | 'share') {
  const ip = requestIp(request)
  return (ip ? apiRateLimit : missingIpRateLimit).limit(`${route}:${ip ?? 'missing'}`)
}

export function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength
}
