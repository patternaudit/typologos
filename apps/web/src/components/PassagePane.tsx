import { Fragment, useEffect, useRef, useState } from "react";
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
  // Verse segments to keep softly lit (the open parallel's full range;
  // fades in and settles).
  highlightSegments: Set<string>;
  // Transient highlight (hovering an arc or a parallel's text): instant.
  hoverHighlightSegments: Set<string>;
  // Segments that belong to some parallel's range (hover to illuminate it).
  parallelSegments: Map<string, string[]>;
  onParallelHover: (segmentId: string | null) => void;
  // Block key to scroll into view (and briefly flash) once rendered.
  scrollTargetKey: string | null;
  // This pane's pending text selection and staged draft anchor, for the
  // floating action bar.
  selection: PendingSelection | null;
  draftAnchor: Anchor | null;
  draftLabel: string; // "Source" | "Target"
  busy: boolean;
  onCreateAnchor: () => void;
  onClearDraft: () => void;
  onDeleteDraftAnchor: () => void;
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
  highlightSegments,
  hoverHighlightSegments,
  parallelSegments,
  onParallelHover,
  scrollTargetKey,
  selection,
  draftAnchor,
  draftLabel,
  busy,
  onCreateAnchor,
  onClearDraft,
  onDeleteDraftAnchor,
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
    scrollIntoViewSensibly(el, "center");
    // The flash settles to a faint persistent tint (a breadcrumb of where you
    // landed) instead of fading to nothing; a new target clears the old one.
    rootRef.current
      .querySelectorAll(".verse-flash")
      .forEach((old) => old !== el && old.classList.remove("verse-flash"));
    el.classList.add("verse-flash");
    onScrollTargetDone();
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

  // Smooth-scroll short hops; jump instantly across long distances (a smooth
  // 35,000px animation takes seconds and paints blank frames).
  const scrollIntoViewSensibly = (el: Element, block: ScrollLogicalPosition) => {
    const scroller = el.closest(".pane-scroll");
    const distance =
      scroller instanceof HTMLElement
        ? Math.abs(
            el.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
          )
        : 0;
    el.scrollIntoView({ behavior: distance > 2500 ? "auto" : "smooth", block });
  };

  const scrollToChapter = (chapter: number) => {
    const el = rootRef.current?.querySelector(`[data-chapter-heading="${chapter}"]`);
    if (el) scrollIntoViewSensibly(el, "start");
  };

  const renderBlock = (block: Block) => {
    const segments = buildSegments(block.body, block.anchors);
    const blockMotifs = block.segmentId ? motifsBySegment.get(block.segmentId) ?? [] : [];
    const annotated = blockMotifs.length > 0;
    const lit = block.segmentId !== null && highlightSegments.has(block.segmentId);
    const hoverLit =
      !lit && block.segmentId !== null && hoverHighlightSegments.has(block.segmentId);
    const inParallel = block.segmentId !== null && parallelSegments.has(block.segmentId);
    const interactive = annotated || inParallel;
    const verseBlock = (
      <div className={`block ${block.verseLabel ? "verse-block" : "doc-block"}`} key={block.key}>
        {block.verseLabel && <sup className="verse-num">{block.verseLabel}</sup>}
        <span
          className={`block-text ${annotated ? "has-motifs" : ""} ${lit ? "range-lit" : ""} ${hoverLit ? "range-lit-hover" : ""}`}
          data-block-key={block.key}
          onMouseEnter={
            interactive
              ? (e) => {
                  if (annotated) setTip({ x: e.clientX, y: e.clientY, motifs: blockMotifs });
                  if (inParallel) onParallelHover(block.segmentId);
                }
              : undefined
          }
          onMouseMove={
            annotated
              ? (e) => setTip({ x: e.clientX, y: e.clientY, motifs: blockMotifs })
              : undefined
          }
          onMouseLeave={
            interactive
              ? () => {
                  if (annotated) setTip(null);
                  if (inParallel) onParallelHover(null);
                }
              : undefined
          }
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
    if (block.chapterStart == null) return verseBlock;
    // First verse of a chapter: break the inline flow with a chapter heading
    // (also the scroll target for the navigator's chapter picker).
    return (
      <Fragment key={`ch-${block.key}`}>
        <div className="chapter-heading" data-chapter-heading={block.chapterStart}>
          {block.chapterStart}
        </div>
        {verseBlock}
      </Fragment>
    );
  };

  return (
    <div className="pane" data-side={side}>
      <div className="pane-header">
        <div className="pane-heading">
          <div className="pane-title">{data.title}</div>
          <div className="pane-reference">{data.reference}</div>
        </div>
        <Navigator
          books={books}
          view={view}
          onNavigate={onNavigate}
          onScrollToChapter={scrollToChapter}
        />
      </div>
      <div className="pane-scroll">
        <div className="pane-body" ref={rootRef} onMouseUp={handleMouseUp}>
          {data.blocks.map(renderBlock)}
        </div>
      </div>

      {/* Floating action bar: appears where the work happens. */}
      {(selection || draftAnchor) && (
        <div className="pane-actionbar">
          {draftAnchor && (
            <span className="draft-chip" title={draftAnchor.selectedText}>
              <span className="draft-chip-label">{draftLabel}</span>
              <span className="draft-chip-text">
                “{draftAnchor.selectedText.slice(0, 32)}
                {draftAnchor.selectedText.length > 32 ? "…" : ""}”
              </span>
              <button
                className="chip-button"
                title="Unselect"
                disabled={busy}
                onClick={onClearDraft}
              >
                ✕
              </button>
              <button
                className="chip-button chip-danger"
                title="Delete this anchor"
                disabled={busy}
                onClick={onDeleteDraftAnchor}
              >
                🗑
              </button>
            </span>
          )}
          {selection && (
            <button
              className="primary small"
              disabled={busy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCreateAnchor}
              title={`“${selection.text.slice(0, 60)}”`}
            >
              + Anchor “{selection.text.slice(0, 20)}
              {selection.text.length > 20 ? "…" : ""}”
            </button>
          )}
        </div>
      )}
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
