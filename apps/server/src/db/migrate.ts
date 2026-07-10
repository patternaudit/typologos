import { db, DB_PATH } from "./client.js";

// Plain DDL migration. No drizzle-kit ceremony for the MVP: just create the
// tables if they don't exist. The shapes mirror src/db/schema.ts exactly.
const DDL = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  reference TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_panes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  side TEXT NOT NULL,
  document_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anchors (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  segment_id TEXT,
  passage_ref TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  selected_text TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  parent_id TEXT,
  kind TEXT NOT NULL,         -- 'chapter' | 'verse'
  ref TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER,              -- null for chapter segments
  body TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_segments_doc_chapter ON segments (document_id, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_segments_doc_kind ON segments (document_id, kind);

CREATE TABLE IF NOT EXISTS motifs (
  id TEXT PRIMARY KEY,
  headword TEXT NOT NULL,
  source TEXT NOT NULL,        -- e.g. 'wilson-dbt'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS motif_instances (
  id TEXT PRIMARY KEY,
  motif_id TEXT NOT NULL,
  document_id TEXT NOT NULL,   -- book document, e.g. 'kjv-Gen'
  segment_id TEXT,             -- verse segment; null when the ref didn't resolve
  ref TEXT NOT NULL,           -- human ref as printed, e.g. 'Genesis 24:2'
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  end_verse INTEGER,           -- for ranges like 'Exodus 27:1-2'
  confidence TEXT NOT NULL,    -- Wilson's grading: 'a' | 'b' | 'c'
  rationale TEXT NOT NULL,
  position INTEGER NOT NULL,   -- order within the motif entry
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_motif_instances_segment ON motif_instances (segment_id);
CREATE INDEX IF NOT EXISTS idx_motif_instances_doc_ch ON motif_instances (document_id, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_motif_instances_motif ON motif_instances (motif_id);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_anchor_id TEXT NOT NULL,
  target_anchor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  rationale TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

db.exec(DDL);

// Defensive: an anchors table created before the corpus step won't have
// segment_id. Add it in place so existing dev databases keep working.
const anchorCols = (db.prepare("PRAGMA table_info(anchors)").all() as { name: string }[]).map(
  (c) => c.name,
);
if (!anchorCols.includes("segment_id")) {
  db.exec("ALTER TABLE anchors ADD COLUMN segment_id TEXT");
  console.log("[migrate] added anchors.segment_id");
}

// Now that segment_id is guaranteed to exist, index it.
db.exec("CREATE INDEX IF NOT EXISTS idx_anchors_segment ON anchors (segment_id)");

console.log(`[migrate] tables ready at ${DB_PATH}`);
