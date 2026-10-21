import { describe, expect, it } from 'vitest'
import { MAX_REQUEST_BODY_BYTES, RequestBodyTooLargeError, readBoundedJson } from './bounded-request-body'

function streamingRequest(chunks: Uint8Array[], headers?: HeadersInit) {
  let index = 0
  let pulls = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1
      const chunk = chunks[index++]
      if (chunk) controller.enqueue(chunk)
      else controller.close()
    },
  })
  const request = new Request('http://localhost', { method: 'POST', body, headers, duplex: 'half' } as RequestInit & { duplex: 'half' })
  return { request, get pulls() { return pulls } }
}

const bytes = (value: string) => new TextEncoder().encode(value)

describe('readBoundedJson', () => {
  it('rejects an oversized declared body without pulling the stream', async () => {
    const stream = streamingRequest([bytes('{}')], { 'content-length': String(MAX_REQUEST_BODY_BYTES + 1) })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const pullsBeforeRead = stream.pulls
    await expect(readBoundedJson(stream.request)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
    expect(stream.pulls).toBe(pullsBeforeRead)
  })

  it('cancels a missing-length stream at the cap instead of reading it all', async () => {
    const chunk = new Uint8Array(MAX_REQUEST_BODY_BYTES)
    const stream = streamingRequest([chunk, bytes('more'), bytes('never read')])
    await expect(readBoundedJson(stream.request)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
    expect(stream.pulls).toBeLessThan(3)
  })

  it('ignores an understated content length and still enforces the cap', async () => {
    const stream = streamingRequest([new Uint8Array(MAX_REQUEST_BODY_BYTES), bytes('more')], { 'content-length': '10' })
    await expect(readBoundedJson(stream.request)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
    expect(stream.pulls).toBeLessThan(3)
  })

  it('ignores malformed content length and parses valid JSON', async () => {
    const stream = streamingRequest([bytes('{"ok":true}')], { 'content-length': '-1' })
    await expect(readBoundedJson(stream.request)).resolves.toEqual({ ok: true })
  })

  it('accepts a near-limit escaped JSON body', async () => {
    const schema = '"\\\\\"\\n"'.repeat(80_000)
    const stream = streamingRequest([bytes(JSON.stringify({ oldDbml: schema, newDbml: schema }))])
    await expect(readBoundedJson(stream.request)).resolves.toEqual({ oldDbml: schema, newDbml: schema })
  })
})
