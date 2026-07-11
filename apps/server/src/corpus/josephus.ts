import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "../db/client.js";

// Imports Whiston's Josephus (Project Gutenberg plain text) into the corpus:
//
//   Wars of the Jews  -> documents jos-War-1 .. jos-War-7 (one per book),
//                        chapters = Whiston chapters, verses = Whiston
//                        sections ("1.", "2.", ... paragraphs)
//   Life of Josephus  -> document jos-Life, one chapter, verses = Whiston's
//                        numbered sections 1..76
//
// Atwill's Caesar's Messiah cites Wars as (book, Whiston chapter, Niese
// paragraph); the atwill importer resolves the Niese number to one of these
// section segments by matching his quoted text.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "..", "data");
const NOW = new Date().toISOString();

const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18,
  XIX: 19, XX: 20,
};
const ROMANS = Object.keys(ROMAN);

interface Section {
  book: number; // 1..7 for Wars; 1 for Life
  chapter: number;
  section: number;
  text: string;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripGutenberg(raw: string): string {
  const start = raw.indexOf("*** START OF THE PROJECT GUTENBERG EBOOK");
  const end = raw.indexOf("*** END OF THE PROJECT GUTENBERG EBOOK");
  let body = raw.slice(start === -1 ? 0 : raw.indexOf("\n", start) + 1, end === -1 ? undefined : end);
  // Whiston's footnotes are bracketed blocks on their own lines; drop inline
  // footnote markers but keep the text readable.
  return body;
}

function parseWars(raw: string): Section[] {
  const text = stripGutenberg(raw);
  let lines = text.split(/\r?\n/);
  // Skip the table of contents: it repeats the BOOK/CHAPTER headings (with
  // numbered chapter summaries in Antiquities). The body starts at the
  // second "BOOK I." heading when one exists.
  const bookOneAt = lines.reduce<number[]>((acc, l, i) => {
    if (/^BOOK I\.(\s|$)/.test(l)) acc.push(i);
    return acc;
  }, []);
  if (bookOneAt.length > 1) lines = lines.slice(bookOneAt[1]);
  const sections: Section[] = [];
  let book = 0;
  let chapter = 0;
  let current: Section | null = null;

  const flush = () => {
    if (current) {
      current.text = clean(current.text);
      if (current.text) sections.push(current);
      current = null;
    }
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // Wars: bare "BOOK I." / "CHAPTER 1." headings. Antiquities: same tokens
    // with the chapter title trailing on the line (also repeated in a TOC,
    // which is harmless — TOC entries carry no section paragraphs).
    const bookM = line.match(/^BOOK ([IVX]+)\.(\s|$)/);
    if (bookM && ROMAN[bookM[1]]) {
      flush();
      book = ROMAN[bookM[1]];
      chapter = 0;
      continue;
    }
    const chapM = line.match(/^CHAPTER (\d+)\.(\s|$)/);
    if (chapM && book > 0) {
      flush();
      chapter = Number(chapM[1]);
      continue;
    }
    if (book === 0 || chapter === 0) continue; // preface material
    const secM = line.match(/^(\d+)\.\s+(.*)$/);
    if (secM) {
      // Sections run 1, 2, 3… within a chapter. The Gutenberg text has
      // occasional defects we recover from:
      //  - a malformed section number (accept a gap of one),
      //  - a missing CHAPTER heading (a restart at 1 mid-chapter, validated
      //    by a following "2." line, starts the next chapter),
      // while endnote blocks (non-sequential numbers, "sect."/"B." refs)
      // stay body text.
      const n = Number(secM[1]);
      const expected: number = current ? (current as Section).section + 1 : 1;
      const isFootnotey = /\bsect\.|\bch\. \d|\bB\. [IVX]/.test(secM[2]);
      if (!isFootnotey && (n === expected || n === expected + 1)) {
        flush();
        current = { book, chapter, section: n, text: secM[2] };
        continue;
      }
      if (!isFootnotey && n === 1 && current && current.section >= 2) {
        // Probable missing chapter heading. Two guards against list noise:
        // a sequential "2." must follow before the next heading, and the next
        // real CHAPTER heading must NOT be chapter+1 (if it is, this heading
        // isn't missing — the restart is an in-text enumeration).
        const ahead = lines.slice(li + 1, li + 80);
        const twoAt = ahead.findIndex((l) => /^2\.\s+\S/.test(l));
        const breakAt = ahead.findIndex((l) => /^(CHAPTER|BOOK) /.test(l));
        let nextHeadingIsSequential = false;
        for (let lj = li + 1; lj < lines.length; lj++) {
          const hm = lines[lj].match(/^CHAPTER (\d+)\.(\s|$)/);
          if (hm) {
            nextHeadingIsSequential = Number(hm[1]) === chapter + 1;
            break;
          }
          if (/^BOOK [IVX]+\.(\s|$)/.test(lines[lj])) break;
        }
        if (twoAt !== -1 && (breakAt === -1 || twoAt < breakAt) && !nextHeadingIsSequential) {
          flush();
          chapter += 1;
          current = { book, chapter, section: 1, text: secM[2] };
          continue;
        }
      }
    }
    if (current) current.text += " " + line;
  }
  flush();
  return sections;
}

function parseLife(raw: string): Section[] {
  const text = stripGutenberg(raw);
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section | null = null;
  const flush = () => {
    if (current) {
      current.text = clean(current.text);
      if (current.text) sections.push(current);
      current = null;
    }
  };
  for (const line of lines) {
    const secM = line.match(/^(\d+)\.\s+(.*)$/);
    if (secM) {
      const n = Number(secM[1]);
      const expected: number = current ? (current as Section).section + 1 : 1;
      if (n === expected) {
        flush();
        current = { book: 1, chapter: 1, section: n, text: secM[2] };
        continue;
      }
    }
    if (current) current.text += " " + line;
  }
  flush();
  return sections;
}

function importDocument(
  docId: string,
  title: string,
  reference: string,
  sections: Section[],
  refFor: (s: Section) => string,
) {
  const insertDoc = db.prepare(
    `INSERT INTO documents (id, title, reference, body, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSegment = db.prepare(
    `INSERT INTO segments (id, document_id, parent_id, kind, ref, chapter, verse, body, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertDoc.run(docId, title, reference, "", "Whiston (Project Gutenberg)", NOW, NOW);
  let position = 0;
  let lastChapter = -1;
  for (const s of sections) {
    if (s.chapter !== lastChapter) {
      lastChapter = s.chapter;
      insertSegment.run(
        `seg-${docId}-${s.chapter}`,
        docId,
        null,
        "chapter",
        `${title} ${s.chapter}`,
        s.chapter,
        null,
        "",
        position++,
        NOW,
        NOW,
      );
    }
    insertSegment.run(
      `seg-${docId}-${s.chapter}-${s.section}`,
      docId,
      `seg-${docId}-${s.chapter}`,
      "verse",
      refFor(s),
      s.chapter,
      s.section,
      s.text,
      position++,
      NOW,
      NOW,
    );
  }
}

function run() {
  const warsPath = join(DATA, "josephus-wars.txt");
  const lifePath = join(DATA, "josephus-life.txt");
  const antPath = join(DATA, "josephus-antiquities.txt");
  if (!fs.existsSync(warsPath) || !fs.existsSync(lifePath) || !fs.existsSync(antPath)) {
    console.error("[josephus] missing source texts; download first:");
    console.error("  curl -fsSL -o apps/server/data/josephus-wars.txt https://www.gutenberg.org/cache/epub/2850/pg2850.txt");
    console.error("  curl -fsSL -o apps/server/data/josephus-life.txt https://www.gutenberg.org/cache/epub/2846/pg2846.txt");
    console.error("  curl -fsSL -o apps/server/data/josephus-antiquities.txt https://www.gutenberg.org/cache/epub/2848/pg2848.txt");
    process.exit(1);
  }

  const wars = parseWars(fs.readFileSync(warsPath, "utf-8"));
  const life = parseLife(fs.readFileSync(lifePath, "utf-8"));
  const ant = parseWars(fs.readFileSync(antPath, "utf-8"));
  console.log(
    `[josephus] parsed Wars: ${wars.length} sections; Life: ${life.length}; Antiquities: ${ant.length}`,
  );

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM segments WHERE document_id LIKE 'jos-%'").run();
    db.prepare("DELETE FROM documents WHERE id LIKE 'jos-%'").run();

    for (let b = 1; b <= 7; b++) {
      importDocument(
        `jos-War-${b}`,
        `Wars of the Jews ${ROMANS[b - 1]}`,
        `Wars of the Jews, Book ${ROMANS[b - 1]} (Whiston)`,
        wars.filter((s) => s.book === b),
        (s) => `Wars ${b}.${s.chapter}.${s.section}`,
      );
    }
    for (let b = 1; b <= 20; b++) {
      importDocument(
        `jos-Ant-${b}`,
        `Antiquities ${ROMANS[b - 1]}`,
        `Antiquities of the Jews, Book ${ROMANS[b - 1]} (Whiston)`,
        ant.filter((s) => s.book === b),
        (s) => `Ant ${b}.${s.chapter}.${s.section}`,
      );
    }
    importDocument(
      "jos-Life",
      "Life of Josephus",
      "The Life of Flavius Josephus (Whiston)",
      life,
      (s) => `Life ${s.section}`,
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const segCount = (
    db.prepare("SELECT COUNT(*) c FROM segments WHERE document_id LIKE 'jos-%'").get() as {
      c: number;
    }
  ).c;
  console.log(`[josephus] imported 28 documents, ${segCount} segments`);
}

run();
