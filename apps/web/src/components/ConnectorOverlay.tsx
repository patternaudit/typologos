import type { Link } from "@typologos/shared";
import type { AnchorRects } from "../hooks/useAnchorRects";
import { colorFor } from "../relationshipStyle";

interface ConnectorOverlayProps {
  links: Link[];
  rects: AnchorRects;
  selectedLinkId: string | null;
  onSelectLink: (linkId: string) => void;
}

function pathFor(
  source: AnchorRects[string],
  target: AnchorRects[string],
): string {
  // Connect midpoint-right of source to midpoint-left of target with a smooth
  // horizontal cubic curve (per the spec).
  const x1 = source.right;
  const y1 = source.top + source.height / 2;
  const x2 = target.left;
  const y2 = target.top + target.height / 2;
  const dx = Math.max(80, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function ConnectorOverlay({
  links,
  rects,
  selectedLinkId,
  onSelectLink,
}: ConnectorOverlayProps) {
  return (
    <svg className="connector-overlay">
      {links.map((link) => {
        const source = rects[link.sourceAnchorId];
        const target = rects[link.targetAnchorId];
        if (!source || !target) return null;

        const d = pathFor(source, target);
        const color = colorFor(link.type);
        const selected = link.id === selectedLinkId;

        return (
          <g key={link.id} className="connector" data-link-id={link.id}>
            {/* Wide invisible hit area for easy clicking. */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={18}
              fill="none"
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={() => onSelectLink(link.id)}
            />
            {/* Visible connector. */}
            <path
              d={d}
              stroke={color}
              strokeWidth={selected ? 3.5 : 2}
              fill="none"
              strokeLinecap="round"
              opacity={selected ? 1 : 0.78}
              style={{
                pointerEvents: "none",
                filter: selected ? `drop-shadow(0 0 4px ${color})` : "none",
                transition: "stroke-width 120ms ease, opacity 120ms ease",
              }}
            />
            <circle cx={source.right} cy={source.top + source.height / 2} r={selected ? 4 : 3} fill={color} />
            <circle cx={target.left} cy={target.top + target.height / 2} r={selected ? 4 : 3} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
