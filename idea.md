# Typologos MVP Kickoff

You are building **Typologos**, a React/Vite + SQLite MVP for a linked document editor focused on biblical typology.

## Product Goal

Build a two-pane workspace where a user can load two passages, select text spans, create links between those spans, and visually see those links as connector “strings” between panes.

This is **not** a graph app. It is a linked document editor.

## Tech Stack

Use:

- React
- Vite
- TypeScript
- SQLite
- Drizzle ORM
- Node/Express or Hono API
- Tiptap/ProseMirror for text rendering and span selection
- SVG overlay for connector rendering
- TanStack Router if routing is needed

Avoid:

- Next.js
- React Flow
- Postgres
- browser SQLite
- collaboration/Yjs
- AI features
- complex Bible search
- force-directed graph visualization

## MVP Scope

### Must Build

1. Two-pane document workspace
2. Hardcoded seed passages
3. Text selection inside each pane
4. Create anchor from selected text
5. Link one anchor in left pane to one anchor in right pane
6. Draw SVG connector between linked anchors
7. Click connector to inspect link metadata
8. Persist documents, anchors, links, and workspaces in SQLite

### Do Not Build Yet

- Multi-pane canvas
- AI suggestions
- full Bible corpus import
- user accounts
- real-time collaboration
- publishing/sharing
- commentary marketplace
- graph view

## Anchor Model

Limit anchors to one kind at first:

```ts
type AnchorKind = "text_span";
```

An anchor is a selected range of text inside a document passage.

```ts
type TextAnchor = {
  id: string;
  documentId: string;
  passageRef: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  kind: "text_span";
};
```

Do not support paragraph anchors, verse anchors, block anchors, semantic anchors, or generated anchors yet.

## Link Model

```ts
type RelationshipType =
  | "typology"
  | "quotation"
  | "allusion"
  | "parallel"
  | "contrast"
  | "historical_context";

type Link = {
  id: string;
  sourceAnchorId: string;
  targetAnchorId: string;
  type: RelationshipType;
  title?: string;
  rationale?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Database Tables

Create these tables with Drizzle:

```txt
documents
workspaces
workspace_panes
anchors
links
```

Suggested shape:

```ts
documents {
  id: text primary key
  title: text not null
  reference: text not null
  body: text not null
  source: text
  created_at: text not null
  updated_at: text not null
}

workspaces {
  id: text primary key
  title: text not null
  created_at: text not null
  updated_at: text not null
}

workspace_panes {
  id: text primary key
  workspace_id: text not null
  side: text not null // "left" | "right"
  document_id: text not null
}

anchors {
  id: text primary key
  document_id: text not null
  passage_ref: text not null
  start_offset: integer not null
  end_offset: integer not null
  selected_text: text not null
  kind: text not null // always "text_span"
  created_at: text not null
  updated_at: text not null
}

links {
  id: text primary key
  workspace_id: text not null
  source_anchor_id: text not null
  target_anchor_id: text not null
  type: text not null
  title: text
  rationale: text
  created_at: text not null
  updated_at: text not null
}
```

## Seed Data

Seed at least one workspace with:

Left pane:

- Genesis 22:1–19
- Title: Binding of Isaac

Right pane:

- John 3:16–17
- Title: God Gives His Son

Also include optional seeded links:

- Genesis 22:2 phrase: “your son, your only son, whom you love”
- John 3:16 phrase: “his only Son”
- Relationship type: `typology`
- Title: “Beloved son offered by father”

## UI Requirements

### Workspace Layout

Create a main screen:

```txt
┌──────────────────────────────┬──────────────────────────────┐
│ Left Passage                 │ Right Passage                │
│                              │                              │
│ Highlighted span ─────────── Highlighted span               │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

### Pane Behavior

Each pane should:

- render document title/reference
- render body text
- support text selection
- allow creating an anchor from selected text
- render existing anchors as highlights
- expose DOM elements for each rendered anchor so connector lines can be measured

### Link Creation Flow

Implement simple flow:

1. User selects text in left pane.
2. User clicks “Create Anchor.”
3. User selects text in right pane.
4. User clicks “Create Anchor.”
5. User chooses source and target anchor from a small panel.
6. User selects relationship type.
7. User enters optional title and rationale.
8. User clicks “Create Link.”

Keep it ugly but functional first. No fancy drag behavior required.

### Connector Rendering

Use an absolutely positioned SVG overlay across the workspace.

For each link:

1. Find source anchor DOM element by `data-anchor-id`.
2. Find target anchor DOM element by `data-anchor-id`.
3. Use `getBoundingClientRect()`.
4. Convert viewport coordinates into workspace-local coordinates.
5. Draw a curved SVG path between midpoint-right of source and midpoint-left of target.

Example concept:

```ts
const source = sourceEl.getBoundingClientRect();
const target = targetEl.getBoundingClientRect();
const container = containerEl.getBoundingClientRect();

const x1 = source.right - container.left;
const y1 = source.top + source.height / 2 - container.top;
const x2 = target.left - container.left;
const y2 = target.top + target.height / 2 - container.top;

const dx = Math.max(80, Math.abs(x2 - x1) / 2);

const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
```

### Connector Interaction

Clicking a connector should open a side panel or popover showing:

- relationship type
- title
- source selected text
- target selected text
- rationale

## Implementation Notes

Prefer boring implementation.

Do not over-abstract too early.

Recommended structure:

```txt
apps/web
  src/
    main.tsx
    app/
    components/
      Workspace.tsx
      PassagePane.tsx
      ConnectorOverlay.tsx
      LinkInspector.tsx
      AnchorControls.tsx
    hooks/
      useTextSelection.ts
      useAnchorRects.ts
    api/

apps/server
  src/
    index.ts
    db/
      schema.ts
      migrate.ts
      seed.ts
    routes/
      documents.ts
      workspaces.ts
      anchors.ts
      links.ts

packages/shared
  src/
    types.ts
```

## API Endpoints

Create minimal endpoints:

```txt
GET /api/workspaces/:id
GET /api/documents/:id
POST /api/anchors
POST /api/links
PATCH /api/links/:id
DELETE /api/links/:id
```

The workspace endpoint should return the full hydrated workspace:

```ts
{
  workspace,
  panes: [
    { side: "left", document, anchors: [] },
    { side: "right", document, anchors: [] }
  ],
  links: []
}
```

## Acceptance Criteria

The MVP is working when:

1. The app opens to a seeded workspace.
2. Genesis 22 appears on the left.
3. John 3 appears on the right.
4. User can create text-span anchors in each pane.
5. Anchors appear highlighted.
6. User can create a typed link between two anchors.
7. A curved connector appears between the linked highlights.
8. Clicking the connector shows link details.
9. Refreshing the page preserves anchors and links through SQLite.

## Important Product Constraint

Do not model typology as a graph first.

The graph is implicit in the data model, but the user experience is a two-pane linked document editor.