export const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body exceeds the maximum size.')
    this.name = 'RequestBodyTooLargeError'
  }
}

function contentLength(request: Request) {
  const value = request.headers.get('content-length')
  if (!value || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

export async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = contentLength(request)
  if (declaredLength !== undefined && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new RequestBodyTooLargeError()
  }

  if (!request.body) throw new SyntaxError('Request body is empty.')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel('Request body exceeds the maximum size.')
        throw new RequestBodyTooLargeError()
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  return JSON.parse(new TextDecoder().decode(concat(chunks, total)))
}

export async function readJsonRequest(request: Request): Promise<{ body: Record<string, unknown> } | { response: Response }> {
  try {
    const parsedBody = await readBoundedJson(request)
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return { response: Response.json({ error: 'Invalid JSON request.' }, { status: 400 }) }
    }
    return { body: parsedBody as Record<string, unknown> }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return { response: Response.json({ error: 'Request is too large.' }, { status: 413 }) }
    }
    return { response: Response.json({ error: 'Invalid JSON request.' }, { status: 400 }) }
  }
}

function concat(chunks: Uint8Array[], total: number) {
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}
