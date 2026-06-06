import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { nanoid } from "nanoid";
import { db } from "./db/client.js";
import type {
  Anchor,
  CreateAnchorInput,
  CreateLinkInput,
  Document,
  HydratedWorkspace,
  Link,
  PaneSide,
  UpdateLinkInput,
  Workspace,
} from "@typologos/shared";

const app = new Hono();
app.use("/api/*", cors());

const now = () => new Date().toISOString();

// --- row mappers (snake_case rows -> camelCase domain objects) --------------

type Row = Record<string, unknown>;

const toDocument = (r: Row): Document => ({
  id: r.id as string,
  title: r.title as string,
  reference: r.reference as string,
  body: r.body as string,
  source: (r.source as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toWorkspace = (r: Row): Workspace => ({
  id: r.id as string,
  title: r.title as string,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toAnchor = (r: Row): Anchor => ({
  id: r.id as string,
  documentId: r.document_id as string,
  passageRef: r.passage_ref as string,
  startOffset: Number(r.start_offset),
  endOffset: Number(r.end_offset),
  selectedText: r.selected_text as string,
  kind: "text_span",
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toLink = (r: Row): Link => ({
  id: r.id as string,
  workspaceId: r.workspace_id as string,
  sourceAnchorId: r.source_anchor_id as string,
  targetAnchorId: r.target_anchor_id as string,
  type: r.type as Link["type"],
  title: (r.title as string) ?? null,
  rationale: (r.rationale as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

// --- routes -----------------------------------------------------------------

app.get("/api/health", (c) => c.json({ ok: true }));

// Full hydrated workspace: panes (ordered left, right) each with its document
// and that document's anchors, plus all links for the workspace.
app.get("/api/workspaces/:id", (c) => {
  const id = c.req.param("id");
  const workspaceRow = db
    .prepare("SELECT * FROM workspaces WHERE id = ?")
    .get(id) as Row | undefined;
  if (!workspaceRow) return c.json({ error: "workspace not found" }, 404);

  const paneRows = db
    .prepare("SELECT * FROM workspace_panes WHERE workspace_id = ?")
    .all(id) as Row[];

  const order: Record<PaneSide, number> = { left: 0, right: 1 };
  const panes = paneRows
    .map((pane) => {
      const documentId = pane.document_id as string;
      const docRow = db
        .prepare("SELECT * FROM documents WHERE id = ?")
        .get(documentId) as Row | undefined;
      if (!docRow) return null;
      const anchorRows = db
        .prepare("SELECT * FROM anchors WHERE document_id = ? ORDER BY start_offset")
        .all(documentId) as Row[];
      return {
        side: pane.side as PaneSide,
        document: toDocument(docRow),
        anchors: anchorRows.map(toAnchor),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => order[a.side] - order[b.side]);

  const linkRows = db
    .prepare("SELECT * FROM links WHERE workspace_id = ?")
    .all(id) as Row[];

  const payload: HydratedWorkspace = {
    workspace: toWorkspace(workspaceRow),
    panes,
    links: linkRows.map(toLink),
  };
  return c.json(payload);
});

app.get("/api/documents/:id", (c) => {
  const id = c.req.param("id");
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as Row | undefined;
  if (!row) return c.json({ error: "document not found" }, 404);
  return c.json(toDocument(row));
});

app.post("/api/anchors", async (c) => {
  const body = await c.req.json<CreateAnchorInput>();
  if (
    !body.documentId ||
    typeof body.startOffset !== "number" ||
    typeof body.endOffset !== "number" ||
    body.endOffset <= body.startOffset ||
    !body.selectedText
  ) {
    return c.json({ error: "invalid anchor payload" }, 400);
  }

  const ts = now();
  const id = nanoid();
  db.prepare(
    `INSERT INTO anchors (id, document_id, passage_ref, start_offset, end_offset, selected_text, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    body.documentId,
    body.passageRef ?? "",
    body.startOffset,
    body.endOffset,
    body.selectedText,
    "text_span",
    ts,
    ts,
  );
  const row = db.prepare("SELECT * FROM anchors WHERE id = ?").get(id) as Row;
  return c.json(toAnchor(row), 201);
});

app.delete("/api/anchors/:id", (c) => {
  const id = c.req.param("id");
  const existing = db.prepare("SELECT * FROM anchors WHERE id = ?").get(id) as Row | undefined;
  if (!existing) return c.json({ error: "anchor not found" }, 404);
  // An anchor can't outlive its links: drop any link that references it on
  // either side, then the anchor itself.
  db.prepare("DELETE FROM links WHERE source_anchor_id = ? OR target_anchor_id = ?").run(id, id);
  db.prepare("DELETE FROM anchors WHERE id = ?").run(id);
  return c.json({ ok: true });
});

app.post("/api/links", async (c) => {
  const body = await c.req.json<CreateLinkInput>();
  if (!body.workspaceId || !body.sourceAnchorId || !body.targetAnchorId || !body.type) {
    return c.json({ error: "invalid link payload" }, 400);
  }

  const ts = now();
  const id = nanoid();
  db.prepare(
    `INSERT INTO links (id, workspace_id, source_anchor_id, target_anchor_id, type, title, rationale, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    body.workspaceId,
    body.sourceAnchorId,
    body.targetAnchorId,
    body.type,
    body.title ?? null,
    body.rationale ?? null,
    ts,
    ts,
  );
  const row = db.prepare("SELECT * FROM links WHERE id = ?").get(id) as Row;
  return c.json(toLink(row), 201);
});

app.patch("/api/links/:id", async (c) => {
  const id = c.req.param("id");
  const existing = db.prepare("SELECT * FROM links WHERE id = ?").get(id) as Row | undefined;
  if (!existing) return c.json({ error: "link not found" }, 404);

  const body = await c.req.json<UpdateLinkInput>();
  const type = body.type ?? (existing.type as string);
  const title = (body.title === undefined ? existing.title : body.title) as string | null;
  const rationale = (body.rationale === undefined ? existing.rationale : body.rationale) as
    | string
    | null;

  db.prepare(
    "UPDATE links SET type = ?, title = ?, rationale = ?, updated_at = ? WHERE id = ?",
  ).run(type, title ?? null, rationale ?? null, now(), id);

  const row = db.prepare("SELECT * FROM links WHERE id = ?").get(id) as Row;
  return c.json(toLink(row));
});

app.delete("/api/links/:id", (c) => {
  const id = c.req.param("id");
  const existing = db.prepare("SELECT * FROM links WHERE id = ?").get(id) as Row | undefined;
  if (!existing) return c.json({ error: "link not found" }, 404);
  db.prepare("DELETE FROM links WHERE id = ?").run(id);
  return c.json({ ok: true });
});

const port = Number(process.env.PORT ?? 5179);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] Typologos API listening on http://localhost:${info.port}`);
});
