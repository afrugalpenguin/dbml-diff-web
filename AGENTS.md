# AGENTS.md

Instructions for any agent (v0 or otherwise) changing this repo.

## What this is
Web front end for the dbml-diff npm package, live at https://dbml-diff.dev.
All diffing is done by the package. Never reimplement diff logic in the app.

## Trust and privacy
- The server stores only what the server computed. Clients send schemas, never results.
- Never log request bodies, schemas or diff output (no console.* in app code).
- Plain compare stores nothing. Only Share writes a comparison to Redis.
- Errors returned to the client are generic. Never return raw error.message.
- Enforce limits on the server: 500 KB per schema (413), 1 MiB stored value, rate limit (429).

## Types and data
- Diff types come from the dbml-diff package's emitJson output (lib/diff-types.ts). Do not guess shapes from examples.
- Work with structured change records. Never derive meaning from formatted display strings.

## Making changes
- When you replace code, delete the old version. No hidden elements, unreachable branches or unused exports left behind.
- Keep components small. No new code in app/page.tsx beyond wiring; put new UI in components/ and logic in lib/.
- Do not weaken safety config (ignoreBuildErrors, lint, strict TypeScript).
- Before writing code for a bug, state the cause and your approach in a few lines.

## Tests
- Every bug fix gets a test that fails without the fix.
- A test must exercise what its name says. Route tests call the route handler.
- Fixtures live in test/fixtures/, not the repo root.
- Run `pnpm test` and `pnpm build`, and say what you ran and the result.

## Style
- No em dashes or en dashes anywhere (code, copy, docs, commits). Use a hyphen or restructure.
- Conventional commits: type(scope): description, subject 72 chars or less.
- No co-author trailers in commits.
- Terminology: "Schema A" and "Schema B", "added in B", "removed in B", "SQL to turn A into B".
