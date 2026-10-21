# Development

## Environment variables

| Name | Required | Used by |
|---|---|---|
| `KV_REST_API_URL` | Yes | Rate limiter, `/api/share`, `/c/[id]` |
| `KV_REST_API_TOKEN` | Yes | Rate limiter, `/api/share` (writes), `/c/[id]` fallback |
| `KV_REST_API_READ_ONLY_TOKEN` | No | `/c/[id]` reads. Falls back to `KV_REST_API_TOKEN`. |

These are the names the Upstash Redis integration on Vercel sets. Redis is needed even for plain comparisons, because `/api/diff` is rate limited. Without it, Compare fails with a 400 error.

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

Vitest, run from the repo root. Tests read fixtures from `test/fixtures/`.

| File | What it covers |
|---|---|
| `app/api/diff/route.test.ts` | dbml-diff results for the fixture schemas, and the rendered `Summary` output for tables, enums, refs and groups. It calls the package and the `Summary` component directly, not the route handler. |
| `app/api/share/route.test.ts` | `/api/share` returns 413 and writes nothing when the encoded comparison exceeds 1 MiB. Redis and the rate limiter are mocked. |

## Type checking

The production build type-checks the application. Run the explicit checks separately when developing:

```sh
pnpm lint
pnpm typecheck
```

ESLint is configured in `eslint.config.mjs` and runs through `pnpm lint`.

## Preview deployments

With the Vercel project connected to this repository (see [Deployment](deployment.md#vercel)), Vercel builds a preview deployment for every push to a branch other than `main`, and for every pull request. Each one gets its own URL, linked from the pull request. Preview deployments use the Preview environment variables, which is why Preview should point at a separate Upstash database.
