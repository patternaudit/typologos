# Typologos

A linked-document editor for biblical typology. Open two passages side-by-side,
highlight meaningful spans, link them with a typed relationship, and watch the
theological connection appear as a curved connector between the panes.

This is the MVP: one seeded workspace (Genesis 22 ↔ John 3), text-span anchors,
typed links, an SVG connector overlay, and a click-to-inspect side panel — all
persisted in SQLite.

## Stack

- **Web:** React + Vite + TypeScript. Plain offset-based passage renderer (anchors
  are character ranges into `body`), an absolutely-positioned SVG overlay for
  connectors, `getBoundingClientRect` for measurement.
- **Server:** Hono on Node, with the built-in `node:sqlite` driver (zero native
  build — works on bleeding-edge Node where `better-sqlite3` has no prebuilds).
- **Shared:** one `types.ts` consumed by both apps.

## Run it

```bash
npm install
npm run db:setup     # create tables + seed the Genesis 22 ↔ John 3 workspace
npm run dev          # server on :5179, web on :5173
```

Open http://localhost:5173 — it boots straight into the seeded workspace.

To reset the data at any time: `npm run db:seed` (idempotent).

## How the flow works

1. Select text in a pane → click **+ Anchor** in the top bar (one per side).
2. Click an existing left highlight to set it as the link **source**, a right
   highlight to set the **target** (newly created anchors are auto-selected).
3. Pick a relationship type, add an optional title/rationale, click **Create link**.
4. A curved connector appears. Click it to open the inspector; delete from there.

Anchors and links survive a page refresh (SQLite).

## Layout

```
apps/web      React UI (Workspace, PassagePane, ConnectorOverlay, LinkInspector, AnchorControls)
apps/server   Hono API + node:sqlite (db/migrate, db/seed, index.ts routes)
packages/shared  shared domain types
```

## API

```
GET    /api/workspaces/:id    # full hydrated workspace { workspace, panes[], links[] }
GET    /api/documents/:id
POST   /api/anchors
POST   /api/links
PATCH  /api/links/:id
DELETE /api/links/:id
```
