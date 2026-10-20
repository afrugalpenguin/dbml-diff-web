import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { diff, emitJson } from 'dbml-diff'
import { readFileSync } from 'node:fs'
import { Summary } from '../../page'

const oldDbml = readFileSync('v1.dbml', 'utf8')
const newDbml = readFileSync('v2.dbml', 'utf8')
const enumRefOld = readFileSync('enum-ref-v1.dbml', 'utf8')
const enumRefNew = readFileSync('enum-ref-v2.dbml', 'utf8')
const refAddRemoveOld = readFileSync('ref-add-remove-v1.dbml', 'utf8')
const refAddRemoveNew = readFileSync('ref-add-remove-v2.dbml', 'utf8')
const groupOld = readFileSync('group-v1.dbml', 'utf8')
const groupNew = readFileSync('group-v2.dbml', 'utf8')

describe('/api/diff comparison contract', () => {
  it('reports the expected fixture counts', () => {
    const result = JSON.parse(emitJson(diff(oldDbml, newDbml)))
    expect(result.tables.added).toHaveLength(1)
    expect(result.tables.removed).toHaveLength(1)
    expect(result.tables.modified).toHaveLength(4)
    expect(result.groups.added).toHaveLength(1)
    expect(result.groups.removed).toHaveLength(0)
    expect(result.groups.modified).toHaveLength(0)
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

  it('renders enum and ref changes in the summary', () => {
    const parsed = JSON.parse(emitJson(diff(enumRefOld, enumRefNew)))
    const markup = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts }))
    expect(markup.replace(/<[^>]+>/g, '')).toContain('~ modified dbo.Status (pending, active, archived)')
    expect(markup.replace(/<[^>]+>/g, '')).toContain('~Orders.user_id→Accounts.id (was Users.id)')
  })

  it('renders added and removed refs in the summary', () => {
    const parsed = JSON.parse(emitJson(diff(refAddRemoveOld, refAddRemoveNew)))
    const text = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts })).replace(/<[^>]+>/g, '')
    expect(text).toContain('+Child.id→Other.id')
    expect(text).toContain('-Child.parent_id→Parent.id')
    expect(parsed.refs.unresolved).toHaveLength(0)
  })

  it('renders removed and modified group membership changes in the summary', () => {
    const parsed = JSON.parse(emitJson(diff(groupOld, groupNew)))
    const text = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts })).replace(/<[^>]+>/g, '')
    expect(text).toContain('Groups')
    expect(text).toContain('dbo.C')
    expect(text).toContain('Changed')
    expect(text).toContain('dbo.A')
    expect(text).toContain('Removed')
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
})
