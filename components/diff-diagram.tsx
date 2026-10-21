'use client'

import '@xyflow/react/dist/style.css'
import { useMemo, useState } from 'react'
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, useNodesState, type NodeProps } from '@xyflow/react'
import type { SchemaGraph } from '../lib/diff-types'
import {
  columnKindStyle,
  kindStyle,
  LARGE_SCHEMA_TABLES,
  selectGraph,
  toFlow,
  type DiagramMode,
  type RefEdge,
  type TableNode,
} from '../lib/diagram-graph'

function TableNodeView({ data }: NodeProps<TableNode>) {
  const { table, columns, hiddenUnchanged } = data
  return (
    <div className="w-60 font-mono text-xs">
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className={`flex items-center justify-between gap-2 rounded-t-md px-2 py-2 font-semibold ${kindStyle[table.kind].header}`}>
        <span className="truncate" title={table.name}>
          {table.name}
        </span>
        <span className="shrink-0 font-sans text-[10px] font-normal uppercase tracking-wider">{table.kind}</span>
      </div>
      <div className="flex flex-col px-2 py-1">
        {columns.map((column) => (
          <div key={`${column.kind}-${column.name}`} className={`flex h-[22px] items-center gap-1 ${columnKindStyle[column.kind].className}`}>
            <span className="w-3 shrink-0">{columnKindStyle[column.kind].symbol}</span>
            <span className="truncate" title={column.renamedFrom ? `${column.name} (was ${column.renamedFrom})` : column.name}>
              {column.name}
              {column.renamedFrom ? ` (was ${column.renamedFrom})` : ''}
            </span>
            <span className="ml-auto shrink-0 opacity-70">{column.type}</span>
          </div>
        ))}
        {hiddenUnchanged > 0 && <div className="flex h-[22px] items-center text-muted-foreground">{hiddenUnchanged} unchanged</div>}
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  )
}

const nodeTypes = { table: TableNodeView }

// Mounted once per mode, so switching mode lays the tables out again and a drag never does.
function DiagramCanvas({
  nodes: initialNodes,
  edges,
  onTableClick,
}: {
  nodes: TableNode[]
  edges: RefEdge[]
  onTableClick: (node: TableNode) => void
}) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onTableClick(node)}
      nodesConnectable={false}
      onlyRenderVisibleElements
      fitView
      minZoom={0.05}
      colorMode="system"
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={(node) => kindStyle[(node as TableNode).data.table.kind].stroke} />
    </ReactFlow>
  )
}

export function DiffDiagram({ graph, onSelectTable }: { graph: SchemaGraph; onSelectTable: (table: string) => void }) {
  const [mode, setMode] = useState<DiagramMode>('changed')
  const [confirmingWhole, setConfirmingWhole] = useState(false)
  const [message, setMessage] = useState('')
  const flow = useMemo(() => toFlow(selectGraph(graph, mode)), [graph, mode])
  const total = graph.tables.length

  const chooseMode = (next: DiagramMode) => {
    setMessage('')
    if (next === 'whole' && mode !== 'whole' && total > LARGE_SCHEMA_TABLES) setConfirmingWhole(true)
    else setMode(next)
  }
  const modeButton = (value: DiagramMode, label: string) => (
    <button
      onClick={() => chooseMode(value)}
      aria-pressed={mode === value}
      className={`rounded-md border px-2.5 py-1 text-xs ${
        mode === value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {modeButton('changed', 'Changed and neighbours')}
          {modeButton('whole', `Whole schema (${total} tables)`)}
        </div>
        <div aria-label="Diagram legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="text-emerald-500">added in B</span>
          <span className="text-red-500">removed in B</span>
          <span className="text-amber-500">modified</span>
          <span>dashed ref: removed in B</span>
          {graph.unresolved > 0 && <span>{graph.unresolved} unresolved refs not drawn</span>}
        </div>
      </div>
      {confirmingWhole && (
        <div role="alertdialog" className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <span>Show all {total} tables? This may be slow.</span>
          <button
            onClick={() => {
              setConfirmingWhole(false)
              setMode('whole')
            }}
            className="rounded-md border border-border px-2.5 py-1 text-xs"
          >
            Show all
          </button>
          <button onClick={() => setConfirmingWhole(false)} className="px-2.5 py-1 text-xs text-muted-foreground">
            Cancel
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {flow.nodes.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No tables changed.</p>
      ) : (
        <div className="h-[620px] overflow-hidden rounded-md border border-border">
          <DiagramCanvas
            key={mode}
            nodes={flow.nodes}
            edges={flow.edges}
            onTableClick={(node) => {
              if (node.data.table.kind === 'unchanged') setMessage(`No changes in ${node.data.table.name}.`)
              else onSelectTable(node.data.table.name)
            }}
          />
        </div>
      )}
    </div>
  )
}
