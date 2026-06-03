import { useMemo, useRef } from "react";
import type { HydratedPane, Anchor } from "@typologos/shared";
import { getSelectionOffsets, type SelectionOffsets } from "../hooks/useTextSelection";

interface Segment {
  start: number;
  end: number;
  anchor?: Anchor;
}

// Slice `body` into ordered segments: plain text runs and anchor runs. Anchors
// are taken in start order; any anchor that overlaps an already-placed one is
// skipped (keeps segmentation trivial for the MVP).
function buildSegments(body: string, anchors: Anchor[]): Segment[] {
  const sorted = [...anchors].sort((a, b) => a.startOffset - b.startOffset);
  const segments: Segment[] = [];
  let pos = 0;
  for (const anchor of sorted) {
    if (anchor.startOffset < pos) continue; // overlapping — skip
    if (anchor.startOffset > pos) {
      segments.push({ start: pos, end: anchor.startOffset });
    }
    segments.push({ start: anchor.startOffset, end: anchor.endOffset, anchor });
    pos = anchor.endOffset;
  }
  if (pos < body.length) segments.push({ start: pos, end: body.length });
  return segments;
}

interface PassagePaneProps {
  pane: HydratedPane;
  draftSourceId: string | null;
  draftTargetId: string | null;
  selectedLinkAnchorIds: Set<string>;
  linkedAnchorIds: Set<string>;
  onSelectionChange: (selection: SelectionOffsets | null) => void;
  onAnchorClick: (anchor: Anchor) => void;
}

export function PassagePane({
  pane,
  draftSourceId,
  draftTargetId,
  selectedLinkAnchorIds,
  linkedAnchorIds,
  onSelectionChange,
  onAnchorClick,
}: PassagePaneProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const { document: doc, anchors } = pane;

  const segments = useMemo(() => buildSegments(doc.body, anchors), [doc.body, anchors]);

  const handleMouseUp = () => {
    const el = bodyRef.current;
    if (!el) return;
    onSelectionChange(getSelectionOffsets(el, doc.body));
  };

  return (
    <div className="pane" data-side={pane.side}>
      <div className="pane-header">
        <div className="pane-title">{doc.title}</div>
        <div className="pane-reference">{doc.reference}</div>
      </div>
      <div className="pane-scroll">
        <div className="pane-body" ref={bodyRef} onMouseUp={handleMouseUp}>
          {segments.map((seg) => {
            const text = doc.body.slice(seg.start, seg.end);
            if (!seg.anchor) {
              return <span key={seg.start}>{text}</span>;
            }
            const id = seg.anchor.id;
            const classes = ["anchor"];
            if (linkedAnchorIds.has(id)) classes.push("anchor-linked");
            if (selectedLinkAnchorIds.has(id)) classes.push("anchor-selected");
            if (id === draftSourceId) classes.push("anchor-draft-source");
            if (id === draftTargetId) classes.push("anchor-draft-target");
            return (
              <span
                key={seg.start}
                className={classes.join(" ")}
                data-anchor-id={id}
                onMouseDown={(e) => {
                  // Don't start a text selection when picking an existing anchor.
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAnchorClick(seg.anchor!);
                }}
                title={seg.anchor.passageRef}
              >
                {text}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
