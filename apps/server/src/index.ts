import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { nanoid } from "nanoid";
import { db } from "./db/client.js";
import type {
  Anchor,
  BookPassage,
  BookSummary,
  CreateAnchorInput,
  CreateLinkInput,
  Document,
  HydratedWorkspace,
  Link,
  Motif,
  MotifDetail,
  MotifInstance,
  PaneSide,
  PassageMotifInstance,
  PassageWindow,
  Segment,
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
  segmentId: (r.segment_id as string) ?? null,
  passageRef: r.passage_ref as string,
  startOffset: Number(r.start_offset),
  endOffset: Number(r.end_offset),
  selectedText: r.selected_text as string,
  kind: "text_span",
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toSegment = (r: Row): Segment => ({
  id: r.id as string,
  documentId: r.document_id as string,
  parentId: (r.parent_id as string) ?? null,
  kind: r.kind as Segment["kind"],
  ref: r.ref as string,
  chapter: Number(r.chapter),
  verse: r.verse === null ? null : Number(r.verse),
  body: r.body as string,
  position: Number(r.position),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toMotif = (r: Row): Motif => ({
  id: r.id as string,
  headword: r.headword as string,
  source: r.source as string,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toMotifInstance = (r: Row): MotifInstance => ({
  id: r.id as string,
  motifId: r.motif_id as string,
  documentId: r.document_id as string,
  segmentId: (r.segment_id as string) ?? null,
  ref: r.ref as string,
  chapter: Number(r.chapter),
  verse: Number(r.verse),
  endVerse: r.end_verse === null ? null : Number(r.end_verse),
  confidence: r.confidence as MotifInstance["confidence"],
  rationale: r.rationale as string,
  position: Number(r.position),
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
      // Document-mode panes only carry whole-body anchors (segment_id IS NULL).
      // Corpus passage anchors are fetched per-window via /api/passages.
      const anchorRows = db
        .prepare(
          "SELECT * FROM anchors WHERE document_id = ? AND segment_id IS NULL ORDER BY start_offset",
        )
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
  const links = linkRows.map(toLink);

  // Resolve every anchor referenced by a link, so the inspector always has the
  // source/target text even when that anchor isn't currently rendered.
  const anchorIds = [...new Set(links.flatMap((l) => [l.sourceAnchorId, l.targetAnchorId]))];
  const linkAnchors = anchorIds
    .map((aid) => db.prepare("SELECT * FROM anchors WHERE id = ?").get(aid) as Row | undefined)
    .filter((r): r is Row => r !== undefined)
    .map(toAnchor);

  const payload: HydratedWorkspace = {
    workspace: toWorkspace(workspaceRow),
    panes,
    links,
    linkAnchors,
  };
  return c.json(payload);
});

app.get("/api/documents/:id", (c) => {
  const id = c.req.param("id");
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as Row | undefined;
  if (!row) return c.json({ error: "document not found" }, 404);
  return c.json(toDocument(row));
});

// List imported corpus books (for the passage navigator), in canonical order.
app.get("/api/books", (c) => {
  const rows = db
    .prepare("SELECT * FROM documents WHERE id LIKE 'kjv-%' ORDER BY rowid")
    .all() as Row[];
  const books: BookSummary[] = rows.map((r, i) => {
    const docId = r.id as string;
    const chapterCount = (
      db
        .prepare("SELECT COUNT(*) c FROM segments WHERE document_id = ? AND kind = 'chapter'")
        .get(docId) as { c: number }
    ).c;
    return {
      id: docId,
      title: r.title as string,
      reference: r.reference as string,
      ordinal: i + 1,
      chapterCount,
    };
  });
  return c.json(books);
});

// A passage window: the verse segments of one chapter (optionally a verse
// range), plus any anchors targeting those segments. We never return a whole
// book body.
app.get("/api/passages/:documentId/:chapter", (c) => {
  const documentId = c.req.param("documentId");
  const chapter = Number(c.req.param("chapter"));
  const startVerse = c.req.query("startVerse") ? Number(c.req.query("startVerse")) : null;
  const endVerse = c.req.query("endVerse") ? Number(c.req.query("endVerse")) : null;

  const docRow = db.prepare("SELECT * FROM documents WHERE id = ?").get(documentId) as
    | Row
    | undefined;
  if (!docRow) return c.json({ error: "document not found" }, 404);

  let sql =
    "SELECT * FROM segments WHERE document_id = ? AND kind = 'verse' AND chapter = ?";
  const params: (string | number)[] = [documentId, chapter];
  if (startVerse !== null) {
    sql += " AND verse >= ?";
    params.push(startVerse);
  }
  if (endVerse !== null) {
    sql += " AND verse <= ?";
    params.push(endVerse);
  }
  sql += " ORDER BY verse";
  const verseRows = db.prepare(sql).all(...params) as Row[];
  const verses = verseRows.map(toSegment);

  // Anchors on these segments.
  const segIds = verses.map((v) => v.id);
  const anchors: Anchor[] = segIds.length
    ? (
        db
          .prepare(
            `SELECT * FROM anchors WHERE segment_id IN (${segIds.map(() => "?").join(",")})`,
          )
          .all(...segIds) as Row[]
      ).map(toAnchor)
    : [];

  const payload: PassageWindow = {
    document: toDocument(docRow),
    chapter,
    startVerse,
    endVerse,
    verses,
    anchors,
  };
  return c.json(payload);
});

// A whole book for the continuously scrolling pane: all verse segments in
// canonical order, plus every segment-anchored anchor in the book.
app.get("/api/books/:documentId/passage", (c) => {
  const documentId = c.req.param("documentId");
  const docRow = db.prepare("SELECT * FROM documents WHERE id = ?").get(documentId) as
    | Row
    | undefined;
  if (!docRow) return c.json({ error: "document not found" }, 404);

  const verseRows = db
    .prepare("SELECT * FROM segments WHERE document_id = ? AND kind = 'verse' ORDER BY position")
    .all(documentId) as Row[];
  const anchorRows = db
    .prepare("SELECT * FROM anchors WHERE document_id = ? AND segment_id IS NOT NULL")
    .all(documentId) as Row[];

  const payload: BookPassage = {
    document: toDocument(docRow),
    verses: verseRows.map(toSegment),
    anchors: anchorRows.map(toAnchor),
  };
  return c.json(payload);
});

// Every motif instance in a book, for the scrolling pane's annotations.
app.get("/api/books/:documentId/motifs", (c) => {
  const documentId = c.req.param("documentId");
  const rows = db
    .prepare(
      `SELECT mi.*, m.headword FROM motif_instances mi
       JOIN motifs m ON m.id = mi.motif_id
       WHERE mi.document_id = ?
       ORDER BY mi.chapter, mi.verse, m.headword`,
    )
    .all(documentId) as Row[];
  const instances: PassageMotifInstance[] = rows.map((r) => ({
    ...toMotifInstance(r),
    headword: r.headword as string,
  }));
  return c.json(instances);
});

// Motif instances (imported typology reference data) touching a passage
// window — same addressing as /api/passages.
app.get("/api/passages/:documentId/:chapter/motifs", (c) => {
  const documentId = c.req.param("documentId");
  const chapter = Number(c.req.param("chapter"));
  const startVerse = c.req.query("startVerse") ? Number(c.req.query("startVerse")) : null;
  const endVerse = c.req.query("endVerse") ? Number(c.req.query("endVerse")) : null;

  let sql = `SELECT mi.*, m.headword FROM motif_instances mi
             JOIN motifs m ON m.id = mi.motif_id
             WHERE mi.document_id = ? AND mi.chapter = ?`;
  const params: (string | number)[] = [documentId, chapter];
  if (startVerse !== null) {
    sql += " AND mi.verse >= ?";
    params.push(startVerse);
  }
  if (endVerse !== null) {
    sql += " AND mi.verse <= ?";
    params.push(endVerse);
  }
  sql += " ORDER BY mi.verse, m.headword";
  const rows = db.prepare(sql).all(...params) as Row[];
  const instances: PassageMotifInstance[] = rows.map((r) => ({
    ...toMotifInstance(r),
    headword: r.headword as string,
  }));
  return c.json(instances);
});

// One motif with all its instances across the corpus (e.g. every verse Wilson
// reads under "Lamb").
app.get("/api/motifs/:id", (c) => {
  const id = c.req.param("id");
  const motifRow = db.prepare("SELECT * FROM motifs WHERE id = ?").get(id) as Row | undefined;
  if (!motifRow) return c.json({ error: "motif not found" }, 404);
  const instanceRows = db
    .prepare(
      `SELECT mi.* FROM motif_instances mi
       JOIN documents d ON d.id = mi.document_id
       WHERE mi.motif_id = ? ORDER BY d.rowid, mi.chapter, mi.verse`,
    )
    .all(id) as Row[];
  const payload: MotifDetail = {
    motif: toMotif(motifRow),
    instances: instanceRows.map(toMotifInstance),
  };
  return c.json(payload);
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
    `INSERT INTO anchors (id, document_id, segment_id, passage_ref, start_offset, end_offset, selected_text, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    body.documentId,
    body.segmentId ?? null,
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
