import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { diff, emitJson } from 'dbml-diff'
import { readFileSync } from 'node:fs'
import { Summary } from './page'
import type { DiffResult } from '../lib/diff-types'

const oldDbml = readFileSync('v1.dbml', 'utf8')
const newDbml = readFileSync('v2.dbml', 'utf8')
const enumRefOld = readFileSync('enum-ref-v1.dbml', 'utf8')
const enumRefNew = readFileSync('enum-ref-v2.dbml', 'utf8')
const refAddRemoveOld = readFileSync('ref-add-remove-v1.dbml', 'utf8')
const refAddRemoveNew = readFileSync('ref-add-remove-v2.dbml', 'utf8')
const groupOld = readFileSync('group-v1.dbml', 'utf8')
const groupNew = readFileSync('group-v2.dbml', 'utf8')

function summaryText(parsed: DiffResult) {
  return renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts })).replace(/<[^>]+>/g, '')
}

describe('Summary', () => {
  it('reports the expected fixture counts', () => {
    const result = JSON.parse(emitJson(diff(oldDbml, newDbml)))
    expect(result.tables.added).toHaveLength(1)
    expect(result.tables.removed).toHaveLength(1)
    expect(result.tables.modified).toHaveLength(4)
  })

  it('renders enum and ref changes', () => {
    const parsed = JSON.parse(emitJson(diff(enumRefOld, enumRefNew)))
    const text = summaryText(parsed)
    expect(text).toContain('~ modified dbo.Status (pending, active, archived)')
    expect(text).toContain('~Orders.user_id→Accounts.id (was Users.id)')
  })

  it('renders group membership changes', () => {
    const parsed = JSON.parse(emitJson(diff(groupOld, groupNew)))
    const text = summaryText(parsed)
    expect(text).toContain('Groups')
    expect(text).toContain('dbo.C')
    expect(text).toContain('Changed')
    expect(text).toContain('dbo.A')
    expect(text).toContain('Removed')
  })

  it('reports no differences for identical schemas', () => {
    const result = JSON.parse(emitJson(diff(oldDbml, oldDbml)))
    expect(result.tables.added).toHaveLength(0)
    expect(result.tables.removed).toHaveLength(0)
    expect(result.tables.modified).toHaveLength(0)
  })

  it('renders added and removed refs', () => {
    const parsed = JSON.parse(emitJson(diff(refAddRemoveOld, refAddRemoveNew)))
    const text = summaryText(parsed)
    expect(text).toContain('+Child.id→Other.id')
    expect(text).toContain('-Child.parent_id→Parent.id')
  })
})
