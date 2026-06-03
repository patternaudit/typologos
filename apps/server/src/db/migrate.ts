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
  passage_ref TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  selected_text TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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
console.log(`[migrate] tables ready at ${DB_PATH}`);
