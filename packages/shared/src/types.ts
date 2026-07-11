// Shared domain types for Typologos.
// Kept intentionally small: one anchor kind, a fixed set of relationship types.

export type AnchorKind = "text_span";

export type RelationshipType =
  | "typology"
  | "quotation"
  | "allusion"
  | "parallel"
  | "contrast"
  | "historical_context";

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "typology",
  "quotation",
  "allusion",
  "parallel",
  "contrast",
  "historical_context",
];

export interface Document {
  id: string;
  title: string;
  reference: string;
  body: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Anchor {
  id: string;
  documentId: string;
  // For corpus passages, the anchor targets a segment and offsets are local to
  // that segment's body. For legacy standalone documents this is null and
  // offsets are into document.body.
  segmentId: string | null;
  passageRef: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  kind: AnchorKind;
  createdAt: string;
  updatedAt: string;
}

export type SegmentKind = "chapter" | "verse";

export interface Segment {
  id: string;
  documentId: string; // the book document
  parentId: string | null; // chapter id for verses; null for chapters
  kind: SegmentKind;
  ref: string; // e.g. "John 3" or "John 3:16"
  chapter: number;
  verse: number | null; // null for chapter segments
  body: string;
  position: number; // ordering within the document
  createdAt: string;
  updatedAt: string;
}

export interface Link {
  id: string;
  workspaceId: string;
  sourceAnchorId: string;
  targetAnchorId: string;
  type: RelationshipType;
  title: string | null;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaneSide = "left" | "right";

export interface HydratedPane {
  side: PaneSide;
  document: Document;
  anchors: Anchor[];
}

export interface HydratedWorkspace {
  workspace: Workspace;
  panes: HydratedPane[];
  links: Link[];
  // Every anchor referenced by the workspace's links, resolved — so the
  // inspector can show source/target text even when an anchor isn't currently
  // rendered in a pane.
  linkAnchors: Anchor[];
}

// ---- corpus navigation ----

export interface BookSummary {
  id: string; // document id, e.g. "kjv-John"
  title: string; // "John"
  reference: string; // "John (KJV)"
  ordinal: number; // canonical order
  chapterCount: number;
}

export interface PassageWindow {
  document: Document; // the book
  chapter: number;
  startVerse: number | null;
  endVerse: number | null;
  verses: Segment[]; // verse segments in the window
  anchors: Anchor[]; // anchors targeting those segments
}

// A whole book, for continuously scrolling panes: every verse segment in
// order plus all segment-anchored anchors in the book.
export interface BookPassage {
  document: Document;
  verses: Segment[];
  anchors: Anchor[];
}

// ---- motifs (imported typology reference data, e.g. Wilson's dictionary) ----

// Wilson's own confidence grading: (a) pure types identified as such by
// Scripture, (b) evident from usage, (c) suggestive/devotional.
export type MotifConfidence = "a" | "b" | "c";

export interface Motif {
  id: string;
  headword: string; // e.g. "Lamb"
  source: string; // e.g. "wilson-dbt"
  createdAt: string;
  updatedAt: string;
}

export interface MotifInstance {
  id: string;
  motifId: string;
  documentId: string; // book document, e.g. "kjv-Gen"
  segmentId: string | null; // verse segment; null when the ref didn't resolve
  ref: string; // e.g. "Genesis 24:2"
  chapter: number;
  verse: number;
  endVerse: number | null;
  confidence: MotifConfidence;
  rationale: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// A motif instance joined with its motif's headword, as returned per passage
// window.
export interface PassageMotifInstance extends MotifInstance {
  headword: string;
}

export interface MotifDetail {
  motif: Motif;
  instances: MotifInstance[];
}

// Compact motif listing for the Index view.
export interface MotifSummary {
  id: string;
  headword: string;
  source: string;
  instanceCount: number;
}

// ---- claimed parallels (imported sources, e.g. Atwill's Caesar's Messiah) ----

export type ParallelVerdict = "supported" | "partial" | "unsupported" | "unchecked";

export interface Parallel {
  id: string;
  source: string; // e.g. "atwill-cm"
  title: string;
  claim: string | null;
  leftDocumentId: string; // NT side
  leftSegmentId: string | null;
  leftRef: string;
  leftQuote: string | null;
  rightDocumentId: string; // Josephus side
  rightSegmentId: string | null;
  rightRef: string;
  rightQuote: string | null;
  verification: string | null;
  verdict: ParallelVerdict;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ---- scopes (ordered document shelves) ----

// Canonical protestant divisions; index+1 is canonical order. Shared because
// both the server API and the in-browser SQLite backend resolve scopes.
export const OT_OSIS = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam",
  "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov",
  "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos",
  "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
];
export const NT_OSIS = [
  "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph",
  "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb",
  "Jas", "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev",
];

export function scopeDocumentIds(scope: string): { label: string; ids: string[] } | null {
  if (scope === "ot") return { label: "Old Testament", ids: OT_OSIS.map((b) => `kjv-${b}`) };
  if (scope === "nt") return { label: "New Testament", ids: NT_OSIS.map((b) => `kjv-${b}`) };
  if (scope === "bible")
    return { label: "Bible (KJV)", ids: [...OT_OSIS, ...NT_OSIS].map((b) => `kjv-${b}`) };
  if (scope === "wars")
    return { label: "Wars of the Jews", ids: [1, 2, 3, 4, 5, 6, 7].map((n) => `jos-War-${n}`) };
  if (scope === "antiquities")
    return {
      label: "Antiquities of the Jews",
      ids: Array.from({ length: 20 }, (_, i) => `jos-Ant-${i + 1}`),
    };
  if (scope === "josephus")
    return {
      label: "Josephus",
      ids: [
        ...[1, 2, 3, 4, 5, 6, 7].map((n) => `jos-War-${n}`),
        ...Array.from({ length: 20 }, (_, i) => `jos-Ant-${i + 1}`),
        "jos-Life",
      ],
    };
  if (scope.startsWith("book:")) return { label: scope.slice(5), ids: [scope.slice(5)] };
  return null;
}

// ---- layer export (Excalidraw-style portable user layer) ----

export interface LayerExport {
  app: "typologos";
  version: 1;
  exportedAt: string;
  anchors: Anchor[];
  links: Link[];
}

// ---- overview (whole-scope connection map) ----

// A scope is an ordered shelf of documents: "bible", "ot", "nt", "josephus",
// "wars", or "book:<documentId>".
export type ScopeId = string;

export interface ScopeChapter {
  chapter: number;
  verses: number; // verse count, for proportional layout
}

export interface ScopeBook {
  documentId: string;
  title: string;
  chapters: ScopeChapter[];
}

export interface OverviewStructure {
  scope: ScopeId;
  label: string;
  books: ScopeBook[];
  totalVerses: number;
}

// One chapter-pair connection between the two scopes, aggregated.
export interface OverviewConnection {
  kind: "wilson" | "parallel" | "link";
  source?: string; // provenance for parallels (e.g. "atwill-cm", "mason-dependence")
  leftDocumentId: string;
  leftChapter: number;
  rightDocumentId: string;
  rightChapter: number;
  weight: number; // shared-motif count (wilson) or 1
  label: string; // hover text: motif names / parallel title / link title
}

// ---- API request payloads ----

export interface CreateAnchorInput {
  documentId: string;
  segmentId?: string | null;
  passageRef: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  kind?: AnchorKind;
}

export interface CreateLinkInput {
  workspaceId: string;
  sourceAnchorId: string;
  targetAnchorId: string;
  type: RelationshipType;
  title?: string | null;
  rationale?: string | null;
}

export interface UpdateLinkInput {
  type?: RelationshipType;
  title?: string | null;
  rationale?: string | null;
}
