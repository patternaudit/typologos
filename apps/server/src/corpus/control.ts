import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "../db/client.js";

// Imports the control-experiment layer (docs/control-experiment.md):
// Luke <-> Anabasis candidates mined under the pre-registered rules, graded
// with the same verdict standard as the Atwill layer. Reads
// control-anabasis.json (committed beside this file once grading is done).
//
// Idempotent: replaces all 'control-anabasis' parallels on each run.

const __dirname = dirname(fileURLToPath(import.meta.url));
const NOW = new Date().toISOString();

interface ControlRow {
  position: number;
  title: string;
  claim: string;
  lukeRef: string; // "Luke 5:1-11"
  anabRef: string; // "Anab 2.5.24"
  lukeQuote: string;
  anabQuote: string;
  verdict: "supported" | "partial" | "unsupported";
  verification: string;
}

function lukeSegment(ref: string): { docId: string; segId: string | null } {
  const m = ref.match(/^Luke (\d+):(\d+)/);
  if (!m) return { docId: "kjv-Luke", segId: null };
  return { docId: "kjv-Luke", segId: `seg-kjv-Luke-${m[1]}-${m[2]}` };
}

function anabSegment(ref: string): { docId: string; segId: string | null } {
  const m = ref.match(/^Anab (\d)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`bad anabRef: ${ref}`);
  const docId = `xen-Anab-${m[1]}`;
  return { docId, segId: `seg-${docId}-${m[2]}-${m[3]}` };
}

function run() {
  const path = join(__dirname, "control-anabasis.json");
  if (!fs.existsSync(path)) {
    console.error("[control] control-anabasis.json not found (grading not committed yet)");
    process.exit(1);
  }
  const rows: ControlRow[] = JSON.parse(fs.readFileSync(path, "utf-8"));

  const segExists = db.prepare("SELECT 1 FROM segments WHERE id = ?");
  const insert = db.prepare(
    `INSERT INTO parallels (id, source, title, claim, left_document_id, left_segment_id,
       left_ref, left_quote, right_document_id, right_segment_id, right_ref, right_quote,
       verification, verdict, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM parallels WHERE source = 'control-anabasis'").run();
    for (const r of rows) {
      const left = lukeSegment(r.lukeRef);
      const right = anabSegment(r.anabRef);
      for (const seg of [left.segId, right.segId]) {
        if (seg && !segExists.get(seg)) throw new Error(`segment missing: ${seg} (${r.title})`);
      }
      insert.run(
        `par-control-${r.position}`,
        "control-anabasis",
        r.title,
        r.claim,
        left.docId,
        left.segId,
        r.lukeRef,
        r.lukeQuote,
        right.docId,
        right.segId,
        r.anabRef,
        r.anabQuote,
        r.verification,
        r.verdict,
        r.position,
        NOW,
        NOW,
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  console.log(`[control] imported ${rows.length} control parallels`);
}

run();
