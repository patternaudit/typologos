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
  passageRef: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  kind: AnchorKind;
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
}

// ---- API request payloads ----

export interface CreateAnchorInput {
  documentId: string;
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
