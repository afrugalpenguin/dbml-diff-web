import { nanoid } from 'nanoid'
import { apiRateLimit, MAX_SCHEMA_BYTES, requestIp, utf8Bytes } from '../../../lib/request-limits'
import { compareSchemas } from '../../../lib/compare'
import { parserErrorResponse } from '../../../lib/api-errors'

export const runtime = 'nodejs'

function findUnclosedBlock(source: string) {
  const stack: number[] = []
  const lines = source.split(/\r?\n/)
  let quote: string | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\/\/.*$/, '')
    for (let position = 0; position < line.length; position += 1) {
      const character = line[position]
      if (quote) {
        if (character === quote && line[position - 1] !== '\\') quote = null
        continue
      }
      if (character === '"' || character === "'") {
        quote = character
      } else if (character === '{') {
        stack.push(index + 1)
      } else if (character === '}' && stack.length) {
        stack.pop()
      }
    }
  }

  return stack.at(-1)
}

export async function POST(request: Request) {
  let oldDbml = ''
  let newDbml = ''
  try {
    const limit = await apiRateLimit.limit(`diff:${requestIp(request)}`)
    if (!limit.success) return Response.json({ error: 'Rate limit exceeded. Please try again in a minute.' }, { status: 429 })

    let body: Record<string, unknown>
    try {
      const parsedBody = await request.json()
      if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
        return Response.json({ error: 'Invalid JSON request.' }, { status: 400 })
      }
      body = parsedBody as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON request.' }, { status: 400 })
    }
    oldDbml = typeof body.oldDbml === 'string' ? body.oldDbml : ''
    newDbml = typeof body.newDbml === 'string' ? body.newDbml : ''
    if (utf8Bytes(oldDbml) > MAX_SCHEMA_BYTES || utf8Bytes(newDbml) > MAX_SCHEMA_BYTES) {
      return Response.json({ error: 'Each schema must be 500 KB or smaller.' }, { status: 413 })
    }
    if (!oldDbml.trim() || !newDbml.trim()) return Response.json({ error: 'Both DBML schemas are required.' }, { status: 400 })

    const unclosedOldLine = findUnclosedBlock(oldDbml)
    if (unclosedOldLine) {
      return Response.json({ error: `Previous schema has an unclosed block starting on line ${unclosedOldLine}. Add a closing }.`, diagnostic: { schema: 'old', line: unclosedOldLine } }, { status: 400 })
    }
    const unclosedNewLine = findUnclosedBlock(newDbml)
    if (unclosedNewLine) {
      return Response.json({ error: `Updated schema has an unclosed block starting on line ${unclosedNewLine}. Add a closing }.`, diagnostic: { schema: 'new', line: unclosedNewLine } }, { status: 400 })
    }

    const output = compareSchemas(oldDbml, newDbml)
    const comparison = {
      id: nanoid(10), oldDbml, newDbml,
      createdAt: new Date().toISOString(),
      counts: output.counts,
      result: output.result,
      text: output.text, migration: output.migration, dbml: output.dbml,
    }
    return Response.json({ ...comparison, parsedResult: output.parsedResult })
  } catch (error) {
    return parserErrorResponse(error, 'new') ?? Response.json({ error: 'Unable to compare DBML schemas.' }, { status: 500 })
  }
}
