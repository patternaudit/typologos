import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "../db/client.js";
import { OSIS_BOOK_NAMES } from "./books.js";

// Imports Walter L. Wilson's "A Dictionary of Bible Types" into the motif
// tables:
//   motifs          = one per dictionary headword (AARON, LAMB, ...)
//   motif_instances = one per confidence-marked verse reference inside an
//                     entry, carrying Wilson's rationale paragraph
//
// The source text is an OCR'd HTML scrape, so parsing is defensive:
//   - noise lines (page URLs, running headers) are stripped
//   - entries are recognized by "HEADWORD — " at line start
//   - references are recognized by `BookName C:V (a|b|c)`; Wilson graded every
//     reference himself, so the marker doubles as our record separator
//   - the e-text's numeric verse codes (e.g. <450403> = book 45 Romans 4:3)
//     recover book numbers the OCR ate ("Corinthians 15:6" -> 1 Corinthians)
//   - every resolved ref must exist as a verse segment in the imported KJV
//     corpus, else it's stored unresolved (segment_id NULL)

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEXT_PATH =
  process.env.WILSON_PATH ??
  join(__dirname, "..", "..", "data", "a-dictionary-of-bible-types-walter-wilson.txt");

const SOURCE = "wilson-dbt";
const NOW = new Date().toISOString();

// --- book name resolution ----------------------------------------------------

// Canonical 66-book order; index+1 is the book number used by the e-text's
// numeric verse codes (01=Genesis ... 39=Malachi, 40=Matthew ... 66=Revelation).
const CANONICAL_66 = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam",
  "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov",
  "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos",
  "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
  "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph",
  "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb",
  "Jas", "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev",
];

// display-name -> osis id (lowercased keys), e.g. "genesis" -> "Gen". OSIS ids
// themselves are also accepted ("hab", "ezek", "1cor") — they double as the
// standard abbreviations Wilson occasionally uses.
const NAME_TO_OSIS = new Map<string, string>();
for (const [osis, name] of Object.entries(OSIS_BOOK_NAMES)) {
  NAME_TO_OSIS.set(name.toLowerCase(), osis);
  NAME_TO_OSIS.set(osis.toLowerCase(), osis);
}

// Wilson / OCR variants beyond the canonical display names. Extend as the
// import report surfaces new residuals.
const BOOK_VARIANTS: Record<string, string> = {
  psalm: "Ps",
  psalms: "Ps",
  pgalm: "Ps",
  psgalm: "Ps",
  proverb: "Prov",
  canticles: "Song",
  // "Song of Sol." / a line-broken "... Solomon 4:12"
  sol: "Song",
  solomon: "Song",
  revelations: "Rev",
  // frequent OCR misreads (I->T, l->1, rn->m, etc.)
  tsaiah: "Isa",
  isaian: "Isa",
  lsaiah: "Isa",
  saiah: "Isa",
  ezekial: "Ezek",
  galatian: "Gal",
  ephesian: "Eph",
  colossian: "Col",
  philippian: "Phil",
  romans: "Rom",
  roman: "Rom",
  hebrew: "Heb",
  mathew: "Matt",
  mattthew: "Matt",
  marks: "Mark",
  johns: "John",
  genesis: "Gen",
};

// Families where the book name is meaningless without its leading number. When
// the OCR ate the digit we try to recover it from the numeric verse code.
const NUMBERED_FAMILIES: Record<string, string[]> = {
  samuel: ["1Sam", "2Sam"],
  kings: ["1Kgs", "2Kgs"],
  chronicles: ["1Chr", "2Chr"],
  corinthians: ["1Cor", "2Cor"],
  thessalonians: ["1Thess", "2Thess"],
  timothy: ["1Tim", "2Tim"],
  peter: ["1Pet", "2Pet"],
};

// Roman numerals plus the OCR's favorite disguises for "1".
const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", "|": "1", l: "1" };

