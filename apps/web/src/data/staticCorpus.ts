import { createDbWorker } from "sql.js-httpvfs";
import type { WorkerHttpvfs } from "sql.js-httpvfs";
import type {
  Anchor,
  BookPassage,
  BookSummary,
  Document,
  Motif,
  MotifDetail,
  MotifInstance,
  OverviewConnection,
  OverviewStructure,
  Parallel,
  PassageMotifInstance,
  Segment,
} from "@typologos/shared";
import { scopeDocumentIds } from "@typologos/shared";
import type { CorpusSource } from "./types";

// In-browser SQLite over HTTP range requests: the published database file is
// a static asset and the WASM engine fetches only the pages each query needs.
// Worker + wasm are copied into public/ by `npm run prepare:static` so the
// bundler stays out of the picture.

const BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env?.BASE_URL ?? "/";
const DB_URL = BASE + "typologos-public.sqlite";
const WORKER_URL = BASE + "sqlite.worker.js";
const WASM_URL = BASE + "sql-wasm.wasm";

let workerPromise: Promise<WorkerHttpvfs> | null = null;

function getWorker(): Promise<WorkerHttpvfs> {
  if (!workerPromise) {
    workerPromise = createDbWorker(
      [
        {
          from: "inline",
          config: {
            serverMode: "full",
            url: DB_URL,
            requestChunkSize: 4096,
          },
        },
      ],
      WORKER_URL,
      WASM_URL,
    );
  }
  return workerPromise;
}

type Row = Record<string, unknown>;

async function query(sql: string, params: unknown[] = []): Promise<Row[]> {
  const worker = await getWorker();
  return (await worker.db.query(sql, params)) as Row[];
}

// --- row mappers (mirror the server's) ---------------------------------------

