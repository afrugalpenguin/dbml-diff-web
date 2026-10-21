# Development

## Environment variables

| Name | Required | Used by |
|---|---|---|
| `KV_REST_API_URL` | Yes | Rate limiter, `/api/share`, `/c/[id]` |
| `KV_REST_API_TOKEN` | Yes | Rate limiter, `/api/share` (writes), `/c/[id]` fallback |
| `KV_REST_API_READ_ONLY_TOKEN` | No | `/c/[id]` reads. Falls back to `KV_REST_API_TOKEN`. |

These are the names the Upstash Redis integration on Vercel sets. Redis is needed even for plain comparisons, because `/api/diff` is rate limited. Without it, Compare fails with a 500 `Unable to compare DBML schemas.`

Set them in each Vercel environment, each pointing at its own Upstash database:

| Vercel environment | Database |
|---|---|
| Production | Production database |
| Preview | A separate database, so preview deployments never read or write production shares or rate-limit counters |
| Development | A separate database (can be the same one as Preview) |

To get them locally, either pull them from Vercel:

```sh
pnpm dlx vercel link
pnpm dlx vercel env pull .env.local
```

or copy `.env.example` to `.env.local` and fill in your own values. `.env*.local` is git-ignored.

## Tests

```sh
pnpm test
```

Vitest, run from the repo root. Tests read fixtures from `test/fixtures/`. Most tests run in Node; the ones that click or mount components start with `// @vitest-environment jsdom`.

| File | What it covers |
|---|---|
| `app/api/diff/route.test.ts` | `/api/diff` handler: success, 400, 413, 429, unclosed blocks, parser diagnostics and generic errors. The rate limiter is mocked. |
| `app/api/share/route.test.ts` | `/api/share` handler: validation, limits, rate limiting, storage and server-computed output. Redis and the rate limiter are mocked. |
| `app/c/[id]/page.test.tsx` | The shared comparison page: id validation, missing, corrupt and valid shares. Redis is mocked. |
| `app/summary.test.ts` | `Summary` rendering for the fixture schemas: tables, enums, refs and groups, and change card colours by change kind. |
| `app/summary-attention.test.ts` | "Needs attention" items built from structured column changes. |
| `components/code-editor.test.ts` | The editor error-line decoration. |
| `components/code-editor-focus.test.tsx` | The editor focus line, mounted in jsdom. |
| `components/comparison-result.test.tsx` | The result tabs: each shows its output, Migration has the SQL heading, and Diagram appears only with a graph. |
| `components/summary/summary.test.tsx` | Clicking a "Needs attention" item reports its editor focus to the page, and a jump from the diagram shows, expands and scrolls to the table (jsdom). |
| `components/diff-diagram.test.tsx` | The diagram's default and whole-schema views, table clicks and the large-schema confirmation (jsdom, with the layout APIs React Flow needs stubbed). |
| `lib/*.test.ts` | Request body limits, rate limit buckets, share validation and request body, the structured before values in `compareSchemas()`, the Summary's change targets (each attention item highlights exactly one row) and editor focus, the DBML line lookup, the diagram's schema graph, selection, styles and layout (including a 300-table schema), and which filters a Summary jump clears. |
| `next.config.test.ts` | Security headers and build type checking. |
| `source-lines.test.ts` | No line in `app/`, `components/` or `lib/` is longer than 160 characters. |

## Type checking

The production build type-checks the application. Run the explicit checks separately when developing:

```sh
pnpm lint
pnpm typecheck
```

ESLint is configured in `eslint.config.mjs` and runs through `pnpm lint`.

## CI

`.github/workflows/ci.yml` runs on every pull request: `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. The `test` job is a required check on `main`, and branches must be up to date with `main` before merging.

## Preview deployments

With the Vercel project connected to this repository (see [Deployment](deployment.md#vercel)), Vercel builds a preview deployment for every push to a branch other than `main`, and for every pull request. Each one gets its own URL, linked from the pull request. Preview deployments use the Preview environment variables, which is why Preview should point at a separate Upstash database.
