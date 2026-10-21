import { describe, expect, it } from 'vitest'
import { parserErrorResponse } from './api-errors'

function parserError(diag: object, schema?: 'old' | 'new') {
  return Object.assign(new Error('parse failed'), { diags: [diag], schema })
}

describe('parserErrorResponse', () => {
  it('returns the message, line and column of a located syntax error', async () => {
    const response = parserErrorResponse(parserError({ message: 'Expect an identifier', location: { start: { line: 3, column: 1 } } }, 'old'), 'new')
    expect(response?.status).toBe(400)
    expect(await response?.json()).toEqual({ error: 'Schema A: Expect an identifier', diagnostic: { schema: 'old', line: 3, column: 1 } })
  })

  it('returns a fixed message for a diagnostic without a location', async () => {
    const response = parserErrorResponse(parserError({ message: 'Maximum call stack size exceeded' }), 'new')
    expect(response?.status).toBe(400)
    expect(await response?.json()).toEqual({ error: 'Schema B could not be parsed.', diagnostic: { schema: 'new' } })
  })

  it('returns nothing for errors that are not parser diagnostics', () => {
    expect(parserErrorResponse(new Error('internal details'), 'new')).toBeUndefined()
  })
})
