import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { compareSchemas } from './compare'
import { schemaGraph } from './schema-graph'

function graphFor(oldDbml: string, newDbml: string) {
  return schemaGraph(oldDbml, newDbml, compareSchemas(oldDbml, newDbml).parsedResult)
}

const oldDbml = [
  'Table users {\n  id int\n  email varchar\n  legacy int\n}',
  'Table orders {\n  id int\n  user_id int\n  status int\n  carrier_id int\n}',
  'Table carriers {\n  id int\n}',
  'Table audit {\n  id int\n  note varchar\n}',
  'Table notes {\n  id int\n}',
  'Ref: orders.user_id > users.id',
  'Ref: orders.carrier_id > carriers.id',
  'Ref: notes.id > audit.id',
].join('\n')
const newDbml = [
  'Table users {\n  id int\n  email varchar [not null]\n  phone varchar\n}',
  'Table orders {\n  id int\n  user_id int\n  state int\n  carrier_id int\n}',
  'Table carriers {\n  id int\n}',
  'Table shippers {\n  id int\n}',
  'Table notes {\n  id int\n}',
  'Ref: orders.user_id > users.id',
  'Ref: orders.carrier_id > shippers.id',
].join('\n')

describe('schemaGraph', () => {
  const graph = graphFor(oldDbml, newDbml)
  const table = (name: string) => graph.tables.find((entry) => entry.name === name)

  it('includes every table from both schemas with its change kind', () => {
    expect(Object.fromEntries(graph.tables.map((entry) => [entry.name, entry.kind]))).toEqual({
      users: 'modified',
      orders: 'modified',
      carriers: 'unchanged',
      shippers: 'added',
      notes: 'unchanged',
      audit: 'removed',
    })
  })

  it('marks each column of a modified table, keeping removed columns from Schema A', () => {
    expect(table('users')?.columns.map((column) => [column.name, column.kind])).toEqual([
      ['id', 'unchanged'],
      ['email', 'changed'],
      ['phone', 'added'],
      ['legacy', 'removed'],
    ])
  })

  it('marks a rename candidate with the column it may have come from', () => {
    expect(table('orders')?.columns.find((column) => column.name === 'state')).toMatchObject({ kind: 'renamed', renamedFrom: 'status' })
  })

  it('gives a removed table its Schema A columns', () => {
    expect(table('audit')?.columns.map((column) => [column.name, column.kind])).toEqual([
      ['id', 'removed'],
      ['note', 'removed'],
    ])
  })

  it('includes unchanged refs and marks added, removed and retargeted ones', () => {
    const refs = graph.refs.map((ref) => [`${ref.from.table}.${ref.from.columns.join()}`, `${ref.to.table}.${ref.to.columns.join()}`, ref.kind])
    expect(refs).toEqual(expect.arrayContaining([
      ['orders.user_id', 'users.id', 'unchanged'],
      ['orders.carrier_id', 'shippers.id', 'retargeted'],
      ['notes.id', 'audit.id', 'removed'],
    ]))
    expect(refs).toHaveLength(3)
  })

  it('counts unresolved refs instead of drawing them', () => {
    expect(graph.unresolved).toBe(0)
  })

  it('marks every table in the fixture pair', () => {
    const fixtures = graphFor(readFileSync('test/fixtures/v1.dbml', 'utf8'), readFileSync('test/fixtures/v2.dbml', 'utf8'))
    const kinds = fixtures.tables.map((entry) => entry.kind)
    expect(kinds).toEqual(expect.arrayContaining(['added', 'removed', 'modified']))
    expect(fixtures.tables.filter((entry) => entry.kind === 'added')).toHaveLength(1)
    expect(fixtures.tables.filter((entry) => entry.kind === 'removed')).toHaveLength(1)
    expect(fixtures.tables.filter((entry) => entry.kind === 'modified')).toHaveLength(4)
  })

  it('marks added refs on the ref fixture pair', () => {
    const refs = graphFor(readFileSync('test/fixtures/ref-add-remove-v1.dbml', 'utf8'), readFileSync('test/fixtures/ref-add-remove-v2.dbml', 'utf8')).refs
    expect(refs.map((ref) => ref.kind)).toEqual(expect.arrayContaining(['added', 'removed']))
  })
})
