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
  const tagged = typeof error === 'object' && error !== null && 'schema' in error ? (error as { schema?: unknown }).schema : undefined
  const schema = tagged === 'old' || tagged === 'new'
    ? (error as { schema: 'old' | 'new' }).schema
    : fallbackSchema
  if (!diagnostic) return undefined
  const label = schema === 'old' ? 'Schema A' : 'Schema B'
  // Runtime failures inside the parser, such as a stack overflow, arrive as diagnostics without a location.
  if (diagnostic.location?.start?.line === undefined) {
    return Response.json({ error: `${label} could not be parsed.`, diagnostic: { schema } }, { status: 400 })
  }
  return Response.json({
    error: `${label}: ${diagnostic.message ?? 'The DBML schema is invalid.'}`,
    diagnostic: {
      schema,
      line: diagnostic.location?.start?.line,
      column: diagnostic.location?.start?.column,
    },
  }, { status: 400 })
}
