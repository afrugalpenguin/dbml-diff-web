import { gunzipSync, gzipSync } from 'node:zlib'

export const MAX_REDIS_VALUE_BYTES = 1024 * 1024

export type StoredComparison = {
  encoding: 'gzip+base64'
  data: string
}

export function encodeComparison(value: unknown): StoredComparison {
  return {
    encoding: 'gzip+base64',
    data: gzipSync(Buffer.from(JSON.stringify(value), 'utf8')).toString('base64'),
  }
}

export function storedComparisonBytes(value: StoredComparison) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

export function decodeComparison(value: StoredComparison | unknown) {
  if (value && typeof value === 'object' && 'encoding' in value && 'data' in value) {
    const stored = value as StoredComparison
    if (stored.encoding === 'gzip+base64' && typeof stored.data === 'string') {
      return JSON.parse(gunzipSync(Buffer.from(stored.data, 'base64')).toString('utf8'))
    }
  }
  return value
}
