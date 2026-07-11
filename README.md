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
npm run db:setup        # create tables + seed the Genesis 22 ↔ John 3 demo
npm run corpus:import   # download + import the full KJV (OSIS -> documents + segments)
npm run motifs:import   # parse Wilson's "A Dictionary of Bible Types" into motifs
npm run josephus:import # download + import Whiston's Wars, Antiquities + Life
npm run atwill:import   # load Atwill's Flavian Signature parallels (NT <-> Josephus)
npm run mason:import    # load the "Luke used Josephus" dependence touchpoints
npm run dev             # server on :5179, web on :5173
```

Open http://localhost:5173 — it boots into the seeded demo workspace. Use the
per-pane navigator (top-right of each pane) to jump anywhere in the KJV.

To reset the demo at any time: `npm run db:seed` (idempotent, and leaves the
imported corpus untouched).

## Corpus model

The KJV is sourced from `eng-kjv.osis.xml`
([seven1m/open-bibles](https://github.com/seven1m/open-bibles)) and imported into:

- **documents** — one per book (id `kjv-<osisId>`, e.g. `kjv-John`). Bodies are
  empty; we never render a whole book.
- **segments** — chapters and verses (`kind` = `chapter` | `verse`). Verse
  segments hold the text.

Panes render **windows** (a chapter, optionally a verse range), never whole
books. Anchors created in a corpus passage target a verse:
`anchor.segment_id + start_offset + end_offset` (offsets local to the verse).
Legacy standalone documents still work — those anchors have `segment_id = null`
and offset into the document body.

The seeded demo workspace uses legacy standalone documents; navigate either pane
into the corpus to create verse-anchored links. Navigation is remembered
(localStorage) so a refresh keeps your place, and the segment anchors + links
persist in SQLite.

## Motif reference layer (Wilson's Dictionary of Bible Types)

`npm run motifs:import` parses the OCR'd text of Walter L. Wilson's
*A Dictionary of Bible Types* (`apps/server/data/`) into two tables:

- **motifs** — one per dictionary headword (Aaron, Lamb, Rock, …), ~1,100 total.
- **motif_instances** — one per verse reference inside an entry (~4,100),
  anchored to the KJV verse segment, carrying Wilson's rationale paragraph and
  his own confidence grade: **(a)** pure types identified as such by Scripture,
  **(b)** evident from usage, **(c)** suggestive/devotional.

The parser is defensive about the scrape's OCR noise: it strips page chrome,
excises the interleaved topical-index pages, recovers book numbers the OCR ate
("| Timothy" → 1 Timothy, backed by the e-text's numeric verse codes), and
resolves ~99.9% of graded references to actual verse segments. Re-running the
import replaces the previous Wilson data wholesale (idempotent).

This is a *reference layer*, distinct from user-authored links: instances carry
`source = 'wilson-dbt'` provenance. Note Wilson (1957, Moody Press) is likely
still under copyright — fine for personal research use; resolve before
publishing the imported data.

In the UI (corpus passages only): each verse that Wilson annotates gets a small
amber count badge beside its verse number. Clicking it opens the **Types &
figures** drawer — headword, Wilson's grade chip (a/b/c), and his rationale.
"Everywhere X appears" expands a motif into all of its passages; clicking one
opens that passage in the *opposite* pane, scrolled to the verse.

## Josephus corpus + claimed parallels (Atwill)

`npm run josephus:import` brings in Whiston's *Wars of the Jews* (7 books,
~690 sections) and *Life of Josephus* from Project Gutenberg as corpus
documents — they appear in the pane navigator alongside the KJV, with
Whiston sections as "verses".

`npm run atwill:import` loads the 34-step "Flavian Signature" sequence from
Joseph Atwill's *Caesar's Messiah* as a `parallels` layer: claimed
typological pairs between NT passages (mostly Luke) and Josephus. Each row
carries both quoted excerpts, a `verdict` and `verification` note from
textual spot-checking (see `docs/night-2026-07-10/LOG.md`). Rendered as
slate-blue dotted arcs between panes, distinct from Wilson's amber arcs and
from user links.

## Views

**Start** — curated entry points into the corpora and layers (first visit
lands here; `?start=1`).

**Reading** — panes hold **whole books** in a continuous scroll; the chapter
picker scrolls rather than reloads. Verses annotated by Wilson carry a dashed
underline — hover for the motif brief, click for the Types & Figures drawer.
Arcs between the panes: amber dashes = shared Wilson motifs, slate dots =
Atwill parallels, plum dots = Mason dependence, solid colors = your links.
Select text → a floating **+ Anchor** appears at the pane's foot; with both
sides staged, **Create link →** opens the definition modal.

**Overview** — the whole-scope connection map: two vertical strips (Bible /
OT / NT / Josephus / Wars / Antiquities per side), every connection drawn
between them, layers toggleable. Click an arc to open that chapter pair in
the reading view; click a book band to load that book.

Deep links: `?left=kjv-Gen:3:7&right=kjv-Rev:22:2` (book:chapter:verse),
`?parallel=par-atwill-32`, `?overview=1&a=ot&b=nt`, `?left=doc:<id>` for
legacy documents.

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
GET    /api/workspaces/:id              # hydrated { workspace, panes[], links[], linkAnchors[] }
GET    /api/documents/:id
GET    /api/books                       # imported corpus books (for the navigator)
GET    /api/passages/:documentId/:chapter?startVerse=&endVerse=   # a passage window
GET    /api/passages/:documentId/:chapter/motifs?startVerse=&endVerse=  # motif instances in a window
GET    /api/books/:documentId/passage   # a whole book (continuous pane)
GET    /api/books/:documentId/motifs    # all motif instances in a book
GET    /api/motifs/:id                  # one motif + all its instances
GET    /api/parallels                   # claimed parallels (Atwill layer)
POST   /api/anchors                     # accepts optional segmentId
POST   /api/links
PATCH  /api/links/:id
DELETE /api/links/:id
DELETE /api/anchors/:id                 # cascades to dependent links
```
