import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Single local SQLite file. We use Node's built-in `node:sqlite` (stable in
// Node 22+) — zero native build steps, which matters on bleeding-edge Node
// where better-sqlite3 prebuilds don't yet exist.
export const DB_PATH = process.env.TYPOLOGOS_DB ?? join(__dirname, "..", "..", "typologos.sqlite");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
