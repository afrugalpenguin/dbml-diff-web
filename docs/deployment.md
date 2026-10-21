# Deployment

The app is deployed on Vercel.

## Vercel

- Framework preset: Next.js. Install with pnpm (detected from `pnpm-lock.yaml`), build with `pnpm build`.
- Connect the Vercel project to this GitHub repository (**Settings > Git**) with `main` as the production branch. Pushes to `main` then deploy to Production, and other branches and pull requests get preview deployments (see [Development](development.md#preview-deployments)).
- Route handlers and `/c/[id]` run on the Node.js runtime (`export const runtime = 'nodejs'`), because sharing uses `node:zlib`.
- Redis is provided by Upstash. Set the environment variables in each Vercel environment as described in [Development](development.md#environment-variables).
- Vercel Analytics and Speed Insights are included in the root layout and load in production builds only. Enable them in the Vercel project to collect data.
- Security headers (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) are set for every route in `next.config.mjs`. The app does not set `Strict-Transport-Security`, because Vercel already sends it.

## Custom domain

Production is served at https://dbml-diff.dev, added under the Vercel project's **Settings > Domains**. That page shows the DNS records (or nameservers) the domain needs to point at Vercel.

The app has no hardcoded host. Share links are built from the current origin, so they work on preview URLs and on localhost too.
