type Diagnostic = {
  message?: string
  location?: { start?: { line?: number; column?: number } }
}

function parserDiagnostic(error: unknown): Diagnostic | undefined {
  if (typeof error !== 'object' || error === null || !('diags' in error)) return undefined
  const diags = (error as { diags?: unknown }).diags
  return Array.isArray(diags) && diags[0] && typeof diags[0] === 'object' ? diags[0] as Diagnostic : undefined
}

export function parserErrorResponse(error: unknown, fallbackSchema: 'old' | 'new') {
  const diagnostic = parserDiagnostic(error)
  const schema = typeof error === 'object' && error !== null && 'schema' in error && ((error as { schema?: unknown }).schema === 'old' || (error as { schema?: unknown }).schema === 'new')
    ? (error as { schema: 'old' | 'new' }).schema
    : fallbackSchema
  if (!diagnostic) return undefined
  return Response.json({
    error: `${schema === 'old' ? 'Schema A' : 'Schema B'}: ${diagnostic.message ?? 'The DBML schema is invalid.'}`,
    diagnostic: {
      schema,
      line: diagnostic.location?.start?.line,
      column: diagnostic.location?.start?.column,
    },
  }, { status: 400 })
}
