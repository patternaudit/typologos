import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "../db/client.js";

// Imports the 34-step "Flavian Signature" sequence from Joseph Atwill's
// Caesar's Messiah (Flavian Signature Edition) as a `parallels` layer:
// claimed typological pairs between New Testament passages (mostly Luke) and
// Josephus (Wars of the Jews / Life).
//
// Atwill cites Wars as (book, Whiston chapter, Niese paragraph). Our corpus
// segments Whiston sections, so each citation is resolved to the section in
// that chapter whose text best matches Atwill's quoted excerpt.
//
// The extraction (atwill-parallels.json) was parsed from the book's chapter 5
// with per-citation quotes; see docs/night-2026-07-10/LOG.md.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = "atwill-cm";
const NOW = new Date().toISOString();

interface NTRef {
  book: string;
  chapter: number;
  verse: number;
  endVerse: number | null;
  quote: string;
}
interface JosRef {
  work: "war" | "life";
  book?: number;
  chapter?: number;
  niese?: number;
  section?: number;
  nieseRaw?: string;
  quote: string;
}
interface Parallel {
  n: number;
  title: string;
  nt: NTRef[];
  josephus: JosRef[];
}

const NT_OSIS: Record<string, string> = {
  Matthew: "Matt",
  Mark: "Mark",
  Luke: "Luke",
  John: "John",
  Acts: "Acts",
};

function tokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4),
    ),
  ];
}

// Resolve a Wars citation to the Whiston section whose text best contains
// Atwill's quote. His book/Niese numbers are reliable but his chapter numbers
// follow a different edition's chaptering, so we try the cited chapter first
// and fall back to searching the whole book when the match is poor.
function scoreRows(
  rows: { id: string; chapter?: number; verse: number; body: string }[],
  qt: string[],
): { segmentId: string; section: number; chapter?: number; score: number } | null {
  if (rows.length === 0) return null;
  let best = rows[0];
  let bestScore = -1;
  for (const row of rows) {
    const body = row.body.toLowerCase();
    const hits = qt.filter((t) => body.includes(t)).length;
    const score = hits / qt.length;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return { segmentId: best.id, section: best.verse, chapter: best.chapter, score: bestScore };
}

function resolveWarSection(
  book: number,
  chapter: number,
  quote: string,
): { segmentId: string; section: number; chapter: number; score: number } | null {
  const inChapter = db
    .prepare(
      "SELECT id, chapter, verse, body FROM segments WHERE document_id = ? AND kind = 'verse' AND chapter = ? ORDER BY verse",
    )
    .all(`jos-War-${book}`, chapter) as { id: string; chapter: number; verse: number; body: string }[];
  const qt = tokens(quote);
  if (qt.length === 0) {
    const first = inChapter[0];
    return first ? { segmentId: first.id, section: first.verse, chapter, score: 0 } : null;
  }
  const chapterBest = scoreRows(inChapter, qt);
  if (chapterBest && chapterBest.score >= 0.6) {
    return { ...chapterBest, chapter } as ReturnType<typeof resolveWarSection>;
  }
  const inBook = db
    .prepare(
      "SELECT id, chapter, verse, body FROM segments WHERE document_id = ? AND kind = 'verse' ORDER BY chapter, verse",
    )
    .all(`jos-War-${book}`) as { id: string; chapter: number; verse: number; body: string }[];
  const bookBest = scoreRows(inBook, qt);
  const winner = (bookBest?.score ?? -1) > (chapterBest?.score ?? -1) ? bookBest : chapterBest;
  return winner
    ? { segmentId: winner.segmentId, section: winner.section, chapter: winner.chapter ?? chapter, score: winner.score }
    : null;
}

function run() {
  const raw = fs.readFileSync(join(__dirname, "atwill-parallels.json"), "utf-8");
  const parallels = JSON.parse(raw) as Parallel[];

  const segExists = db.prepare("SELECT id FROM segments WHERE id = ? AND kind = 'verse'");
  const insert = db.prepare(
    `INSERT INTO parallels
       (id, source, title, claim,
        left_document_id, left_segment_id, left_ref, left_quote,
        right_document_id, right_segment_id, right_ref, right_quote,
        verification, verdict, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let inserted = 0;
  let lowConfidence = 0;

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM parallels WHERE source = ?").run(SOURCE);

    for (const p of parallels) {
      const nt = p.nt[0];
      const jos = p.josephus.find((j) => j.quote) ?? p.josephus[0];
      if (!nt || !jos) continue;

      const osis = NT_OSIS[nt.book];
      const leftDoc = `kjv-${osis}`;
      const leftSegId = `seg-${leftDoc}-${nt.chapter}-${nt.verse}`;
      const leftSeg = segExists.get(leftSegId) ? leftSegId : null;
      const leftRef =
        `${nt.book} ${nt.chapter}:${nt.verse}` + (nt.endVerse ? `-${nt.endVerse}` : "");

      let rightDoc: string;
      let rightSeg: string | null;
      let rightRef: string;
      let resolutionNote = "";
      if (jos.work === "life") {
        rightDoc = "jos-Life";
        const segId = `seg-jos-Life-1-${jos.section}`;
        rightSeg = segExists.get(segId) ? segId : null;
        rightRef = `Life ${jos.section}`;
        resolutionNote = `cited Life ${jos.section} [Niese ${jos.nieseRaw ?? "?"}]`;
      } else {
        rightDoc = `jos-War-${jos.book}`;
        const resolved = resolveWarSection(jos.book!, jos.chapter!, jos.quote ?? "");
        rightSeg = resolved?.segmentId ?? null;
        rightRef = resolved
          ? `Wars ${jos.book}.${resolved.chapter}.${resolved.section}`
          : `Wars ${jos.book}.${jos.chapter}`;
        resolutionNote =
          `cited Wars ${jos.book},${jos.chapter} [Niese ${jos.niese}]; ` +
          (resolved
            ? `quote-matched to Whiston ${resolved.chapter}.${resolved.section} (score ${resolved.score.toFixed(2)})`
            : "chapter has no sections?");
        if (!resolved || resolved.score < 0.5) lowConfidence++;
      }

      insert.run(
        `par-atwill-${p.n}`,
        SOURCE,
        p.title,
        `Flavian Signature sequence #${p.n} of 34 (Caesar's Messiah ch. 5)`,
        leftDoc,
        leftSeg,
        leftRef,
        nt.quote || null,
        rightDoc,
        rightSeg,
        rightRef,
        jos.quote || null,
        resolutionNote,
        "unchecked",
        p.n,
        NOW,
        NOW,
      );
      inserted++;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  console.log(`[atwill] imported ${inserted} parallels (${lowConfidence} low-confidence section matches)`);
}

run();
