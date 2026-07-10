import { useEffect, useState, type RefObject } from "react";
import type { PaneSide } from "@typologos/shared";

export interface LocalRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type AnchorRects = Record<string, LocalRect>;

export interface WorkspaceRects {
  // [data-anchor-id] highlight spans (user anchors), by anchor id.
  anchors: AnchorRects;
  // Annotated verse blocks (.block-text.has-motifs), by block key (segment
  // id), per pane side.
  blocks: Record<PaneSide, AnchorRects>;
  // Each pane's scroll viewport, for visibility culling.
  panes: Record<PaneSide, LocalRect | null>;
}

const EMPTY: WorkspaceRects = {
  anchors: {},
  blocks: { left: {}, right: {} },
  panes: { left: null, right: null },
};

// Measures anchors, annotated verse blocks, and pane viewports inside
// `containerRef`, in coordinates local to the container, and keeps them fresh
// on scroll / resize / layout changes. `version` is bumped by the caller when
// content changes so we re-measure after the DOM updates.
export function useAnchorRects(
  containerRef: RefObject<HTMLElement>,
  version: number,
): WorkspaceRects {
  const [rects, setRects] = useState<WorkspaceRects>(EMPTY);

  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastFingerprint = "";

    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const cbox = container.getBoundingClientRect();
      const local = (r: DOMRect): LocalRect => ({
        left: r.left - cbox.left,
        top: r.top - cbox.top,
        right: r.right - cbox.left,
        bottom: r.bottom - cbox.top,
        width: r.width,
        height: r.height,
      });

      const anchors: AnchorRects = {};
      container.querySelectorAll<HTMLElement>("[data-anchor-id]").forEach((el) => {
        const id = el.getAttribute("data-anchor-id");
        if (id) anchors[id] = local(el.getBoundingClientRect());
      });

      const blocks: WorkspaceRects["blocks"] = { left: {}, right: {} };
      const panes: WorkspaceRects["panes"] = { left: null, right: null };
      (["left", "right"] as PaneSide[]).forEach((side) => {
        const pane = container.querySelector<HTMLElement>(
          `.pane[data-side="${side}"] .pane-scroll`,
        );
        if (!pane) return;
        panes[side] = local(pane.getBoundingClientRect());
        container
          .querySelectorAll<HTMLElement>(
            `.pane[data-side="${side}"] .block-text.has-motifs`,
          )
          .forEach((el) => {
            const key = el.getAttribute("data-block-key");
            if (key) blocks[side][key] = local(el.getBoundingClientRect());
          });
      });

      // Only publish when something moved — the poll below would otherwise
      // force a re-render every tick.
      const next = { anchors, blocks, panes };
      const fingerprint = JSON.stringify(next);
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;
      setRects(next);
    };

    // rAF coalesces bursts of scroll events, but Chrome starves rAF entirely
    // in occluded/background windows — the timeout guarantees measurement
    // still happens there.
    const schedule = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      raf = requestAnimationFrame(() => {
        clearTimeout(timer);
        measure();
      });
      timer = setTimeout(measure, 150);
    };

    schedule();
    window.addEventListener("resize", schedule);
    // capture=true so inner-pane scrolls (which don't bubble) are observed too.
    window.addEventListener("scroll", schedule, true);

    const ro = new ResizeObserver(schedule);
    if (containerRef.current) ro.observe(containerRef.current);

    // Self-healing baseline: occluded windows suppress rendering, so scroll
    // events from programmatic scrolls may never fire. A slow poll keeps the
    // overlay truthful no matter what; the event path keeps it snappy.
    const poll = setInterval(measure, 800);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      ro.disconnect();
    };
  }, [containerRef, version]);

  return rects;
}
