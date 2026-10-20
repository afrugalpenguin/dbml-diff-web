import { nanoid } from 'nanoid'
import { apiRateLimit, MAX_SCHEMA_BYTES, requestIp, utf8Bytes } from '../../../lib/request-limits'
import { diff, emitDbml, emitJson, emitMigration, emitText } from 'dbml-diff'

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

    const body = await request.json()
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

    const result = diff(oldDbml, newDbml)
    const json = emitJson(result)
    const parsed = JSON.parse(json)
    const comparison = {
      id: nanoid(10), oldDbml, newDbml,
      createdAt: new Date().toISOString(),
      counts: parsed.counts,
      result: json,
      text: emitText(result), migration: emitMigration(result), dbml: emitDbml(result),
    }
    return Response.json({ ...comparison, parsedResult: parsed })
  } catch (error) {
    const diagnostic = typeof error === 'object' && error !== null && 'diags' in error
      ? (error as { diags?: Array<{ message?: string; location?: { start?: { line?: number; column?: number } } }> }).diags?.[0]
      : undefined
    const message = diagnostic?.message
      ?? (error instanceof SyntaxError && error.message.includes('Unexpected end of JSON input')
        ? 'The schema comparison could not be serialized. Check both schemas for invalid DBML syntax.'
        : error instanceof Error ? error.message : 'Unable to compare DBML schemas.')
    const parserLine = diagnostic?.location?.start?.line
    return Response.json({
      error: message,
      diagnostic: diagnostic ? {
        schema: 'new',
        line: parserLine,
        column: diagnostic.location?.start?.column,
      } : undefined,
    }, { status: 400 })
  }
}
