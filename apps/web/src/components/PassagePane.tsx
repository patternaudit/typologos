import { useEffect, useRef, useState } from "react";
import type { Anchor, BookSummary, PassageMotifInstance } from "@typologos/shared";
import { getSelectionOffsets } from "../hooks/useTextSelection";
import type { Block, PaneData, PaneView, PendingSelection } from "../viewTypes";
import { Navigator } from "./Navigator";

interface Segment {
  start: number;
  end: number;
  anchor?: Anchor;
}

// Slice a block body into ordered plain/anchor segments. Anchors are taken in
// start order; any that overlaps an already-placed one is skipped.
function buildSegments(body: string, anchors: Anchor[]): Segment[] {
  const sorted = [...anchors].sort((a, b) => a.startOffset - b.startOffset);
  const segments: Segment[] = [];
  let pos = 0;
  for (const anchor of sorted) {
    if (anchor.startOffset < pos) continue;
    if (anchor.startOffset > pos) segments.push({ start: pos, end: anchor.startOffset });
    segments.push({ start: anchor.startOffset, end: anchor.endOffset, anchor });
    pos = anchor.endOffset;
  }
  if (pos < body.length) segments.push({ start: pos, end: body.length });
  return segments;
}

interface PassagePaneProps {
  side: "left" | "right";
  data: PaneData;
  view: PaneView;
  books: BookSummary[];
  draftSourceId: string | null;
  draftTargetId: string | null;
  selectedLinkAnchorIds: Set<string>;
  linkedAnchorIds: Set<string>;
  motifsBySegment: Map<string, PassageMotifInstance[]>;
  // Block key to scroll into view (and briefly flash) once rendered.
  scrollTargetKey: string | null;
  onScrollTargetDone: () => void;
  onNavigate: (view: PaneView) => void;
  onSelectionChange: (selection: PendingSelection | null) => void;
  onAnchorClick: (anchor: Anchor) => void;
  onMotifVerseClick: (block: Block) => void;
}

export function PassagePane({
  side,
  data,
  view,
  books,
  draftSourceId,
  draftTargetId,
  selectedLinkAnchorIds,
  linkedAnchorIds,
  motifsBySegment,
  scrollTargetKey,
  onScrollTargetDone,
  onNavigate,
  onSelectionChange,
  onAnchorClick,
  onMotifVerseClick,
}: PassagePaneProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Instant styled tooltip for annotated verses (native title is too slow and
  // can't be formatted). Follows the cursor; pointer-events: none in CSS.
  const [tip, setTip] = useState<{ x: number; y: number; motifs: PassageMotifInstance[] } | null>(
    null,
  );

  // Once the target verse block exists in the DOM, center it and flash it.
  useEffect(() => {
    if (!scrollTargetKey || !rootRef.current) return;
    const el = rootRef.current.querySelector(`[data-block-key="${scrollTargetKey}"]`);
    if (!(el instanceof HTMLElement)) return; // not rendered yet; retry next render
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("verse-flash");
    const timer = setTimeout(() => el.classList.remove("verse-flash"), 2400);
    onScrollTargetDone();
    return () => clearTimeout(timer);
  }, [scrollTargetKey, data, onScrollTargetDone]);

  const handleMouseUp = () => {
    const root = rootRef.current;
    if (!root) return;
    const sel = getSelectionOffsets(root);
    if (!sel) {
      onSelectionChange(null);
      return;
    }
    const block = data.blocks.find((b) => b.key === sel.blockKey);
    if (!block) {
      onSelectionChange(null);
      return;
    }
    onSelectionChange({
      segmentId: block.segmentId,
      documentId: block.documentId,
      passageRef: block.passageRef,
      start: sel.start,
      end: sel.end,
      text: sel.text,
    });
  };

  const renderBlock = (block: Block) => {
    const segments = buildSegments(block.body, block.anchors);
    const blockMotifs = block.segmentId ? motifsBySegment.get(block.segmentId) ?? [] : [];
    const annotated = blockMotifs.length > 0;
    return (
      <div className={`block ${block.verseLabel ? "verse-block" : "doc-block"}`} key={block.key}>
        {block.verseLabel && <sup className="verse-num">{block.verseLabel}</sup>}
        <span
          className={`block-text ${annotated ? "has-motifs" : ""}`}
          data-block-key={block.key}
          onMouseEnter={
            annotated
              ? (e) => setTip({ x: e.clientX, y: e.clientY, motifs: blockMotifs })
              : undefined
          }
          onMouseMove={
            annotated
              ? (e) => setTip({ x: e.clientX, y: e.clientY, motifs: blockMotifs })
              : undefined
          }
          onMouseLeave={annotated ? () => setTip(null) : undefined}
          onClick={
            annotated
              ? () => {
                  // A drag-selection also ends in a click; only a plain click
                  // (no selected text) opens the drawer.
                  const sel = window.getSelection();
                  if (sel && !sel.isCollapsed) return;
                  setTip(null);
                  onMotifVerseClick(block);
                }
              : undefined
          }
        >
          {segments.map((seg) => {
            const text = block.body.slice(seg.start, seg.end);
            if (!seg.anchor) return <span key={seg.start}>{text}</span>;
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
                onMouseDown={(e) => e.preventDefault()}
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
        </span>{" "}
      </div>
    );
  };

  return (
    <div className="pane" data-side={side}>
      <div className="pane-header">
        <div className="pane-heading">
          <div className="pane-title">{data.title}</div>
          <div className="pane-reference">{data.reference}</div>
        </div>
        <Navigator books={books} view={view} onNavigate={onNavigate} />
      </div>
      <div className="pane-scroll">
        <div className="pane-body" ref={rootRef} onMouseUp={handleMouseUp}>
          {data.blocks.map(renderBlock)}
        </div>
      </div>
      {tip && (
        <div
          className="motif-tooltip"
          style={{
            left: Math.min(tip.x + 14, window.innerWidth - 190),
            top: tip.y + 18,
          }}
        >
          {tip.motifs.map((m) => (
            <div className="motif-tooltip-row" key={m.id}>
              <span className="motif-tooltip-word">{m.headword}</span>
              <span className="motif-tooltip-grade">({m.confidence})</span>
            </div>
          ))}
          <div className="motif-tooltip-hint">click for details</div>
        </div>
      )}
    </div>
  );
}
