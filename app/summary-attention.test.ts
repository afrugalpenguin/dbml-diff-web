import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { Summary } from './page'
import { compareSchemas } from '../lib/compare'
import type { DiffResult } from '../lib/diff-types'

function attentionText(parsed: DiffResult) {
  const markup = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts }))
  const section = markup.match(/<section id="summary-attention".*?<\/section>/)?.[0] ?? ''
  return section.replace(/<[^>]+>/g, '\n')
}

function summaryFor(oldDbml: string, newDbml: string) {
  return attentionText(compareSchemas(oldDbml, newDbml).parsedResult)
}

describe('Summary needs attention', () => {
  it('does not flag NOT NULL to nullable', () => {
    expect(summaryFor('Table users {\n  id int\n  a int [not null]\n}', 'Table users {\n  id int\n  a int\n}')).not.toContain('users.a')
  })

  it('flags nullable to NOT NULL', () => {
    expect(summaryFor('Table users {\n  id int\n  a int\n}', 'Table users {\n  id int\n  a int [not null]\n}')).toContain('users.a is now NOT NULL')
  })

  it('flags a type change with structured before and after types', () => {
    expect(summaryFor('Table users {\n  id int\n}', 'Table users {\n  id bigint\n}')).toContain('users.id changes type from int to bigint in B')
  })

  it('flags both changes on one column', () => {
    const text = summaryFor('Table users {\n  id int\n  c int\n}', 'Table users {\n  id int\n  c bigint [not null]\n}')
    expect(text).toContain('users.c is now NOT NULL')
    expect(text).toContain('users.c changes type from int to bigint in B')
  })

  it('shows a generic item when the before lookup is missing', () => {
    const parsed = compareSchemas('Table users {\n  id int\n}', 'Table users {\n  id bigint\n}').parsedResult
    delete parsed.tables.modified[0].columnsChanged[0].before
    const text = attentionText(parsed)
    expect(text).toContain('users.id changed in B. Review this column before migrating.')
    expect(text).not.toContain('changes type')
  })

  it('does not read the change phrases', () => {
    const source = readFileSync('app/page.tsx', 'utf8')
    expect(source).not.toMatch(/changes\.some\(/)
  })
})