function resolveBook(
  numPrefix: string | undefined,
  rawName: string,
  code: string | undefined,
): string | null {
  const name = rawName.toLowerCase().replace(/\.$/, "");
  const prefix = numPrefix ? (ROMAN[numPrefix.toLowerCase()] ?? numPrefix) : undefined;

  if (prefix) {
    const withNum = `${prefix} ${name}`;
    const osis = NAME_TO_OSIS.get(withNum) ?? BOOK_VARIANTS[withNum];
    if (osis) return osis;
    // "1 John" style didn't match a variant: try osis id directly ("1John")
    const compact = NAME_TO_OSIS.get(withNum.replace(" ", ""));
    if (compact) return compact;
  }

  // Bare "John" is the gospel; other numbered families need the code.
  const family = NUMBERED_FAMILIES[name];
  if (family && !prefix) {
    const fromCode = bookFromCode(code);
    if (fromCode && family.includes(fromCode)) return fromCode;
    return null;
  }

  const direct = NAME_TO_OSIS.get(name) ?? BOOK_VARIANTS[name];
  if (direct) return direct;

  // Last resort: a clean numeric code whose book number names a book that
  // loosely matches the OCR'd token (same first or last few letters).
  const fromCode = bookFromCode(code);
  if (fromCode) {
    const canonical = OSIS_BOOK_NAMES[fromCode].toLowerCase();
    if (similar(name, canonical)) return fromCode;
  }
  return null;
}

// Numeric codes look like <450403> = book 45, chapter 04, verse 03 (chapter
// can be 3 digits for Psalms: <19119011>-style codes exist but are rare and
// garbled; we only trust 6-8 digit codes for their leading book number).
function bookFromCode(code: string | undefined): string | null {
  if (!code) return null;
  const digits = code.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 8) return null;
  const n = Number(digits.slice(0, 2));
  if (n < 1 || n > 66) return null;
  return CANONICAL_66[n - 1];
}

function similar(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.slice(-4) === b.slice(-4) || a.slice(0, 4) === b.slice(0, 4);
}

// --- text preprocessing -------------------------------------------------------

const NOISE_LINE = [
  /^\s*http:\/\//,
  /^\s*A Dictionary of Bibles? Types\s*$/i,
  /^\s*<?-?\s*Previous\s+First\s+Next\s*-?>?\s*\d*\s*$/i, // page navigation
  /^\s*\d{1,4}\s*$/, // standalone page numbers
  /^\s*[eo0O)( ._\-]+\s*$/, // OCR'd bullet/TOC junk lines
];

// Index-page line signatures. The book's topical/descriptive indexes come in
// two flavors, both interleaved into entries at page breaks:
//   - a line ending in a graded ref with no prose after it ("<2s0704> Hosea
//     7:4 (a)", "Lily of the Valleys Song of Sol. 2:1 (c)")
//   - a bare headword line ("Bride", "Cake not turned")
// Real entry pages are dominated by prose lines instead.
const REF_END_LINE = /\([abc]\)\s*$/;
const HEADWORDISH_LINE = /^\s*[A-Z][A-Za-z'’ \-()]{0,34}\s*$/;

// The scrape interleaves the book's topical-index pages into the middle of
// dictionary entries at page breaks. Detect them per page (page = chunk
// between page-URL lines) and drop them wholesale — which also reunites the
// entry text the index page interrupted.
function isIndexPage(page: string): boolean {
  const lines = page.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const refEnds = lines.filter((l) => REF_END_LINE.test(l)).length;
  const headwords = lines.filter(
    (l) => HEADWORDISH_LINE.test(l) && !REF_END_LINE.test(l),
  ).length;
  const prose = lines.filter((l) => l.trim().length > 60 && /[a-z].*[a-z]/.test(l)).length;
  if (refEnds >= 4 && prose <= 2) return true;
  return refEnds >= 1 && refEnds + headwords >= 4 && prose <= 1;
}

function loadEntryText(): string {
  const raw = fs.readFileSync(TEXT_PATH, "utf-8");
  const pages = raw.split(/^\s*http:\/\/.*$/m);
  const indexPages = pages.filter(isIndexPage);
  console.log(`[wilson] dropped ${indexPages.length} interleaved topical-index pages`);
  const kept = pages.filter((p) => !isIndexPage(p)).join("\n");

  const lines = kept.split(/\r?\n/).filter((l) => !NOISE_LINE.some((re) => re.test(l)));
  const text = lines.join("\n");
  // Entries begin at the first real headword; everything before (bookmarks
  // TOC, introduction, lessons) is skipped.
  const start = text.search(/^AARON\s+—/m);
  if (start === -1) throw new Error("could not find first entry (AARON) in Wilson text");
  return text.slice(start);
}

// --- parsing ------------------------------------------------------------------

// Headword line: ALL-CAPS word(s), optionally a parenthetical, then an em dash.
// e.g. "AARON — ...", "ALABASTER BOX — ...", "BOW (rainbow) — ..."
const HEAD_RE = /^([A-Z][A-Z'’.\-]*(?:[ -][A-Z()'’a-zé.\-]+){0,4})\s+—/gm;

