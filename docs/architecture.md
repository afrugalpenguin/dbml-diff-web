# Architecture

A Next.js 16 App Router app (React 19, Tailwind CSS 4, shadcn, CodeMirror 6). All schema comparison is done on the server by the [dbml-diff](https://www.npmjs.com/package/dbml-diff) npm package, pinned to an exact version in `package.json`.

## Routes

| Route | Type | What it does |
|---|---|---|
| `/` | Static page (client component) | Two DBML editors, Compare, Swap, Clear, result tabs (Summary, Diagram, Text, Migration, DBML). The Share button is temporarily hidden. |
| `POST /api/diff` | Route handler (Node.js runtime) | Compares two schemas and returns all output formats. Stores nothing. |
| `POST /api/share` | Route handler (Node.js runtime) | Stores a completed comparison in Redis and returns its id. Kept working while the Share button is hidden. |
| `/c/[id]` | Dynamic page (server component) | Read-only view of a shared comparison. Shows the text output. Returns 404 if the id is malformed, unknown or expired, or its stored value is invalid. |

## Data flow

### Compare

1. The browser checks each schema is 500 KB or smaller, then sends `{ oldDbml, newDbml }` to `POST /api/diff`.
2. The server applies the rate limit, reads the body (at most 2 MiB), checks the size of each schema again, rejects empty input, and pre-checks each schema for an unclosed `{` block so it can report the line.
3. `compareSchemas()` (`lib/compare.ts`) calls `diff()` from dbml-diff and the emitters `emitJson`, `emitText`, `emitMigration` and `emitDbml`.
4. Each changed column in the result carries `before`, its Schema A values, from dbml-diff (1.3.0 and later). The Summary's "Needs attention" items use these structured values, never the human-readable `changes` text.
5. If the parser fails, `compareSchemas()` runs `diff(oldDbml, '')` to tell which schema failed. The 400 response names Schema A or Schema B and, for syntax errors, the line and column, which the matching editor highlights.
6. `/api/diff` also builds `graph` with `schemaGraph()` (`lib/schema-graph.ts`): every table and ref in both schemas, each marked added, removed, modified (retargeted for refs) or unchanged, with per-column kinds. It comes from dbml-diff's structured output only: the diff itself, plus `diff('', newDbml)` and `diff(oldDbml, '')`, which list every table and ref of each schema. `/api/share` does not build or store it.
7. The response contains both schemas, every output format, the parsed JSON result (`parsedResult`), `graph`, counts, a timestamp and a random id. Nothing is written to storage.
8. The browser keeps the response in memory and renders it.

Clicking a "Needs attention" item jumps to its Summary row and highlights its line in the editor it belongs to: Schema A for a removed table or column, Schema B for everything else. Each item carries a structured focus (schema, table, column), and `findDbmlLine()` (`lib/dbml-locate.ts`) finds that table's block in the current editor text, then the column inside it. If the line is no longer there, for example after an edit, nothing is highlighted.

The Diagram tab loads React Flow and dagre only when it is first opened. It shows the changed tables, the tables at either end of a changed ref, and their direct ref neighbours; a toggle shows the whole schema, asking first above 300 tables. Tables are laid out with dagre and can be dragged. Clicking a changed table switches to the Summary, clears any filter that hides the table, and expands, scrolls to and flashes its row. Positions reset on a new compare.

### Share

The Share button is temporarily hidden, so the browser does not currently call this route. The route and existing share links still work.

1. The browser sends the two schemas of the current comparison, `{ oldDbml, newDbml }`, to `POST /api/share`. It never sends results.
2. The server applies the rate limit, checks each schema is 500 KB or smaller, rejects empty input, and recomputes the comparison with `compareSchemas()` (`lib/compare.ts`, the same step `/api/diff` uses). It then builds the stored object: `id`, `oldDbml`, `newDbml`, `createdAt`, `parsedResult`, `text`, `migration`, `dbml`. Any other fields in the request are ignored.
3. The object is JSON-encoded, gzipped and base64-encoded. If the encoded value is over 1 MiB the request fails with 413.
4. The value is written to Redis as `comparison:<id>` with a 30-day expiry. The id is a 10-character nanoid.
5. The browser copies `<origin>/c/<id>` to the clipboard.

### View a share

`/c/[id]` checks the id has the 10-character format `/api/share` generates, reads `comparison:<id>` from Redis (using the read-only token when set), decodes it and checks its shape (`lib/share-validation.ts`), then renders the `text` output. A malformed id, missing key, corrupt value or wrong shape returns 404.

## Where things live

| Path | Contents |
|---|---|
| `app/page.tsx` | The main page: editor and comparison state, and the compare request. |
| `components/site-header.tsx`, `components/site-footer.tsx` | Page header (with the dbml-diff version badge) and footer. |
| `components/compare-status.tsx` | The "Comparison complete" status and the error with its schema, line and column. |
| `components/comparison-result.tsx` | The result panel and its tabs (Summary, Diagram, Text, Migration, DBML). |
| `components/diff-diagram.tsx` | The Diagram tab: React Flow canvas, table nodes, mode toggle and legend. |
| `components/summary/` | The `Summary` component and its sections: toolbar, Needs attention, tables, groups, enums, refs and legend. |
| `lib/summary-groups.ts` | Summary grouping and display helpers: table change entries, grouping by schema, group moves, enum and ref rows, shared schema prefix. |
| `lib/summary-jump.ts` | Summary filter types, whether a table is visible under them, and which filters a jump must clear. |
| `lib/schema-graph.ts` | `schemaGraph()`: every table and ref in both schemas with its change kind, for the diagram. |
| `lib/diagram-graph.ts` | Diagram selection (changed and neighbours, or whole schema), React Flow nodes and edges with kind colours, and the dagre layout. |
| `lib/summary-changes.ts` | Summary logic built from structured change records: "Needs attention" items, table detail rows, change kinds with their symbols and colours, and the stable target ids (table, column, change kind) that jump-to highlighting compares. |
| `lib/dbml-locate.ts` | `findDbmlLine()`: the line of a table, or of a column inside its own table block, in DBML text. Used to focus the editor from a "Needs attention" item. |
| `app/api/diff/route.ts` | Compare endpoint and the unclosed-block pre-check. |
| `lib/compare.ts` | `compareSchemas()`: runs dbml-diff and all emitters, and attributes parser errors to a schema. Used by `/api/diff` and `/api/share`. |
| `lib/api-errors.ts` | `parserErrorResponse()`: turns a parser diagnostic into a 400 response. |
| `lib/bounded-request-body.ts` | Reads a JSON request body with a 2 MiB cap. |
| `lib/share-request.ts` | `shareRequestBody()`: the body the browser sends to `/api/share` (the compared schemas only). Unused while the Share button is hidden. |
| `app/api/share/route.ts` | Share endpoint. |
| `app/c/[id]/page.tsx` | Shared comparison page. |
| `lib/share-validation.ts` | Share id format and stored comparison shape checks for `/c/[id]`. |
| `app/layout.tsx` | Root layout, metadata, Vercel Analytics and Speed Insights. |
| `components/code-editor.tsx` | CodeMirror editor with a small DBML syntax highlighter, and the error and focus line highlights. |
| `lib/diff-types.ts` | TypeScript types for the dbml-diff JSON result and the comparison payload. |
| `lib/limits.ts` | `MAX_SCHEMA_BYTES` (shared by browser and server). |
| `lib/request-limits.ts` | Rate limiters (per validated client IP, and a stricter shared bucket without one), UTF-8 byte counting. |
| `lib/share-storage.ts` | gzip + base64 encode/decode and `MAX_REDIS_VALUE_BYTES`. |
| `next.config.mjs` | Security headers, and the installed dbml-diff version for the header badge. |
| `eslint.config.mjs` | ESLint config (`eslint-config-next`). |
| `test/fixtures/*.dbml` | Test fixtures. |

## Known issues

All open review findings, in priority order, are tracked in [#21](https://github.com/afrugalpenguin/dbml-diff-web/issues/21). None of them currently affect the behaviour described above.
