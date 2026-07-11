import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Produces the PUBLIC database for the static build:
//   - Wilson rationale prose stripped (his 1957 text is likely still under
//     copyright; headwords, refs, and grades are facts and stay)
//   - user layer stripped (anchors/links/workspaces) — visitors bring their
//     own via IndexedDB
//   - legacy demo documents removed (corpus + reference layers only)
//   - vacuumed to 4KB pages, non-WAL, for HTTP-range access efficiency
//
// Output: apps/web/public/typologos-public.sqlite
// Pass --keep-rationales for a personal (non-publishable) full build.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "typologos.sqlite");
const OUT_DIR = join(__dirname, "..", "..", "..", "web", "public");
// Served as a single-chunk "chunked" database: the manifest carries the byte
// length, so the browser never needs a HEAD request (GitHub Pages gzips
// octet-streams for browsers, which hides the true Content-Length).
const OUT = join(OUT_DIR, "typologos-public.sqlite.0");
const MANIFEST = join(OUT_DIR, "typologos-db.json");
const TMP = OUT + ".tmp";

const keepRationales = process.argv.includes("--keep-rationales");

// Checkpoint the source WAL so the copy is complete.
{
  const src = new DatabaseSync(SRC);
  src.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  src.close();
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.rmSync(TMP, { force: true });
fs.rmSync(OUT, { force: true });
fs.copyFileSync(SRC, TMP);

const db = new DatabaseSync(TMP);
db.exec("PRAGMA journal_mode = DELETE;");

if (!keepRationales) {
  db.exec("UPDATE motif_instances SET rationale = '';");
  console.log("[publish] Wilson rationales stripped (facts retained)");
} else {
  console.log("[publish] --keep-rationales: full Wilson prose retained (do NOT publish)");
}

db.exec("DELETE FROM anchors;");
db.exec("DELETE FROM links;");
db.exec("DELETE FROM workspaces;");
db.exec("DELETE FROM workspace_panes;");
db.exec("DELETE FROM documents WHERE id NOT LIKE 'kjv-%' AND id NOT LIKE 'jos-%';");
db.exec(
  "DELETE FROM segments WHERE document_id NOT LIKE 'kjv-%' AND document_id NOT LIKE 'jos-%';",
);
console.log("[publish] user layer and legacy demo documents stripped");

db.exec("PRAGMA page_size = 4096;");
db.exec("VACUUM;");
db.close();

fs.renameSync(TMP, OUT);
const size = fs.statSync(OUT).size;
fs.writeFileSync(
  MANIFEST,
  JSON.stringify(
    {
      serverMode: "chunked",
      urlPrefix: "typologos-public.sqlite.",
      serverChunkSize: size,
      databaseLengthBytes: size,
      suffixLength: 1,
      requestChunkSize: 4096,
    },
    null,
    1,
  ),
);
// Drop the old single-file name if present (pre-manifest layout).
fs.rmSync(join(OUT_DIR, "typologos-public.sqlite"), { force: true });
console.log(`[publish] wrote ${OUT} (${(size / 1024 / 1024).toFixed(1)} MB) + manifest`);
