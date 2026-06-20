# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cabin OS — a private admin app for a vacation cabin, served at `admin.benwaldencab.in`. It tracks docs/wiki, contacts, area businesses, checklists, photos, videos, appliances (with manuals), and todos. Two parts:

- `api/` — a single Cloudflare Worker (TypeScript) backed by D1 (SQL), KV (auth), and R2 (media).
- `web/` — a static, no-build frontend (one HTML file per feature) deployed to GitHub Pages.

## Commands

All commands run from `api/` unless noted.

```bash
npm run dev        # wrangler dev — local Worker + bindings
npm run deploy     # wrangler deploy (CI does this on push; rarely run by hand)
npm run migrate    # wrangler d1 migrations apply cabin-os-db  (add --remote to hit prod D1)
npx tsc --noEmit   # typecheck — do this before committing API changes
```

There is no test suite and no linter. `npx tsc --noEmit` is the only automated check.

The web frontend has no build step — edit `web/**/*.html`, `web/assets/app.js`, or `web/assets/style.css` directly.

## Deployment

Push to `main` triggers GitHub Actions (`.github/workflows/`):

- `deploy-api.yml` — changes under `api/**` → `wrangler deploy` (the Worker).
- `deploy-web.yml` — changes under `web/**` → GitHub Pages.

Both also support manual `workflow_dispatch`. D1 migrations are **not** run by CI — apply them by hand with `npm run migrate --remote`.

## Architecture

### Single Worker, single origin

The Worker owns the route `admin.benwaldencab.in/*` (see `api/wrangler.toml`). In `api/src/index.ts` it:

1. Answers `OPTIONS` with CORS headers.
2. Runs a **global Basic-auth gate** (`validateBasicAuth`) on *every* request.
3. Dispatches `/api/*` to a route handler.
4. Proxies everything else to the GitHub Pages origin (stripping `Authorization`).

The practical consequence: **the browser sees web + API as one origin.** That's why frontend media URLs are relative `/api/...` paths and why the browser's cached Basic credentials ride along on plain `<img>`/`<a>` requests. Keep this invariant — don't introduce absolute cross-origin media URLs.

### Auth

Basic auth, validated in `api/src/middleware/auth.ts`. Credentials live in KV as `auth:<username>` → password, compared with a timing-safe equal. The global gate in `index.ts` already protects all routes; individual mutating routes also call `requireAuth(...)` (redundant but harmless — leave it for clarity).

### Routing is manual

`index.ts` does prefix dispatch (`path.startsWith('/api/contacts')`, etc.), and each module in `api/src/routes/` matches method + a path regex itself. **Order matters** — e.g. `/api/checklists` is checked before `/api/checklist`. When adding a route, mind both the dispatch order in `index.ts` and the regex order within the module.

### Database

D1 accessed through three thin helpers in `api/src/lib/db.ts`: `dbAll`, `dbFirst`, `dbRun` — always parameterized (`.bind(...)`). Schema lives in numbered, append-only files under `api/migrations/` (`001_initial.sql` … ). Add a new numbered migration; don't edit existing ones.

IDs are ULIDs minted client-side (`CabinOS.ulid()`) or `crypto.randomUUID()` server-side.

### Media (R2) — no presigned URLs

**The R2 Workers binding has no `createPresignedUrl` method** (it needs a public R2 domain that isn't configured). Presigning throws a 500. Do not reintroduce it. Instead, all media goes **through the Worker**:

- **Upload:** `POST .../upload` streams `request.body` straight into R2 via `env.PHOTOS.put(key, request.body, ...)`, then writes the DB row. Metadata travels in `X-*` request headers (e.g. `X-Photo-Id`, `X-Category-Id`, `X-Filename`). HTTP headers are Latin-1 only, so non-ASCII values are `encodeURIComponent`-encoded on send and `decodeURIComponent`-decoded on the API side.
- **Serve:** `GET .../file` reads the object from R2 and streams it back with its content type. These are stable, same-origin, never-expiring URLs.

This pattern is implemented for todo media (`routes/todos.ts`), appliance manuals (`routes/appliances.ts`), and photos (`routes/photos.ts`) — copy it for any new media type.

### Frontend conventions

Each feature is `web/pages/<feature>/index.html` (vanilla JS, no framework). Shared code is the `CabinOS` global in `web/assets/app.js`: `API` (base URL), `apiFetch` (adds `Content-Type: application/json` and surfaces 401s), `ulid`, markdown rendering, and a small markdown editor. Auth is handled at the network layer, so the `getToken`/`setToken` functions are intentional no-op stubs.
