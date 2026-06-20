# Cabin OS

A private admin app for a vacation cabin, live at **[admin.benwaldencab.in](https://admin.benwaldencab.in)**.

It keeps the household knowledge in one place: a docs/wiki, contacts, nearby businesses, opening/closing checklists, photos and videos, appliances with their manuals, and a shared todo list. The whole site is behind HTTP Basic auth.

## Structure

```
api/                 Cloudflare Worker (TypeScript) — the backend + media proxy
  src/index.ts       Entry point: auth gate, /api dispatch, static proxy
  src/routes/        One module per feature (docs, contacts, photos, todos, …)
  src/lib/           D1 query helpers, R2 key helpers
  src/middleware/    Basic-auth validation
  migrations/        Numbered, append-only D1 SQL migrations
  wrangler.toml      Worker config + D1/KV/R2 bindings
web/                 Static frontend (no build step) — deployed to GitHub Pages
  pages/<feature>/   One index.html per feature
  assets/app.js      Shared `CabinOS` helpers (API base, fetch, ULID, markdown)
  assets/style.css
```

## How it fits together

A single Worker owns `admin.benwaldencab.in/*`. It enforces Basic auth on every request, serves `/api/*` from the route modules, and proxies everything else to the GitHub Pages origin. So the browser sees the frontend and the API as **one origin** — which is why media is referenced with relative `/api/...` URLs and why login carries through to images and downloads automatically.

State lives in three Cloudflare stores: **D1** (relational data), **KV** (auth credentials), and **R2** (`cabin-os-photos`, all uploaded media). Media is never presigned — uploads and downloads stream through the Worker (see the upload/file route pattern in `api/src/routes/`).

## Development

Prerequisites: Node 20+ and a Cloudflare account with access to the `cabin-os-*` resources. `wrangler` is installed via the `api/` dev dependencies.

```bash
cd api
npm install
npm run dev          # local Worker with bindings
npm run migrate      # apply D1 migrations locally (add --remote for production)
npx tsc --noEmit     # typecheck
```

The frontend has no build — edit the files under `web/` and reload.

## Deployment

Pushing to `main` deploys automatically via GitHub Actions:

- changes under `api/**` → `wrangler deploy` (the Worker)
- changes under `web/**` → GitHub Pages

Database migrations are applied manually (`npm run migrate --remote`), not by CI.

## Notes for contributors

See [CLAUDE.md](./CLAUDE.md) for the conventions that matter most: manual route ordering, the through-the-Worker media pattern (no R2 presigned URLs), and the single-origin auth model.
