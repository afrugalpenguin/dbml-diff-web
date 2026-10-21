import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { compareSchemas } from './compare'
import { schemaGraph } from './schema-graph'
import { layoutGraph, nodeSize, selectGraph, kindStyle, toFlow, visibleColumns } from './diagram-graph'
import type { GraphTable, SchemaGraph } from './diff-types'

function graphFor(oldDbml: string, newDbml: string) {
  return schemaGraph(oldDbml, newDbml, compareSchemas(oldDbml, newDbml).parsedResult)
}

// a changes; b refs a; c refs b (two hops away); d is unrelated; e's ref moves from f to g, leaving f unconnected.
const oldDbml = [
  'Table a {\n  id int\n}',
  'Table b {\n  id int\n  a_id int\n}',
  'Table c {\n  id int\n  b_id int\n}',
  'Table d {\n  id int\n}',
  'Table e {\n  id int\n  f_id int\n}',
  'Table f {\n  id int\n}',
  'Table g {\n  id int\n}',
  'Ref: b.a_id > a.id',
  'Ref: c.b_id > b.id',
  'Ref: e.f_id > f.id',
].join('\n')
const newDbml = oldDbml.replace('Table a {\n  id int\n}', 'Table a {\n  id bigint\n}').replace('Ref: e.f_id > f.id', 'Ref: e.f_id > g.id')

function overlaps(positions: Map<string, { x: number; y: number }>, tables: GraphTable[]) {
  const boxes = tables.map((table) => ({ ...positions.get(table.name)!, ...nodeSize(table) }))
  return boxes.some((a, i) => boxes.some((b, j) => i < j && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height))
}

describe('selectGraph', () => {
  const graph = graphFor(oldDbml, newDbml)
  const names = (mode: 'changed' | 'whole') => selectGraph(graph, mode).tables.map((table) => table.name).sort()

  it('shows changed tables, tables at either end of a changed ref, and their direct neighbours', () => {
    expect(names('changed')).toEqual(['a', 'b', 'e', 'g'])
  })

  it('shows every table in whole-schema mode', () => {
    expect(names('whole')).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  })

  it('keeps only refs whose two ends are both shown', () => {
    const refs = selectGraph(graph, 'changed').refs.map((ref) => `${ref.from.table}>${ref.to.table}`)
    expect(refs.sort()).toEqual(['b>a', 'e>g'])
  })
})

describe('toFlow', () => {
  it('styles tables, columns and refs by change kind on the fixture pairs', () => {
    const graph = graphFor(readFileSync('test/fixtures/v1.dbml', 'utf8'), readFileSync('test/fixtures/v2.dbml', 'utf8'))
    const { nodes } = toFlow(selectGraph(graph, 'whole'))
    for (const kind of ['added', 'removed', 'modified'] as const) {
      const node = nodes.find((entry) => entry.data.table.kind === kind)
      expect(node?.className).toContain(kindStyle[kind].node)
    }
    const refs = graphFor(
      readFileSync('test/fixtures/ref-add-remove-v1.dbml', 'utf8'),
      readFileSync('test/fixtures/ref-add-remove-v2.dbml', 'utf8'),
    )
    const { edges } = toFlow(selectGraph(refs, 'whole'))
    expect(edges.find((edge) => edge.data?.kind === 'added')?.style?.stroke).toBe(kindStyle.added.stroke)
    const removed = edges.find((edge) => edge.data?.kind === 'removed')
    expect(removed?.style).toMatchObject({ stroke: kindStyle.removed.stroke, strokeDasharray: expect.any(String) })
  })

  it('uses table names as node ids and builds edge ids from the endpoints', () => {
    const { nodes, edges } = toFlow(selectGraph(graphFor(oldDbml, newDbml), 'changed'))
    expect(nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'e', 'g'])
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length)
    expect(edges.find((edge) => edge.source === 'b')?.target).toBe('a')
  })
})

describe('visibleColumns', () => {
  it('collapses unchanged columns of a large table but keeps every changed one', () => {
    const columns = Array.from({ length: 20 }, (_, index) => ({ name: `c${index}`, kind: index === 15 ? ('changed' as const) : ('unchanged' as const) }))
    const result = visibleColumns({ name: 't', kind: 'modified', columns })
    expect(result.columns.map((column) => column.name)).toEqual(['c15'])
    expect(result.hiddenUnchanged).toBe(19)
  })

  it('shows every column of a small table', () => {
    const columns = Array.from({ length: 5 }, (_, index) => ({ name: `c${index}`, kind: 'unchanged' as const }))
    expect(visibleColumns({ name: 't', kind: 'unchanged', columns })).toEqual({ columns, hiddenUnchanged: 0 })
  })
})

describe('layoutGraph', () => {
  it('places every table without overlaps, the same way each time', () => {
    const selection = selectGraph(graphFor(oldDbml, newDbml), 'whole')
    const first = layoutGraph(selection)
    expect([...first.keys()].sort()).toEqual(selection.tables.map((table) => table.name).sort())
    expect(overlaps(first, selection.tables)).toBe(false)
    expect(layoutGraph(selection)).toEqual(first)
  })

  it('lays out a 300-table schema without overlaps', () => {
    const tables: GraphTable[] = Array.from({ length: 300 }, (_, index) => ({
      name: `t${index}`,
      kind: index % 10 === 0 ? 'modified' : 'unchanged',
      columns: Array.from({ length: 3 + (index % 15) }, (_, column) => ({ name: `c${column}`, kind: 'unchanged' as const })),
    }))
    // A chain of refs through most tables, with some tables left unconnected.
    const refs: SchemaGraph['refs'] = tables.slice(1, 250).map((table, index) => ({
      from: { table: table.name, columns: ['c0'] },
      to: { table: tables[Math.floor(index / 3)].name, columns: ['c0'] },
      kind: 'unchanged',
    }))
    const selection = selectGraph({ tables, refs, unresolved: 0 }, 'whole')
    const positions = layoutGraph(selection)
    const { nodes, edges } = toFlow(selection, positions)
    expect(nodes).toHaveLength(300)
    expect(edges).toHaveLength(249)
    expect(overlaps(positions, tables)).toBe(false)
  })
})
