import { useEffect, useState, type RefObject } from "react";

export interface LocalRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type AnchorRects = Record<string, LocalRect>;

// Measures every [data-anchor-id] element inside `containerRef`, in coordinates
// local to the container, and keeps them fresh on scroll / resize / layout
// changes. `version` is bumped by the caller when anchors or links change so we
// re-measure after the DOM updates.
export function useAnchorRects(
  containerRef: RefObject<HTMLElement>,
  version: number,
): AnchorRects {
  const [rects, setRects] = useState<AnchorRects>({});

  useEffect(() => {
    let raf = 0;

    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const cbox = container.getBoundingClientRect();
      const next: AnchorRects = {};
      container.querySelectorAll<HTMLElement>("[data-anchor-id]").forEach((el) => {
        const id = el.getAttribute("data-anchor-id");
        if (!id) return;
        const r = el.getBoundingClientRect();
        next[id] = {
          left: r.left - cbox.left,
          top: r.top - cbox.top,
          right: r.right - cbox.left,
          bottom: r.bottom - cbox.top,
          width: r.width,
          height: r.height,
        };
      });
      setRects(next);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("resize", schedule);
    // capture=true so inner-pane scrolls (which don't bubble) are observed too.
    window.addEventListener("scroll", schedule, true);

    const ro = new ResizeObserver(schedule);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      ro.disconnect();
    };
  }, [containerRef, version]);

  return rects;
}
