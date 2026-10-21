type Diagnostic = {
  message?: string
  location?: { start?: { line?: number; column?: number } }
}

function parserDiagnostic(error: unknown): Diagnostic | undefined {
  if (typeof error !== 'object' || error === null || !('diags' in error)) return undefined
  const diags = (error as { diags?: unknown }).diags
  return Array.isArray(diags) && diags[0] && typeof diags[0] === 'object' ? diags[0] as Diagnostic : undefined
}

export function parserErrorResponse(error: unknown, schema: 'old' | 'new') {
  const diagnostic = parserDiagnostic(error)
  if (!diagnostic) return undefined
  return Response.json({
    error: diagnostic.message ?? 'The DBML schema is invalid.',
    diagnostic: {
      schema,
      line: diagnostic.location?.start?.line,
      column: diagnostic.location?.start?.column,
    },
  }, { status: 400 })
}