// One confidence-marked reference. Optional leading e-text code, optional book
// number (arabic or roman), book name (possibly "Song of Solomon"), C:V, an
// optional verse range, then Wilson's (a)/(b)/(c) grade.
// The book-number prefix accepts OCR stand-ins for "1": "|", "I", "l".
const REF_RE =
  /(?:[<«(]([\w]{3,12})[>»).]?\s*)?(?:(?<=[\s>»).])([123]|III|II|I|\||l)\s+)?([A-Z][A-Za-z]{2,15}?(?:\s+of\s+Solomon)?)\.?\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*\(([abc])\)/g;

interface ParsedRef {
  osis: string | null;
  rawBook: string;
  chapter: number;
  verse: number;
  endVerse: number | null;
  confidence: "a" | "b" | "c";
  rationale: string;
}

interface ParsedEntry {
  headword: string;
  refs: ParsedRef[];
}

function titleCase(headword: string): string {
  return headword
    .toLowerCase()
    .replace(/(^|[\s\-(])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseEntries(text: string, unmatchedBooks: Map<string, number>): ParsedEntry[] {
  // Split into entries on headword positions.
  const heads: { headword: string; start: number; bodyStart: number }[] = [];
  for (const m of text.matchAll(HEAD_RE)) {
    heads.push({ headword: m[1], start: m.index, bodyStart: m.index + m[0].length });
  }

  const entries: ParsedEntry[] = [];
  heads.forEach((h, i) => {
    const body = text.slice(h.bodyStart, i + 1 < heads.length ? heads[i + 1].start : undefined);

    const matches = [...body.matchAll(REF_RE)];
    const refs: ParsedRef[] = [];
    matches.forEach((m, j) => {
      const [, code, numPrefix, rawBook, ch, v, endV, conf] = m;
      const rationaleRaw = body.slice(
        m.index + m[0].length,
        j + 1 < matches.length ? matches[j + 1].index : undefined,
      );
      // Index rows that share a page with real entry text: the grade marker
      // ends its line and the next line is another index row (bare ref or
      // headword), not rationale prose. Real refs start their rationale on the
      // marker's own line.
      const sameLine = rationaleRaw.slice(0, rationaleRaw.indexOf("\n"));
      if (/^\s*$/.test(sameLine)) {
        const nextLine =
          rationaleRaw
            .split("\n")
            .slice(1)
            .find((l) => l.trim().length > 0) ?? "";
        if (REF_END_LINE.test(nextLine) || HEADWORDISH_LINE.test(nextLine)) return;
      }
      const osis = resolveBook(numPrefix, rawBook, code);
      if (!osis) {
        const key = `${numPrefix ? numPrefix + " " : ""}${rawBook}`;
        unmatchedBooks.set(key, (unmatchedBooks.get(key) ?? 0) + 1);
      }
      refs.push({
        osis,
        rawBook,
        chapter: Number(ch),
        verse: Number(v),
        endVerse: endV ? Number(endV) : null,
        confidence: conf as ParsedRef["confidence"],
        rationale: clean(rationaleRaw),
      });
    });

    entries.push({ headword: titleCase(clean(h.headword)), refs });
  });
  return entries;
}

// --- import -------------------------------------------------------------------

function run() {
  if (!fs.existsSync(TEXT_PATH)) {
    console.error(`[wilson] source text not found at ${TEXT_PATH}`);
    process.exit(1);
  }

  console.log(`[wilson] reading ${TEXT_PATH}`);
  const unmatchedBooks = new Map<string, number>();
  const entries = parseEntries(loadEntryText(), unmatchedBooks);
  const totalRefs = entries.reduce((n, e) => n + e.refs.length, 0);
  console.log(`[wilson] parsed ${entries.length} entries, ${totalRefs} graded references`);

  const verseExists = db.prepare(
    "SELECT id FROM segments WHERE id = ? AND kind = 'verse'",
  );
  const insertMotif = db.prepare(
    `INSERT INTO motifs (id, headword, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertInstance = db.prepare(
    `INSERT INTO motif_instances
       (id, motif_id, document_id, segment_id, ref, chapter, verse, end_verse,
        confidence, rationale, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let motifCount = 0;
  let resolved = 0;
  let unresolvedVerse = 0;
  let skippedBook = 0;
  let skippedNoRationale = 0;
  let emptyEntries = 0;

  db.exec("BEGIN");
  try {
    // Idempotent: replace any prior Wilson import wholesale.
    db.prepare(
      "DELETE FROM motif_instances WHERE motif_id IN (SELECT id FROM motifs WHERE source = ?)",
    ).run(SOURCE);
    db.prepare("DELETE FROM motifs WHERE source = ?").run(SOURCE);

    const usedIds = new Set<string>();
    for (const entry of entries) {
      const identified = entry.refs.filter((r) => r.osis !== null);
      skippedBook += entry.refs.length - identified.length;
      // Every genuine dictionary reference carries a prose rationale; a graded
      // ref without one is topical-index leakage.
      const usable = identified.filter((r) => r.rationale.length >= 20);
      skippedNoRationale += identified.length - usable.length;
      if (usable.length === 0) {
        emptyEntries++;
        continue;
      }

      const slugBase =
        "motif-wilson-" +
        (entry.headword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
          "entry");
      let slug = slugBase;
      for (let n = 2; usedIds.has(slug); n++) slug = `${slugBase}-${n}`;
      usedIds.add(slug);

      insertMotif.run(slug, entry.headword, SOURCE, NOW, NOW);
      motifCount++;

      usable.forEach((r, idx) => {
        const documentId = `kjv-${r.osis}`;
        const segmentId = `seg-${documentId}-${r.chapter}-${r.verse}`;
        const exists = verseExists.get(segmentId) !== undefined;
        if (exists) resolved++;
        else unresolvedVerse++;

        const bookTitle = OSIS_BOOK_NAMES[r.osis!] ?? r.osis!;
        const ref =
          `${bookTitle} ${r.chapter}:${r.verse}` + (r.endVerse ? `-${r.endVerse}` : "");

        insertInstance.run(
          `${slug}-${idx + 1}`,
          slug,
          documentId,
          exists ? segmentId : null,
          ref,
          r.chapter,
          r.verse,
          r.endVerse,
          r.confidence,
          r.rationale,
          idx,
          NOW,
          NOW,
        );
      });
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  console.log(`[wilson] imported ${motifCount} motifs (${emptyEntries} entries had no usable refs)`);
  console.log(
    `[wilson] instances: ${resolved} resolved to verse segments, ${unresolvedVerse} kept unresolved (verse not in corpus)`,
  );
  console.log(`[wilson] skipped refs (book unidentifiable): ${skippedBook}`);
  console.log(`[wilson] skipped refs (no rationale — index leakage): ${skippedNoRationale}`);

  if (unmatchedBooks.size > 0) {
    const top = [...unmatchedBooks.entries()].sort((x, y) => y[1] - x[1]).slice(0, 25);
    console.log("[wilson] top unmatched book tokens (add variants to fix):");
    for (const [token, count] of top) console.log(`    ${count}\t${token}`);
  }
}

run();
