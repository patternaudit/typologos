import { useState } from "react";
import type { LocalRect } from "../hooks/useAnchorRects";

// One arc between a left-pane verse and a right-pane verse. Wilson arcs come
// from shared motifs; parallel arcs from imported claimed parallels (Atwill).
export interface MotifArc {
  key: string; // leftSegId|rightSegId
  kind: "wilson" | "parallel";
  from: LocalRect; // left verse block
  to: LocalRect; // right verse block
  headwords: string[]; // shared motifs (wilson) or "title — verdict" lines (parallel)
  leftSegmentId: string;
  leftRef: string; // e.g. "Exodus 3:2"
  rightRef: string;
  parallelId?: string; // set for kind === "parallel"
  source?: string; // parallel provenance, for styling
}

interface MotifArcOverlayProps {
  arcs: MotifArc[];
  onArcClick: (arc: MotifArc) => void;
  onArcHover?: (arc: MotifArc | null) => void;
}

function pathFor(from: LocalRect, to: LocalRect): string {
  const x1 = from.right;
  const y1 = from.top + from.height / 2;
  const x2 = to.left;
  const y2 = to.top + to.height / 2;
  const dx = Math.max(60, Math.abs(x2 - x1) / 2.4);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// The Wilson reference layer's strings: quiet dashed arcs, visually beneath
// the user's own solid links. Hover to see the shared motifs; click to open
// the drawer on the left verse.
export function MotifArcOverlay({ arcs, onArcClick, onArcHover }: MotifArcOverlayProps) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const hoveredArc = hover ? arcs.find((a) => a.key === hover.key) ?? null : null;

  return (
    <>
      <svg className="motif-arc-overlay">
        {arcs.map((arc) => {
          const d = pathFor(arc.from, arc.to);
          const hovered = hover?.key === arc.key;
          // More shared motifs -> a slightly heavier string.
          const width = Math.min(1 + arc.headwords.length * 0.6, 3);
          return (
            <g key={arc.key}>
              <path
                d={d}
                stroke="transparent"
                strokeWidth={14}
                fill="none"
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onMouseEnter={(e) => {
                  setHover({ key: arc.key, x: e.clientX, y: e.clientY });
                  onArcHover?.(arc);
                }}
                onMouseMove={(e) => setHover({ key: arc.key, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => {
                  setHover(null);
                  onArcHover?.(null);
                }}
                onClick={() => onArcClick(arc)}
              />
              <path
                d={d}
                className={
                  arc.kind === "parallel"
                    ? arc.source === "mason-dependence"
                      ? "parallel-arc parallel-arc-mason"
                      : "parallel-arc"
                    : "motif-arc"
                }
                strokeWidth={hovered ? width + 1 : width}
                strokeDasharray={arc.kind === "parallel" ? "2 4" : "6 5"}
                opacity={hovered ? 0.95 : arc.kind === "parallel" ? 0.55 : 0.4}
              />
            </g>
          );
        })}
      </svg>
      {hoveredArc && hover && (
        <div
          className="motif-tooltip"
          style={{ left: Math.min(hover.x + 14, window.innerWidth - 210), top: hover.y + 18 }}
        >
          <div className="motif-tooltip-row">
            <span className="motif-tooltip-word">
              {hoveredArc.leftRef} ↔ {hoveredArc.rightRef}
            </span>
          </div>
          {hoveredArc.headwords.map((h) => (
            <div className="motif-tooltip-row" key={h}>
              <span className="motif-tooltip-grade">{h}</span>
            </div>
          ))}
          <div className="motif-tooltip-hint">click for details</div>
        </div>
      )}
    </>
  );
}
