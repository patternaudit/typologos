import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sax from "sax";
import { db } from "../db/client.js";
import { bookName } from "./books.js";

// Converts the KJV OSIS XML into the structured corpus model:
//   documents  = books        (id "kjv-<osisId>", body left empty — we never
//                              render a whole book)
//   segments   = chapters + verses
//
// Verse text is the long-term anchor target: anchors point at a verse segment
// with offsets local to that verse's body.

const __dirname = dirname(fileURLToPath(import.meta.url));
const OSIS_PATH =
  process.env.OSIS_PATH ?? join(__dirname, "..", "..", "data", "eng-kjv.osis.xml");

const NOW = new Date().toISOString();

interface ParsedVerse {
  book: string; // osis id
  chapter: number;
  verse: number;
  text: string;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseOsis(xml: string): { bookOrder: string[]; verses: ParsedVerse[] } {
  const parser = sax.parser(false, { lowercase: true });
  const bookOrder: string[] = [];
  const verses: ParsedVerse[] = [];

  let currentBook: string | null = null;
  let currentChapter = 0;
  let currentVerse: number | null = null;
  let buffer = "";

  parser.onopentag = (node) => {
    const a = node.attributes as Record<string, string>;
    switch (node.name) {
      case "div":
        if (a.type === "book" && a.osisid) {
          currentBook = a.osisid;
          bookOrder.push(a.osisid);
        }
        break;
      case "chapter":
        if (a.sid) currentChapter = Number(a.n);
        else if (a.eid) currentChapter = 0;
        break;
      case "verse":
        if (a.sid) {
          currentVerse = Number(a.n);
          buffer = "";
        } else if (a.eid) {
          if (currentBook && currentVerse !== null) {
            verses.push({
              book: currentBook,
              chapter: currentChapter,
              verse: currentVerse,
              text: clean(buffer),
            });
          }
          currentVerse = null;
          buffer = "";
        }
        break;
    }
  };

  parser.ontext = (t) => {
    if (currentVerse !== null) buffer += t;
  };

  parser.write(xml).close();
  return { bookOrder, verses };
}

function run() {
  if (!fs.existsSync(OSIS_PATH)) {
    console.error(`[corpus] OSIS file not found at ${OSIS_PATH}`);
    console.error("[corpus] download it first, e.g.:");
    console.error(
      "  curl -sL -o apps/server/data/eng-kjv.osis.xml https://raw.githubusercontent.com/seven1m/open-bibles/master/eng-kjv.osis.xml",
    );
    process.exit(1);
  }

  console.log(`[corpus] reading ${OSIS_PATH}`);
  const xml = fs.readFileSync(OSIS_PATH, "utf-8");
  const { bookOrder, verses } = parseOsis(xml);
  console.log(`[corpus] parsed ${bookOrder.length} books, ${verses.length} verses`);

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
    // Idempotent: clear any prior KJV corpus (segment ids are deterministic, so
    // user anchors that target them survive a re-import).
    db.prepare("DELETE FROM segments WHERE document_id LIKE 'kjv-%'").run();
    db.prepare("DELETE FROM documents WHERE id LIKE 'kjv-%'").run();

    bookOrder.forEach((osisId, index) => {
      const docId = `kjv-${osisId}`;
      const name = bookName(osisId);
      insertDoc.run(docId, name, `${name} (KJV)`, "", "KJV", NOW, NOW);

      const bookVerses = verses.filter((v) => v.book === osisId);
      let position = 0;
      let lastChapter = -1;
      for (const v of bookVerses) {
        if (v.chapter !== lastChapter) {
          lastChapter = v.chapter;
          const chapterId = `seg-${docId}-${v.chapter}`;
          insertSegment.run(
            chapterId,
            docId,
            null,
            "chapter",
            `${name} ${v.chapter}`,
            v.chapter,
            null,
            "",
            position++,
            NOW,
            NOW,
          );
        }
        const chapterId = `seg-${docId}-${v.chapter}`;
        const verseId = `${chapterId}-${v.verse}`;
        insertSegment.run(
          verseId,
          docId,
          chapterId,
          "verse",
          `${name} ${v.chapter}:${v.verse}`,
          v.chapter,
          v.verse,
          v.text,
          position++,
          NOW,
          NOW,
        );
      }
      void index;
    });

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const docCount = (db.prepare("SELECT COUNT(*) c FROM documents WHERE id LIKE 'kjv-%'").get() as {
    c: number;
  }).c;
  const segCount = (db.prepare("SELECT COUNT(*) c FROM segments").get() as { c: number }).c;
  console.log(`[corpus] imported ${docCount} book documents, ${segCount} segments`);
}

run();
