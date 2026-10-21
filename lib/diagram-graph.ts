import { Graph, layout } from '@dagrejs/dagre'
import type { Edge, MarkerType, Node } from '@xyflow/react'
import type { GraphColumn, GraphColumnKind, GraphRef, GraphRefKind, GraphTable, GraphTableKind, SchemaGraph } from './diff-types'

export type DiagramMode = 'changed' | 'whole'
export type DiagramSelection = { tables: GraphTable[]; refs: GraphRef[] }
export type TableNodeData = { table: GraphTable; columns: GraphColumn[]; hiddenUnchanged: number }
export type TableNode = Node<TableNodeData, 'table'>
export type RefEdge = Edge<{ kind: GraphRefKind }>

// Above this, the whole-schema view asks before rendering.
export const LARGE_SCHEMA_TABLES = 300
// Tables with more unchanged columns than this show them as a count.
export const MAX_UNCHANGED_COLUMNS = 12

export const NODE_WIDTH = 240
const HEADER_HEIGHT = 36
const ROW_HEIGHT = 22
const NODE_PADDING = 8
const GAP = 48

// Same colours as the Summary: emerald added, red removed, amber modified.
export const kindStyle: Record<GraphTableKind, { node: string; header: string; stroke: string }> = {
  added: { node: 'border-emerald-500', header: 'bg-emerald-500/15 text-emerald-500', stroke: '#10b981' },
  removed: { node: 'border-red-500', header: 'bg-red-500/15 text-red-500', stroke: '#ef4444' },
  modified: { node: 'border-amber-500', header: 'bg-amber-500/15 text-amber-500', stroke: '#f59e0b' },
  unchanged: { node: 'border-border', header: 'bg-muted/40 text-muted-foreground', stroke: '#64748b' },
}

export const columnKindStyle: Record<GraphColumnKind, { symbol: string; className: string }> = {
  added: { symbol: '+', className: 'text-emerald-500' },
  removed: { symbol: '-', className: 'text-red-500 line-through' },
  changed: { symbol: '~', className: 'text-amber-500' },
  renamed: { symbol: '~', className: 'text-amber-500' },
  unchanged: { symbol: '', className: 'text-muted-foreground' },
}

const refKindTable: Record<GraphRefKind, GraphTableKind> = { added: 'added', removed: 'removed', retargeted: 'modified', unchanged: 'unchanged' }

// Changed tables, tables at either end of a changed ref, and the tables one ref away from those.
export function selectGraph(graph: SchemaGraph, mode: DiagramMode): DiagramSelection {
  const names = new Set(graph.tables.map((table) => table.name))
  const refs = graph.refs.filter((ref) => names.has(ref.from.table) && names.has(ref.to.table))
  if (mode === 'whole') return { tables: graph.tables, refs }
  const changed = new Set(graph.tables.filter((table) => table.kind !== 'unchanged').map((table) => table.name))
  for (const ref of refs) {
    if (ref.kind === 'unchanged') continue
    changed.add(ref.from.table)
    changed.add(ref.to.table)
  }
  const shown = new Set(changed)
  for (const ref of refs) {
    if (changed.has(ref.from.table)) shown.add(ref.to.table)
    if (changed.has(ref.to.table)) shown.add(ref.from.table)
  }
  return {
    tables: graph.tables.filter((table) => shown.has(table.name)),
    refs: refs.filter((ref) => shown.has(ref.from.table) && shown.has(ref.to.table)),
  }
}

export function visibleColumns(table: GraphTable): { columns: GraphColumn[]; hiddenUnchanged: number } {
  const unchanged = table.columns.filter((column) => column.kind === 'unchanged').length
  if (unchanged <= MAX_UNCHANGED_COLUMNS) return { columns: table.columns, hiddenUnchanged: 0 }
  return { columns: table.columns.filter((column) => column.kind !== 'unchanged'), hiddenUnchanged: unchanged }
}

export function nodeSize(table: GraphTable): { width: number; height: number } {
  const { columns, hiddenUnchanged } = visibleColumns(table)
  const rows = columns.length + (hiddenUnchanged ? 1 : 0)
  return { width: NODE_WIDTH, height: HEADER_HEIGHT + rows * ROW_HEIGHT + NODE_PADDING }
}

// Top-left positions. Connected tables are ranked left to right by dagre; unconnected ones go in a grid below.
export function layoutGraph(selection: DiagramSelection): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const connected = new Set(selection.refs.flatMap((ref) => [ref.from.table, ref.to.table]))
  const graph = new Graph()
  graph.setGraph({ rankdir: 'LR', nodesep: GAP / 2, ranksep: GAP * 2 })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const table of selection.tables) if (connected.has(table.name)) graph.setNode(table.name, nodeSize(table))
  for (const ref of selection.refs) graph.setEdge(ref.from.table, ref.to.table)
  layout(graph)
  let bottom = 0
  for (const name of graph.nodes()) {
    const node = graph.node(name)
    positions.set(name, { x: node.x - node.width / 2, y: node.y - node.height / 2 })
    bottom = Math.max(bottom, node.y + node.height / 2)
  }

  const unconnected = selection.tables.filter((table) => !connected.has(table.name))
  const perRow = Math.max(1, Math.ceil(Math.sqrt(unconnected.length)))
  let y = connected.size ? bottom + GAP * 2 : 0
  for (let start = 0; start < unconnected.length; start += perRow) {
    const row = unconnected.slice(start, start + perRow)
    row.forEach((table, index) => positions.set(table.name, { x: index * (NODE_WIDTH + GAP), y }))
    y += Math.max(...row.map((table) => nodeSize(table).height)) + GAP
  }
  return positions
}

const edgeId = (ref: GraphRef) => JSON.stringify([ref.from.table, ref.from.columns, ref.to.table, ref.to.columns])

export function toFlow(
  selection: DiagramSelection,
  positions = layoutGraph(selection),
): { nodes: TableNode[]; edges: RefEdge[] } {
  const nodes = selection.tables.map((table): TableNode => ({
    id: table.name,
    type: 'table',
    position: positions.get(table.name) ?? { x: 0, y: 0 },
    className: kindStyle[table.kind].node,
    data: { table, ...visibleColumns(table) },
  }))
  const edges = selection.refs.map((ref): RefEdge => {
    const { stroke } = kindStyle[refKindTable[ref.kind]]
    return {
      id: edgeId(ref),
      source: ref.from.table,
      target: ref.to.table,
      data: { kind: ref.kind },
      style: { stroke, strokeWidth: ref.kind === 'unchanged' ? 1 : 2, ...(ref.kind === 'removed' ? { strokeDasharray: '6 4' } : {}) },
      markerEnd: { type: 'arrowclosed' as MarkerType, color: stroke },
    }
  })
  return { nodes, edges }
}