const toDocument = (r: Row): Document => ({
  id: r.id as string,
  title: r.title as string,
  reference: r.reference as string,
  body: r.body as string,
  source: (r.source as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toSegment = (r: Row): Segment => ({
  id: r.id as string,
  documentId: r.document_id as string,
  parentId: (r.parent_id as string) ?? null,
  kind: r.kind as Segment["kind"],
  ref: r.ref as string,
  chapter: Number(r.chapter),
  verse: r.verse === null ? null : Number(r.verse),
  body: r.body as string,
  position: Number(r.position),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toMotif = (r: Row): Motif => ({
  id: r.id as string,
  headword: r.headword as string,
  source: r.source as string,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toMotifInstance = (r: Row): MotifInstance => ({
  id: r.id as string,
  motifId: r.motif_id as string,
  documentId: r.document_id as string,
  segmentId: (r.segment_id as string) ?? null,
  ref: r.ref as string,
  chapter: Number(r.chapter),
  verse: Number(r.verse),
  endVerse: r.end_verse === null ? null : Number(r.end_verse),
  confidence: r.confidence as MotifInstance["confidence"],
  rationale: r.rationale as string,
  position: Number(r.position),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toParallel = (r: Row): Parallel => ({
  id: r.id as string,
  source: r.source as string,
  title: r.title as string,
  claim: (r.claim as string) ?? null,
  leftDocumentId: r.left_document_id as string,
  leftSegmentId: (r.left_segment_id as string) ?? null,
  leftRef: r.left_ref as string,
  leftQuote: (r.left_quote as string) ?? null,
  rightDocumentId: r.right_document_id as string,
  rightSegmentId: (r.right_segment_id as string) ?? null,
  rightRef: r.right_ref as string,
  rightQuote: (r.right_quote as string) ?? null,
  verification: (r.verification as string) ?? null,
  verdict: (r.verdict as Parallel["verdict"]) ?? "unchecked",
  position: Number(r.position),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

function inClause(n: number): string {
  return Array.from({ length: n }, () => "?").join(",");
}

// --- the adapter --------------------------------------------------------------

export class StaticCorpus implements CorpusSource {
  async fetchBooks(): Promise<BookSummary[]> {
    const rows = await query(
      `SELECT d.id, d.title, d.reference,
              (SELECT COUNT(*) FROM segments s WHERE s.document_id = d.id AND s.kind='chapter') AS chapters
       FROM documents d
       WHERE d.id LIKE 'kjv-%' OR d.id LIKE 'jos-%'
       ORDER BY CASE WHEN d.id LIKE 'kjv-%' THEN 0 ELSE 1 END, d.rowid`,
    );
    return rows.map((r, i) => ({
      id: r.id as string,
      title: r.title as string,
      reference: r.reference as string,
      ordinal: i + 1,
      chapterCount: Number(r.chapters),
    }));
  }

  async fetchBookPassage(documentId: string): Promise<BookPassage> {
    const [docRows, verseRows] = await Promise.all([
      query("SELECT * FROM documents WHERE id = ?", [documentId]),
      query(
        "SELECT * FROM segments WHERE document_id = ? AND kind = 'verse' ORDER BY position",
        [documentId],
      ),
    ]);
    if (docRows.length === 0) throw new Error(`document not found: ${documentId}`);
    // User anchors are merged in by the facade from the UserLayerStore.
    const anchors: Anchor[] = [];
    return { document: toDocument(docRows[0]), verses: verseRows.map(toSegment), anchors };
  }

  async fetchBookMotifs(documentId: string): Promise<PassageMotifInstance[]> {
    const rows = await query(
      `SELECT mi.*, m.headword FROM motif_instances mi
       JOIN motifs m ON m.id = mi.motif_id
       WHERE mi.document_id = ?
       ORDER BY mi.chapter, mi.verse, m.headword`,
      [documentId],
    );
    return rows.map((r) => ({ ...toMotifInstance(r), headword: r.headword as string }));
  }

  async fetchMotifDetail(id: string): Promise<MotifDetail> {
    const [motifRows, instanceRows] = await Promise.all([
      query("SELECT * FROM motifs WHERE id = ?", [id]),
      query(
        `SELECT mi.* FROM motif_instances mi
         JOIN documents d ON d.id = mi.document_id
         WHERE mi.motif_id = ? ORDER BY d.rowid, mi.chapter, mi.verse`,
        [id],
      ),
    ]);
    if (motifRows.length === 0) throw new Error(`motif not found: ${id}`);
    return { motif: toMotif(motifRows[0]), instances: instanceRows.map(toMotifInstance) };
  }

  async fetchParallels(): Promise<Parallel[]> {
    const rows = await query("SELECT * FROM parallels ORDER BY source, position");
    return rows.map(toParallel);
  }

  async fetchOverviewStructure(scope: string): Promise<OverviewStructure> {
    const def = scopeDocumentIds(scope);
    if (!def) throw new Error(`unknown scope: ${scope}`);
    const rows = await query(
      `SELECT document_id, chapter, COUNT(*) AS verses FROM segments
       WHERE kind = 'verse' AND document_id IN (${inClause(def.ids.length)})
       GROUP BY document_id, chapter ORDER BY document_id, chapter`,
      def.ids,
    );
    const titleRows = await query(
      `SELECT id, title FROM documents WHERE id IN (${inClause(def.ids.length)})`,
      def.ids,
    );
    const titles = new Map(titleRows.map((r) => [r.id as string, r.title as string]));

    const byDoc = new Map<string, { chapter: number; verses: number }[]>();
    for (const r of rows) {
      const id = r.document_id as string;
      const list = byDoc.get(id) ?? [];
      list.push({ chapter: Number(r.chapter), verses: Number(r.verses) });
      byDoc.set(id, list);
    }
    let totalVerses = 0;
    const books = def.ids
      .filter((id) => byDoc.has(id))
      .map((id) => {
        const chapters = byDoc.get(id)!;
        totalVerses += chapters.reduce((n, ch) => n + ch.verses, 0);
        return { documentId: id, title: titles.get(id) ?? id, chapters };
      });
    const label = scope.startsWith("book:") ? (titles.get(def.ids[0]) ?? def.label) : def.label;
    return { scope, label, books, totalVerses };
  }

  async fetchOverviewConnections(left: string, right: string): Promise<OverviewConnection[]> {
    const l = scopeDocumentIds(left);
    const r = scopeDocumentIds(right);
    if (!l || !r) throw new Error("unknown scope");
    const leftSet = new Set(l.ids);
    const rightSet = new Set(r.ids);
    const connections: OverviewConnection[] = [];

    const wilsonRows = await query(
      `SELECT a.document_id ld, a.chapter lc, b.document_id rd, b.chapter rc,
              COUNT(DISTINCT a.motif_id) AS n,
              group_concat(DISTINCT m.headword) AS heads
       FROM motif_instances a
       JOIN motif_instances b ON b.motif_id = a.motif_id
       JOIN motifs m ON m.id = a.motif_id
       WHERE a.document_id IN (${inClause(l.ids.length)})
         AND b.document_id IN (${inClause(r.ids.length)})
         AND NOT (a.document_id = b.document_id AND a.chapter = b.chapter)
       GROUP BY a.document_id, a.chapter, b.document_id, b.chapter`,
      [...l.ids, ...r.ids],
    );
    for (const row of wilsonRows) {
      const heads = (row.heads as string).split(",");
      connections.push({
        kind: "wilson",
        leftDocumentId: row.ld as string,
        leftChapter: Number(row.lc),
        rightDocumentId: row.rd as string,
        rightChapter: Number(row.rc),
        weight: Number(row.n),
        label:
          heads.slice(0, 6).join(" · ") + (heads.length > 6 ? ` +${heads.length - 6}` : ""),
      });
    }

    const parRows = await query(
      `SELECT p.title, p.source, ls.document_id ld, ls.chapter lc, rs.document_id rd, rs.chapter rc
       FROM parallels p
       JOIN segments ls ON ls.id = p.left_segment_id
       JOIN segments rs ON rs.id = p.right_segment_id`,
    );
    for (const row of parRows) {
      const ld = row.ld as string;
      const rd = row.rd as string;
      const orientations: [string, number, string, number][] = [];
      if (leftSet.has(ld) && rightSet.has(rd))
        orientations.push([ld, Number(row.lc), rd, Number(row.rc)]);
      if (leftSet.has(rd) && rightSet.has(ld))
        orientations.push([rd, Number(row.rc), ld, Number(row.lc)]);
      for (const [a, ac, b, bc] of orientations) {
        connections.push({
          kind: "parallel",
          source: row.source as string,
          leftDocumentId: a,
          leftChapter: ac,
          rightDocumentId: b,
          rightChapter: bc,
          weight: 1,
          label: row.title as string,
        });
      }
    }
    return connections;
  }
}
