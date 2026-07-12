import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "../db/client.js";

// Imports Xenophon's Anabasis (Dakyns translation, Project Gutenberg #1170)
// as the CONTROL corpus for the Luke <-> Anabasis experiment
// (docs/control-experiment.md):
//
//   documents xen-Anab-1 .. xen-Anab-7 (one per book)
//   chapters  = Dakyns' Roman-numeral chapters
//   verses    = Loeb-style sections, recovered from the marginal numbers
//               Dakyns prints flush-right ("...named Artaxerxes, and  1")
//
// Footnote blocks (indented "(n) ..." lines) and inline "(n)" markers are
// stripped; "{...}" transliteration braces are kept as-is.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "..", "data");
const NOW = new Date().toISOString();

const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

interface Section {
  book: number;
  chapter: number;
  section: number;
  text: string;
}

function parse(raw: string): Section[] {
  const startMark = raw.indexOf("*** START OF");
  const endMark = raw.indexOf("*** END OF");
  const body = raw.slice(
    startMark === -1 ? 0 : raw.indexOf("\n", startMark) + 1,
    endMark === -1 ? undefined : endMark,
  );
  const lines = body.split(/\r?\n/);

  const sections: Section[] = [];
  let book = 0;
  let chapter = 0;
  let section = 0;
  let buf: string[] = [];
  let inFootnote = false;

  const flush = () => {
    const text = buf.join(" ").replace(/\s*\(\d+\)/g, "").replace(/\s+/g, " ").trim();
    buf = [];
    if (!text || !book || !chapter) return;
    const prev = sections[sections.length - 1];
    if (prev && prev.book === book && prev.chapter === chapter && prev.section === section) {
      prev.text += " " + text;
    } else {
      sections.push({ book, chapter, section: Math.max(section, 1), text });
    }
  };

  for (const line of lines) {
    const bookMatch = line.match(/^BOOK ([IVX]+)$/);
    if (bookMatch) {
      flush();
      book = ROMAN[bookMatch[1]] ?? 0;
      chapter = 0;
      continue;
    }
    if (!book) continue;
    const chMatch = line.match(/^([IVX]+)\.?$/);
    if (chMatch && ROMAN[chMatch[1]]) {
      flush();
      chapter = ROMAN[chMatch[1]];
      section = 0;
      continue;
    }
    // Indented "(n) ..." lines start a footnote block that runs to the next
    // blank line.
    if (/^\s+\(\d+\)/.test(line)) {
      inFootnote = true;
      continue;
    }
    if (!line.trim()) {
      inFootnote = false;
      // Paragraph break inside a section: keep accumulating (flush happens
      // on section/chapter/book boundaries), but preserve a space.
      continue;
    }
    if (inFootnote) continue;

    // A flush-right marginal number marks where that Loeb section begins.
    const margin = line.match(/^(.*\S)\s{2,}(\d{1,3})$/);
    if (margin && Number(margin[2]) > section) {
      flush();
      section = Number(margin[2]);
      buf.push(margin[1]);
    } else {
      buf.push(margin ? margin[1] : line.trim());
    }
  }
  flush();
  return sections;
}

function run() {
  const path = join(DATA, "anabasis.txt");
  if (!fs.existsSync(path)) {
    console.error("[anabasis] missing source; run: npm run anabasis:download -w @typologos/server");
    process.exit(1);
  }
  const sections = parse(fs.readFileSync(path, "utf-8"));
  const perBook = new Map<number, number>();
  for (const s of sections) perBook.set(s.book, (perBook.get(s.book) ?? 0) + 1);
  console.log(
    `[anabasis] parsed ${sections.length} sections`,
    [...perBook.entries()].map(([b, n]) => `book ${b}: ${n}`).join(", "),
  );

  const insertDoc = db.prepare(
    `INSERT INTO documents (id, title, reference, body, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSegment = db.prepare(
    `INSERT INTO segments (id, document_id, parent_id, kind, ref, chapter, verse, body, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM segments WHERE document_id LIKE 'xen-%'").run();
    db.prepare("DELETE FROM documents WHERE id LIKE 'xen-%'").run();
    for (let b = 1; b <= 7; b++) {
      const docId = `xen-Anab-${b}`;
      const title = `Anabasis ${"I II III IV V VI VII".split(" ")[b - 1]}`;
      insertDoc.run(
        docId,
        title,
        `Xenophon, Anabasis, Book ${b} (Dakyns)`,
        "",
        "Dakyns (Project Gutenberg)",
        NOW,
        NOW,
      );
      let position = 0;
      let lastChapter = -1;
      for (const s of sections.filter((x) => x.book === b)) {
        if (s.chapter !== lastChapter) {
          lastChapter = s.chapter;
          insertSegment.run(
            `seg-${docId}-${s.chapter}`, docId, null, "chapter",
            `${title} ${s.chapter}`, s.chapter, null, "", position++, NOW, NOW,
          );
        }
        insertSegment.run(
          `seg-${docId}-${s.chapter}-${s.section}`, docId, `seg-${docId}-${s.chapter}`,
          "verse", `Anab ${b}.${s.chapter}.${s.section}`, s.chapter, s.section,
          s.text, position++, NOW, NOW,
        );
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  console.log("[anabasis] imported");
}

run();
