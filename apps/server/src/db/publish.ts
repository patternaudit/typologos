import fs from "node:fs";
import { createHash } from "node:crypto";
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
// The filename carries a content hash: GitHub Pages caches with max-age=600,
// so an unversioned name lets a browser mix cached chunks of the previous
// database with a fresh manifest — "database disk image is malformed".
const MANIFEST = join(OUT_DIR, "typologos-db.json");
const TMP = join(OUT_DIR, "typologos-public.sqlite.tmp");

// Wilson's commentary ships by default (deliberate choice: published with a
// takedown-on-complaint policy, contact path on the About page). Pass
// --strip-rationales for a facts-only build.
const stripRationales = process.argv.includes("--strip-rationales");

// Checkpoint the source WAL so the copy is complete.
{
  const src = new DatabaseSync(SRC);
  src.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  src.close();
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.rmSync(TMP, { force: true });
fs.copyFileSync(SRC, TMP);

const db = new DatabaseSync(TMP);
db.exec("PRAGMA journal_mode = DELETE;");

if (stripRationales) {
  db.exec("UPDATE motif_instances SET rationale = '';");
  console.log("[publish] Wilson rationales stripped (facts-only build)");
} else {
  console.log("[publish] Wilson commentary included (takedown-on-complaint policy)");
}

// Precompute the Wilson chapter-pair aggregation: the overview's heaviest
// query, identical for every visitor. In-browser it took ~40s cold; as an
// indexed read it's instant.
db.exec(`
  CREATE TABLE wilson_chapter_pairs AS
  SELECT a.document_id AS l_doc, a.chapter AS l_ch,
         b.document_id AS r_doc, b.chapter AS r_ch,
         COUNT(DISTINCT a.motif_id) AS n,
         group_concat(DISTINCT m.headword) AS heads
  FROM motif_instances a
  JOIN motif_instances b ON b.motif_id = a.motif_id
  JOIN motifs m ON m.id = a.motif_id
  WHERE NOT (a.document_id = b.document_id AND a.chapter = b.chapter)
  GROUP BY 1, 2, 3, 4;
`);
db.exec("CREATE INDEX idx_wcp_docs ON wilson_chapter_pairs (l_doc, r_doc);");

// Chapter/verse counts for overview strips and the book list — otherwise the
// browser scans every verse row (bodies included) just to count them.
db.exec(`
  CREATE TABLE chapter_verse_counts AS
  SELECT document_id, chapter, COUNT(*) AS verses
  FROM segments WHERE kind = 'verse' GROUP BY document_id, chapter;
`);
db.exec("CREATE INDEX idx_cvc_doc ON chapter_verse_counts (document_id);");
const pairCount = (
  db.prepare("SELECT COUNT(*) c FROM wilson_chapter_pairs").get() as { c: number }
).c;
console.log(`[publish] precomputed ${pairCount} wilson chapter pairs`);

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

const bytes = fs.readFileSync(TMP);
const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
const prefix = `typologos-public-${hash}.sqlite.`;
const OUT = join(OUT_DIR, prefix + "0");
fs.renameSync(TMP, OUT);
const size = bytes.length;
fs.writeFileSync(
  MANIFEST,
  JSON.stringify(
    {
      serverMode: "chunked",
      urlPrefix: prefix,
      serverChunkSize: size,
      databaseLengthBytes: size,
      suffixLength: 1,
      requestChunkSize: 4096,
    },
    null,
    1,
  ),
);
// Keep the previous database alongside the new one (a manifest cached for up
// to 10 minutes still resolves); prune anything older, plus legacy names.
const versions = fs
  .readdirSync(OUT_DIR)
  .filter((f) => /^typologos-public.*\.sqlite(\.0)?$/.test(f) && f !== prefix + "0")
  .map((f) => ({ f, mtime: fs.statSync(join(OUT_DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);
for (const v of versions.slice(1)) {
  fs.rmSync(join(OUT_DIR, v.f));
  console.log(`[publish] pruned old version ${v.f}`);
}
console.log(`[publish] wrote ${OUT} (${(size / 1024 / 1024).toFixed(1)} MB) + manifest`);
