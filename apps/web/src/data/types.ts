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
  OverviewConnection,
  OverviewStructure,
  Parallel,
  PassageMotifInstance,
  UpdateLinkInput,
} from "@typologos/shared";

// Read-only reference data: corpora, motifs, claimed parallels, overview
// aggregations. Implementations: the Hono API, or in-browser SQLite over a
// statically hosted database file.
export interface CorpusSource {
  fetchBooks(): Promise<BookSummary[]>;
  fetchBookPassage(documentId: string): Promise<BookPassage>;
  fetchBookMotifs(documentId: string): Promise<PassageMotifInstance[]>;
  fetchMotifDetail(id: string): Promise<MotifDetail>;
  fetchParallels(): Promise<Parallel[]>;
  fetchOverviewStructure(scope: string): Promise<OverviewStructure>;
  // Wilson + parallel connections; the user-link layer is merged in by the
  // facade from the UserLayerStore.
  fetchOverviewConnections(left: string, right: string): Promise<OverviewConnection[]>;
}

// The user's own layer: anchors and links. Implementations: the Hono API
// (shared server persistence) or IndexedDB (local-first, exportable).
export interface UserLayerStore {
  fetchWorkspace(id: string): Promise<HydratedWorkspace>;
  createAnchor(input: CreateAnchorInput): Promise<Anchor>;
  deleteAnchor(id: string): Promise<void>;
  createLink(input: CreateLinkInput): Promise<Link>;
  updateLink(id: string, input: UpdateLinkInput): Promise<Link>;
  deleteLink(id: string): Promise<void>;
  // Anchors the user has created in a given document (merged into passages).
  anchorsForDocument(documentId: string): Promise<Anchor[]>;
  // Portable layer file (Excalidraw-style share/import).
  exportLayer(): Promise<LayerExport>;
  importLayer(data: LayerExport): Promise<{ anchorsAdded: number; linksAdded: number }>;
}
