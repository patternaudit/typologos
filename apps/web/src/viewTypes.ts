import type { Anchor } from "@typologos/shared";

// What a pane is currently showing: either a legacy standalone document, or a
// windowed corpus passage (one chapter, optionally narrowed to a verse range).
export type PaneView =
  | { mode: "document"; documentId: string }
  | {
      mode: "passage";
      bookId: string;
      chapter: number;
      startVerse: number | null;
      endVerse: number | null;
    };

// One measured text region rendered in a pane.
export interface Block {
  key: string; // unique within the pane (segment id, or document id)
  segmentId: string | null; // anchor target (null for legacy document bodies)
  documentId: string; // anchor target document (book id, or legacy doc id)
  passageRef: string; // e.g. "John 3:16" or "Genesis 22:1–19"
  verseLabel?: string; // small leading verse number, for corpus verses
  body: string;
  anchors: Anchor[]; // anchors whose offsets are into THIS block's body
}

export interface PaneData {
  title: string;
  reference: string;
  blocks: Block[];
}

// A resolved text selection ready to become an anchor.
export interface PendingSelection {
  segmentId: string | null;
  documentId: string;
  passageRef: string;
  start: number;
  end: number;
  text: string;
}
