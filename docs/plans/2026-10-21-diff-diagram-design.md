# Diff diagram design

Issue: #52. Depends on #20 (Summary moved out of `app/page.tsx`).

## Goal
An interactive diagram of the comparison: changed tables and their direct ref neighbours by default, the whole schema on request, colour-coded by change kind, draggable, with pan, zoom and a minimap. Clicking a table jumps to its Summary row.

## Data (server)
`lib/schema-graph.ts` exports `schemaGraph(oldDbml, newDbml, parsedResult)`, returning `{ tables, refs, unresolved }`.

- Built only from `diff()` and `emitJson()` output:
  - `diff('', newDbml)` lists every Schema B table (with columns) and ref under `added`.
  - `diff(oldDbml, '')` lists every Schema A table, used for removed tables and removed columns.
  - `parsedResult` sets kinds. A table in none of added, removed or modified is unchanged.
- Table kinds: added, removed, modified, unchanged. Column kinds: added, removed, changed, renamed, unchanged.
- Ref kinds: Schema B refs start unchanged, then `refs.added` and `refs.retargeted` (new target) set their kind. `refs.removed` adds removed refs with their Schema A endpoints. `refs.unresolved` is not drawn; its count is returned.
- Only `/api/diff` adds the result to its response as `graph`. `compareSchemas()` and `/api/share` are unchanged, so stored shares and the 1 MiB cap are unaffected.
- Types: `SchemaGraph` in `lib/diff-types.ts`; `ComparisonPayload.graph` is optional.
- The request stays `{ oldDbml, newDbml }`.

## Graph projection and layout (client, pure functions)
`lib/diagram-graph.ts`:

- `selectTables(graph, mode)`: `changed` mode keeps tables whose kind is not unchanged plus tables one ref away; `whole` keeps every table. Refs are kept only when both ends are selected.
- `toFlow(selection)`: React Flow nodes and edges. Node id is the table name; edge id is built from the endpoints. Colour comes from a kind-to-class map (emerald added, red removed, amber modified, muted unchanged). Removed refs are dashed.
- `layout(nodes, edges)`: `@dagrejs/dagre`, left to right, node height from column count. Deterministic. Runs only when the selection changes, never on drag.
- Tables with more than 12 unchanged columns collapse them to "N unchanged".
- Above 300 tables, the whole-schema toggle asks once before switching.

## Component
`components/diff-diagram.tsx`, loaded with `next/dynamic` (`ssr: false`) when the Diagram tab opens.

- React Flow with `Background`, `Controls`, `MiniMap` (coloured by kind) and `onlyRenderVisibleElements`.
- Toggle "Changed and neighbours / Whole schema", a legend, and the unresolved ref count when non-zero.
- Rendered as `<DiffDiagram key={comparison.id} />` so a new compare resets positions.
- Hidden when the payload has no `graph`.
- No worker and no new hosts, so the CSP is unchanged.

## Summary navigation
- A node click calls `onSelectTable(name)`. The page switches to the Summary tab and passes `jumpTo={{ table, nonce }}`.
- The Summary clears filters that would hide the table, opens the Tables section, expands the row, scrolls to `table-${name}` and flashes it.
- An unchanged table has no Summary row: the click selects the node and shows "No changes in this table".
- `summaryJump(name, state)` in `lib/` computes the filter, section and expansion changes and is tested directly.

## Tests
- `lib/schema-graph.test.ts`: every kind on the fixture pairs; unchanged neighbour present; removed table keeps Schema A columns; retargeted ref points at the new target.
- `lib/diagram-graph.test.ts`: changed and whole selection; colour class per kind; no overlapping nodes and deterministic layout; a synthetic 300-table schema with expected node and edge counts and no overlaps (no timing assertions).
- `summaryJump` tests.
- Route test: the response contains `graph`.
- Browser check: drag, pan, zoom, minimap, toggle and Summary jumps on the fixtures and the 300-table schema; positions reset on a new compare.

## Dependencies
`@xyflow/react` 12.12.0 and `@dagrejs/dagre` 3.1.1, pinned.

## Out of scope
Saving positions; diagrams on `/c/[id]`.
