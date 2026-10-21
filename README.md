# dbml-diff web

Compare two DBML schemas in the browser and get a summary, an interactive diagram, text diff, SQL migration and DBML diff: **https://dbml-diff.dev**

A web front end for the [dbml-diff](https://github.com/afrugalpenguin/dbml-diff) package ([npm](https://www.npmjs.com/package/dbml-diff)).

Built with [v0](https://v0.app), deployed on [Vercel](https://vercel.com), using the [dbml-diff](https://www.npmjs.com/package/dbml-diff) package.

## Quick start

Prerequisites: Node.js 20.9+, pnpm 12, and access to the Vercel project (or your own [Upstash Redis](https://upstash.com) database).

```sh
git clone https://github.com/afrugalpenguin/dbml-diff-web.git
cd dbml-diff-web
pnpm install
pnpm dlx vercel link
pnpm dlx vercel env pull .env.local
pnpm dev
```

Open http://localhost:3000.

No Vercel access? Run `cp .env.example .env.local` and fill in your own Upstash values instead of `vercel link` / `vercel env pull`. Redis is required even for plain comparisons, because it backs the rate limiter.

## Scripts

- `pnpm dev`: start the dev server on port 3000.
- `pnpm build`: create a production build.
- `pnpm test`: run the Vitest suite once.
- `pnpm lint`: run ESLint.
- `pnpm typecheck`: run the TypeScript compiler without emitting files.

CI runs lint, typecheck, tests and the production build on every pull request.

## Privacy

Comparisons are processed on the server and not stored unless they are shared.
Shared comparisons expire after 30 days. The Share button is temporarily hidden; existing share links still work.

## Docs

- [Architecture](docs/architecture.md): routes, data flow, where things live
- [Limits and privacy](docs/limits-and-privacy.md): size limits, rate limits, storage, logging
- [Development](docs/development.md): environment variables, tests, preview deployments
- [Deployment](docs/deployment.md): Vercel and the custom domain
