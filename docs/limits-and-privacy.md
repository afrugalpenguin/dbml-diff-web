# Limits and privacy

## Size limits

| Limit | Value | Where | Response |
|---|---|---|---|
| Each schema | 500 KB (512,000 bytes, UTF-8) | Browser before sending, and again on the server in `/api/diff` and `/api/share` | 413 `Each schema must be 500 KB or smaller.` |
| Stored share | 1 MiB after gzip + base64 encoding | `/api/share` | 413 `This comparison is too large to share. It is still available on screen.` |

The server parses the JSON request body before checking schema sizes, so the outer bound on request size is the Vercel request body limit.

## Rate limits

- 30 requests per minute per client IP, sliding window, using `@upstash/ratelimit`.
- Counted separately for `/api/diff` and `/api/share`.
- The client IP is the first address in `x-forwarded-for`, then `x-real-ip`.
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
- The page fetches the latest dbml-diff release tag from the GitHub API in the browser to show the version badge (see [#18](https://github.com/afrugalpenguin/dbml-diff-web/issues/18)).
