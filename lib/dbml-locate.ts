import type { EditorFocus } from './summary-changes'

const NAME = String.raw`(?:"[^"]+"|[\w]+)`
const TABLE_HEADER = new RegExp(String.raw`^\s*table\s+(${NAME}(?:\.${NAME})?)(?:\s+as\s+${NAME})?\s*(?:\[[^\]]*\])?\s*\{`, 'i')
const COLUMN = /^\s*(?:"([^"]+)"|(\w+))\s+[^\s:{]/

// dbml-diff reports names unquoted and drops the default public schema.
function normaliseTableName(name: string): string {
  const unquoted = name.replace(/"/g, '')
  return unquoted.startsWith('public.') ? unquoted.slice('public.'.length) : unquoted
}

// Strips strings, notes and comments so their braces and text are not read as structure.
function codeOnly(line: string, inTripleQuote: boolean): { code: string; inTripleQuote: boolean } {
  let code = ''
  let index = 0
  while (index < line.length) {
    if (inTripleQuote) {
      const end = line.indexOf("'''", index)
      if (end === -1) return { code, inTripleQuote }
      inTripleQuote = false
      index = end + 3
      continue
    }
    if (line.startsWith("'''", index)) {
      inTripleQuote = true
      index += 3
      continue
    }
    if (line.startsWith('//', index)) break
    const char = line[index]
    if (char === "'" || char === '`') {
      const end = line.indexOf(char, index + 1)
      index = end === -1 ? line.length : end + 1
      continue
    }
    code += char
    index += 1
  }
  return { code, inTripleQuote }
}

function braceDelta(code: string): number {
  let delta = 0
  for (const char of code) {
    if (char === '{') delta += 1
    if (char === '}') delta -= 1
  }
  return delta
}

// The 1-based line of a table, or of a column inside that table's own block.
export function findDbmlLine(dbml: string, table: string, column?: string): number | undefined {
  const lines = dbml.split(/\r?\n/)
  let inTripleQuote = false
  let depth = 0
  let inTable = false
  for (const [index, line] of lines.entries()) {
    const startsInNote = inTripleQuote
    const stripped = codeOnly(line, inTripleQuote)
    inTripleQuote = stripped.inTripleQuote
    if (!startsInNote && depth === 0) {
      const header = stripped.code.match(TABLE_HEADER)
      if (header && normaliseTableName(header[1]) === table) {
        if (!column) return index + 1
        inTable = true
      }
    } else if (!startsInNote && inTable && depth === 1) {
      const match = stripped.code.match(COLUMN)
      if (match && (match[1] ?? match[2]) === column) return index + 1
    }
    depth += braceDelta(stripped.code)
    if (depth <= 0) {
      depth = 0
      inTable = false
    }
  }
  return undefined
}

export function editorFocusLine(focus: EditorFocus, oldDbml: string, newDbml: string): { schema: 'old' | 'new'; line: number } | null {
  const line = findDbmlLine(focus.schema === 'old' ? oldDbml : newDbml, focus.table, focus.column)
  return line === undefined ? null : { schema: focus.schema, line }
}
