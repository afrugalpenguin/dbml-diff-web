# Architecture

A Next.js 16 App Router app (React 19, Tailwind CSS 4, shadcn, CodeMirror 6). All schema comparison is done on the server by the [dbml-diff](https://www.npmjs.com/package/dbml-diff) npm package, pinned to an exact version in `package.json`.

## Routes

| Route | Type | What it does |
|---|---|---|
| `/` | Static page (client component) | Two DBML editors, Compare, Swap, Clear, result tabs (Summary, Text, Migration, DBML). The Share button is temporarily hidden. |
| `POST /api/diff` | Route handler (Node.js runtime) | Compares two schemas and returns all output formats. Stores nothing. |
| `POST /api/share` | Route handler (Node.js runtime) | Stores a completed comparison in Redis and returns its id. Kept working while the Share button is hidden. |
| `/c/[id]` | Dynamic page (server component) | Read-only view of a shared comparison. Shows the text output. Returns 404 if the id is malformed, unknown or expired, or its stored value is invalid. |

## Data flow

### Compare

1. The browser checks each schema is 500 KB or smaller, then sends `{ oldDbml, newDbml }` to `POST /api/diff`.
2. The server applies the rate limit, reads the body (at most 2 MiB), checks the size of each schema again, rejects empty input, and pre-checks each schema for an unclosed `{` block so it can report the line.
3. `compareSchemas()` (`lib/compare.ts`) calls `diff()` from dbml-diff and the emitters `emitJson`, `emitText`, `emitMigration` and `emitDbml`.
4. When columns changed, it also runs `diff(oldDbml, '')`, which lists every Schema A table with its columns, and attaches each changed column's Schema A values as `before`. The Summary's "Needs attention" items use these structured values, never the human-readable `changes` text.
5. If the parser fails, `compareSchemas()` runs `diff(oldDbml, '')` to tell which schema failed. The 400 response names Schema A or Schema B and, for syntax errors, the line and column, which the matching editor highlights.
6. The response contains both schemas, every output format, the parsed JSON result (`parsedResult`), counts, a timestamp and a random id. Nothing is written to storage.
7. The browser keeps the response in memory and renders it.

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
| `app/page.tsx` | The main page, plus the `Summary` component and `formatEnum`. |
| `lib/summary-changes.ts` | Summary logic built from structured change records: "Needs attention" items, table detail rows, change kinds with their symbols and colours, and the stable target ids (table, column, change kind) that jump-to highlighting compares. |
| `app/api/diff/route.ts` | Compare endpoint and the unclosed-block pre-check. |
| `lib/compare.ts` | `compareSchemas()`: runs dbml-diff and all emitters, adds `before` values for changed columns, and attributes parser errors to a schema. Used by `/api/diff` and `/api/share`. |
| `lib/api-errors.ts` | `parserErrorResponse()`: turns a parser diagnostic into a 400 response. |
| `lib/bounded-request-body.ts` | Reads a JSON request body with a 2 MiB cap. |
| `lib/share-request.ts` | `shareRequestBody()`: the body the browser sends to `/api/share` (the compared schemas only). Unused while the Share button is hidden. |
| `app/api/share/route.ts` | Share endpoint. |
| `app/c/[id]/page.tsx` | Shared comparison page. |
| `lib/share-validation.ts` | Share id format and stored comparison shape checks for `/c/[id]`. |
| `app/layout.tsx` | Root layout, metadata, Vercel Analytics and Speed Insights. |
| `components/code-editor.tsx` | CodeMirror editor with a small DBML syntax highlighter. |
| `lib/diff-types.ts` | TypeScript types for the dbml-diff JSON result and the comparison payload. |
| `lib/limits.ts` | `MAX_SCHEMA_BYTES` (shared by browser and server). |
| `lib/request-limits.ts` | Rate limiters (per validated client IP, and a stricter shared bucket without one), UTF-8 byte counting. |
| `lib/share-storage.ts` | gzip + base64 encode/decode and `MAX_REDIS_VALUE_BYTES`. |
| `types/dbml-diff.d.ts` | Type declarations for dbml-diff, which does not ship its own. |
| `next.config.mjs` | Security headers, and the installed dbml-diff version for the header badge. |
| `eslint.config.mjs` | ESLint config (`eslint-config-next`). |
| `test/fixtures/*.dbml` | Test fixtures. |

## Known issues

All open review findings, in priority order, are tracked in [#21](https://github.com/afrugalpenguin/dbml-diff-web/issues/21). The ones that affect the behaviour described above:

- [#20](https://github.com/afrugalpenguin/dbml-diff-web/issues/20) `app/page.tsx` still holds the page, the `Summary` component and its helpers in one file.
- [#38](https://github.com/afrugalpenguin/dbml-diff-web/issues/38) A parser stack overflow on very large input returns the raw runtime message (fix in [#49](https://github.com/afrugalpenguin/dbml-diff-web/pull/49)).
