import type {
  Anchor,
  BookPassage,
  BookSummary,
  CreateAnchorInput,
  CreateLinkInput,
  HydratedWorkspace,
  LayerExport,
  Link,
  MotifDetail,
  MotifSummary,
  OverviewConnection,
  OverviewStructure,
  Parallel,
  PassageMotifInstance,
  UpdateLinkInput,
} from "@typologos/shared";
import { scopeDocumentIds } from "@typologos/shared";
import { ApiCorpus, ApiUserStore } from "./apiBackend";
import { StaticCorpus } from "./staticCorpus";
import { IdbUserStore } from "./idbStore";
import type { CorpusSource, UserLayerStore } from "./types";

// The data facade: one import for the whole app, backed by a swappable
// (CorpusSource, UserLayerStore) pair.
//   VITE_DATA_BACKEND=api    -> Hono server for both (default; dev setup)
//   VITE_DATA_BACKEND=static -> in-browser SQLite over a static file +
//                               IndexedDB for the user's own layer

export const dataMode: "api" | "static" =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DATA_BACKEND ??
    "api") === "static"
    ? "static"
    : "api";

const WORKSPACE_ID = "ws-demo";

const corpus: CorpusSource = dataMode === "static" ? new StaticCorpus() : new ApiCorpus();
const user: UserLayerStore =
  dataMode === "static" ? new IdbUserStore() : new ApiUserStore(WORKSPACE_ID);

// --- corpus reads -------------------------------------------------------------

export const fetchBooks = (): Promise<BookSummary[]> => corpus.fetchBooks();
export const fetchBookMotifs = (id: string): Promise<PassageMotifInstance[]> =>
  corpus.fetchBookMotifs(id);
export const fetchMotifDetail = (id: string): Promise<MotifDetail> =>
  corpus.fetchMotifDetail(id);
export const fetchMotifIndex = (): Promise<MotifSummary[]> => corpus.fetchMotifIndex();
export const fetchParallels = (): Promise<Parallel[]> => corpus.fetchParallels();
export const fetchOverviewStructure = (scope: string): Promise<OverviewStructure> =>
  corpus.fetchOverviewStructure(scope);

export async function fetchBookPassage(documentId: string): Promise<BookPassage> {
  const passage = await corpus.fetchBookPassage(documentId);
  // In static mode the corpus file carries no user data; merge the local
  // layer's anchors for this document.
  const userAnchors = await user.anchorsForDocument(documentId);
  return userAnchors.length
    ? { ...passage, anchors: [...passage.anchors, ...userAnchors] }
    : passage;
}

export async function fetchOverviewConnections(
  left: string,
  right: string,
): Promise<OverviewConnection[]> {
  const connections = await corpus.fetchOverviewConnections(left, right);
  if (dataMode !== "static") return connections; // server already includes links
  // Merge the local layer's links as chapter-pair connections.
  const l = scopeDocumentIds(left);
  const r = scopeDocumentIds(right);
  if (!l || !r) return connections;
  const leftSet = new Set(l.ids);
  const rightSet = new Set(r.ids);
  const layer = await user.exportLayer();
  const anchorsById = new Map(layer.anchors.map((a) => [a.id, a]));
  const chapterOf = (a: Anchor | undefined): { doc: string; ch: number } | null => {
    if (!a?.segmentId) return null;
    const m = a.segmentId.match(/^seg-(.+)-(\d+)-(\d+)$/);
    return m ? { doc: m[1], ch: Number(m[2]) } : null;
  };
  for (const link of layer.links) {
    const s = chapterOf(anchorsById.get(link.sourceAnchorId));
    const t = chapterOf(anchorsById.get(link.targetAnchorId));
    if (!s || !t) continue;
    const orientations: [typeof s, typeof t][] = [];
    if (leftSet.has(s.doc) && rightSet.has(t.doc)) orientations.push([s, t]);
    if (leftSet.has(t.doc) && rightSet.has(s.doc)) orientations.push([t, s]);
    for (const [a, b] of orientations) {
      connections.push({
        kind: "link",
        leftDocumentId: a.doc,
        leftChapter: a.ch,
        rightDocumentId: b.doc,
        rightChapter: b.ch,
        weight: 1,
        label: link.title || link.type,
      });
    }
  }
  return connections;
}

// --- user layer ---------------------------------------------------------------

export const fetchWorkspace = (id: string): Promise<HydratedWorkspace> =>
  user.fetchWorkspace(id);
export const createAnchor = (input: CreateAnchorInput): Promise<Anchor> =>
  user.createAnchor(input);
export const deleteAnchor = (id: string): Promise<void> => user.deleteAnchor(id);
export const createLink = (input: CreateLinkInput): Promise<Link> => user.createLink(input);
export const updateLink = (id: string, input: UpdateLinkInput): Promise<Link> =>
  user.updateLink(id, input);
export const deleteLink = (id: string): Promise<void> => user.deleteLink(id);

// --- loading stats (static mode streams the corpus on demand) -----------------

export async function getLoadStats(): Promise<{
  fetchedBytes: number;
  totalBytes: number;
  requests: number;
} | null> {
  if (dataMode !== "static") return null;
  const { staticLoadStats } = await import("./staticCorpus");
  return staticLoadStats();
}

// --- portable layer file (Excalidraw-style) -----------------------------------

export async function exportLayerToFile(): Promise<void> {
  const layer = await user.exportLayer();
  const blob = new Blob([JSON.stringify(layer, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `typologos-layer-${layer.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLayerFromFile(
  file: File,
): Promise<{ anchorsAdded: number; linksAdded: number }> {
  const text = await file.text();
  const data = JSON.parse(text) as LayerExport;
  return user.importLayer(data);
}
