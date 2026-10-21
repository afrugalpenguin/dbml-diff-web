# Limits and privacy

## Size limits

| Limit | Value | Where | Response |
|---|---|---|---|
| Each schema | 500 KB (512,000 bytes, UTF-8) | Browser before sending, and again on the server in `/api/diff` and `/api/share` | 413 `Each schema must be 500 KB or smaller.` |
| Stored share | 1 MiB after gzip + base64 encoding | `/api/share` | 413 `This comparison is too large to share. It is still available on screen.` |

The server caps each JSON request body at 2 MiB before parsing. This bounds memory and parsing work while leaving room for JSON escaping and request overhead around two 500 KB schemas. Oversized requests return 413 `Request is too large.`; the per-schema checks still return 413 `Each schema must be 500 KB or smaller.`

## Rate limits

Identified requests use 30 requests per minute per validated client IP. Requests without a valid IP use a separate shared 10 requests per minute bucket. In Vercel deployments, `@vercel/functions` reads `x-real-ip`; the trust comes from Vercel overwriting that header, not from the helper. This guarantee applies only on Vercel; local development uses the stricter shared bucket. The app intentionally ignores `x-forwarded-for`. See [Vercel request headers](https://vercel.com/docs/headers/request-headers#x-real-ip).

- 30 requests per minute per validated client IP, sliding window, using `@upstash/ratelimit`.
- Requests without a valid IP use one shared 10 requests per minute bucket.
- Counts are separate for `/api/diff` and `/api/share`.
- Over the limit: 429 `Rate limit exceeded. Please try again in a minute.`

## Storage

- **Compare** (`/api/diff`) stores no schema or result.
- **Share** (`/api/share`) is the only place comparison content is written. It stores both schemas and the outputs as one gzip + base64 value under `comparison:<id>`, with a 30-day expiry. After that Redis deletes it and `/c/<id>` returns 404.
- **Rate limiting** writes short-lived counters to Redis under the `dbml-diff:rate` prefix, keyed by client IP. They contain no schema content.
- The browser keeps the current comparison in memory only. Nothing is saved to local storage or cookies.

## Logging

- The application code has no `console` calls and no logging library.
- Every route handler catches its own errors and returns a JSON error, so request bodies are not passed to the framework's error logging.
- Error messages from the DBML parser are returned to the browser in the response, not logged.
- Vercel's platform request logs (method, path, status, timing) still apply. They do not include request bodies.
- When the Redis environment variables are missing, the Upstash client logs a warning about the missing config. It does not log request data.

## Third parties

- Vercel Analytics and Vercel Speed Insights run in production builds only (page views and web vitals, no editor content).
- The version badge is read from the installed `dbml-diff` package version at build time.
