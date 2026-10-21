# Architecture

A Next.js 16 App Router app (React 19, Tailwind CSS 4, shadcn, CodeMirror 6). All schema comparison is done on the server by the [dbml-diff](https://www.npmjs.com/package/dbml-diff) npm package, pinned to an exact version in `package.json`.

## Routes

| Route | Type | What it does |
|---|---|---|
| `/` | Static page (client component) | Two DBML editors, Compare, Swap, Clear, result tabs (Summary, Text, Migration, DBML), Share. |
| `POST /api/diff` | Route handler (Node.js runtime) | Compares two schemas and returns all output formats. Stores nothing. |
| `POST /api/share` | Route handler (Node.js runtime) | Stores a completed comparison in Redis and returns its id. |
| `/c/[id]` | Dynamic page (server component) | Read-only view of a shared comparison. Shows the text output. Returns 404 if the id is unknown or expired. |

## Data flow

### Compare

1. The browser checks each schema is 500 KB or smaller, then sends `{ oldDbml, newDbml }` to `POST /api/diff`.
2. The server applies the rate limit, checks the size again, rejects empty input, and pre-checks each schema for an unclosed `{` block so it can report the line.
3. It calls `diff()` from dbml-diff and the emitters `emitJson`, `emitText`, `emitMigration` and `emitDbml`.
4. The response contains both schemas, every output format, the parsed JSON result (`parsedResult`), counts, a timestamp and a random id. Nothing is written to storage.
5. The browser keeps the response in memory and renders it.

### Share

1. The browser sends the two schemas of the current comparison, `{ oldDbml, newDbml }`, to `POST /api/share`. It never sends results.
2. The server applies the rate limit, checks each schema is 500 KB or smaller, rejects empty input, and recomputes the comparison with `compareSchemas()` (`lib/compare.ts`, the same step `/api/diff` uses). It then builds the stored object: `id`, `oldDbml`, `newDbml`, `createdAt`, `parsedResult`, `text`, `migration`, `dbml`. Any other fields in the request are ignored.
3. The object is JSON-encoded, gzipped and base64-encoded. If the encoded value is over 1 MiB the request fails with 413.
4. The value is written to Redis as `comparison:<id>` with a 30-day expiry. The id is a 10-character nanoid.
5. The browser copies `<origin>/c/<id>` to the clipboard.

### View a share

`/c/[id]` reads `comparison:<id>` from Redis (using the read-only token when set), decodes it and renders the `text` output.

## Where things live

| Path | Contents |
|---|---|
| `app/page.tsx` | The main page, plus the `Summary` component and its formatting helpers (`formatColumn`, `formatEndpoint`, `formatEnum`). |
| `app/api/diff/route.ts` | Compare endpoint and the unclosed-block pre-check. |
| `lib/compare.ts` | `compareSchemas()`: runs dbml-diff and all emitters. Used by `/api/diff` and `/api/share`. |
| `lib/share-request.ts` | `shareRequestBody()`: the body the browser sends to `/api/share` (the compared schemas only). |
| `app/api/share/route.ts` | Share endpoint. |
| `app/c/[id]/page.tsx` | Shared comparison page. |
| `app/layout.tsx` | Root layout, metadata, Vercel Analytics and Speed Insights. |
| `components/code-editor.tsx` | CodeMirror editor with a small DBML syntax highlighter. |
| `lib/diff-types.ts` | TypeScript types for the dbml-diff JSON result and the comparison payload. |
| `lib/limits.ts` | `MAX_SCHEMA_BYTES` (shared by browser and server). |
| `lib/request-limits.ts` | Rate limiter, client IP lookup, UTF-8 byte counting. |
| `lib/share-storage.ts` | gzip + base64 encode/decode and `MAX_REDIS_VALUE_BYTES`. |
| `types/dbml-diff.d.ts` | Type declarations for dbml-diff, which does not ship its own. |
| `test/fixtures/*.dbml` | Test fixtures. |

## Known issues

All open review findings, in priority order, are tracked in [#21](https://github.com/afrugalpenguin/dbml-diff-web/issues/21). The ones that affect the behaviour described above:

- [#14](https://github.com/afrugalpenguin/dbml-diff-web/issues/14) Parser errors are always attributed to Schema B, and the error line is never highlighted.
- [#18](https://github.com/afrugalpenguin/dbml-diff-web/issues/18) Version badge shows the latest GitHub release, not the installed version.
