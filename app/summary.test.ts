import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { diff, emitJson } from 'dbml-diff'
import { readFileSync } from 'node:fs'
import { Summary } from './page'
import type { DiffResult } from '../lib/diff-types'

const oldDbml = readFileSync('test/fixtures/v1.dbml', 'utf8')
const newDbml = readFileSync('test/fixtures/v2.dbml', 'utf8')
const enumRefOld = readFileSync('test/fixtures/enum-ref-v1.dbml', 'utf8')
const enumRefNew = readFileSync('test/fixtures/enum-ref-v2.dbml', 'utf8')
const refAddRemoveOld = readFileSync('test/fixtures/ref-add-remove-v1.dbml', 'utf8')
const refAddRemoveNew = readFileSync('test/fixtures/ref-add-remove-v2.dbml', 'utf8')
const groupOld = readFileSync('test/fixtures/group-v1.dbml', 'utf8')
const groupNew = readFileSync('test/fixtures/group-v2.dbml', 'utf8')

function summaryText(parsed: DiffResult) {
  return renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts })).replace(/<[^>]+>/g, '')
}

describe('Summary', () => {
  it('reports the expected fixture counts', () => {
    const result = JSON.parse(emitJson(diff(oldDbml, newDbml)))
    expect(result.tables.added).toHaveLength(1)
    expect(result.tables.removed).toHaveLength(1)
    expect(result.tables.modified).toHaveLength(4)
    expect(result.groups.added).toHaveLength(1)
    expect(result.groups.removed).toHaveLength(0)
    expect(result.groups.modified).toHaveLength(0)
  })

  it('renders the full fixture summary without treating columns as React children', () => {
    const parsed = JSON.parse(emitJson(diff(oldDbml, newDbml)))
    const markup = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts }))
    expect(markup).toContain('ZoneId -&gt; GeoZoneId')
    expect(markup).toContain('(heuristic - verify)')
    expect(markup).toContain('+ column PlanKindId INT NOT NULL')
    expect(markup.replace(/<[^>]+>/g, '')).toContain('+PlanKind')
    expect(markup.replace(/<[^>]+>/g, '')).toContain('Lookups')
    expect(markup).toContain('Groups')
  })

  it('renders enum and ref changes', () => {
    const parsed = JSON.parse(emitJson(diff(enumRefOld, enumRefNew)))
    const text = summaryText(parsed)
    expect(text).toContain('~ modified dbo.Status (pending, active, archived)')
    expect(text).toContain('Orders~user_id\u2192Accounts.id (was Users.id)')
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
    expect(result.groups.added).toHaveLength(0)
    expect(result.groups.removed).toHaveLength(0)
    expect(result.groups.modified).toHaveLength(0)
  })

  it('renders added and removed refs', () => {
    const parsed = JSON.parse(emitJson(diff(refAddRemoveOld, refAddRemoveNew)))
    expect(parsed.refs.unresolved).toHaveLength(0)
    const text = summaryText(parsed)
    expect(text).toContain('Child+id\u2192Other.id')
    expect(text).toContain('-parent_id\u2192Parent.id')
  })
})
