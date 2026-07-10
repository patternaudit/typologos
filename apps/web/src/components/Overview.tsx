import { useEffect, useMemo, useState } from "react";
import type { OverviewConnection, OverviewStructure } from "@typologos/shared";
import * as api from "../api/client";

// Whole-scope connection map: two vertical strips (one scope each), every
// connection between them drawn as an arc. Books stack proportionally to
// verse count; chapters are bands inside books. This is the "see the whole
// structure at once" view — click an arc to drop into the reading panes at
// that chapter pair.

const SCOPES: { id: string; label: string }[] = [
  { id: "bible", label: "Bible (KJV)" },
  { id: "ot", label: "Old Testament" },
  { id: "nt", label: "New Testament" },
  { id: "josephus", label: "Josephus" },
  { id: "wars", label: "Wars of the Jews" },
];

const W = 1440;
const H = 880;
const TOP = 30;
const BOTTOM = 16;
const STRIP_W = 30;
const LEFT_X = 210;
const RIGHT_X = W - 210 - STRIP_W;

const KIND_COLOR: Record<OverviewConnection["kind"], string> = {
  wilson: "#b8742a",
  parallel: "#4a6b8a",
  link: "#3a8a5f",
};

interface ChapterPos {
  y: number; // center y
  h: number;
  title: string;
  chapter: number;
}

interface StripLayout {
  // key: documentId|chapter -> position
  chapters: Map<string, ChapterPos>;
  books: { y: number; h: number; title: string; documentId: string; index: number }[];
}

function layoutStrip(s: OverviewStructure): StripLayout {
  const usable = H - TOP - BOTTOM;
  const chapters = new Map<string, ChapterPos>();
  const books: StripLayout["books"] = [];
  let cum = 0;
  s.books.forEach((b, index) => {
    const bookStart = TOP + (cum / s.totalVerses) * usable;
    let bookVerses = 0;
    for (const ch of b.chapters) {
      const y0 = TOP + (cum / s.totalVerses) * usable;
      const h = (ch.verses / s.totalVerses) * usable;
      chapters.set(`${b.documentId}|${ch.chapter}`, {
        y: y0 + h / 2,
        h,
        title: `${b.title} ${ch.chapter}`,
        chapter: ch.chapter,
      });
      cum += ch.verses;
      bookVerses += ch.verses;
    }
    books.push({
      y: bookStart,
      h: (bookVerses / s.totalVerses) * usable,
      title: b.title,
      documentId: b.documentId,
      index,
    });
  });
  return { chapters, books };
}

interface OverviewProps {
  initialLeft?: string;
  initialRight?: string;
  onClose: () => void;
  onOpenPair: (
    leftDoc: string,
    leftChapter: number,
    rightDoc: string,
    rightChapter: number,
  ) => void;
}

export function Overview({ initialLeft, initialRight, onClose, onOpenPair }: OverviewProps) {
  const [leftScope, setLeftScope] = useState(initialLeft ?? "ot");
  const [rightScope, setRightScope] = useState(initialRight ?? "nt");
  const [left, setLeft] = useState<OverviewStructure | null>(null);
  const [right, setRight] = useState<OverviewStructure | null>(null);
  const [connections, setConnections] = useState<OverviewConnection[]>([]);
  const [minWeight, setMinWeight] = useState(2);
  const [layers, setLayers] = useState({ wilson: true, parallel: true, link: true });
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    let stale = false;
    Promise.all([
      api.fetchOverviewStructure(leftScope),
      api.fetchOverviewStructure(rightScope),
      api.fetchOverviewConnections(leftScope, rightScope),
    ])
      .then(([l, r, conns]) => {
        if (stale) return;
        setLeft(l);
        setRight(r);
        setConnections(conns);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [leftScope, rightScope]);

  const leftLayout = useMemo(() => (left ? layoutStrip(left) : null), [left]);
  const rightLayout = useMemo(() => (right ? layoutStrip(right) : null), [right]);

  const visible = useMemo(() => {
    if (!leftLayout || !rightLayout) return [];
    return connections.filter((c) => {
      if (!layers[c.kind]) return false;
      if (c.kind === "wilson" && c.weight < minWeight) return false;
      return (
        leftLayout.chapters.has(`${c.leftDocumentId}|${c.leftChapter}`) &&
        rightLayout.chapters.has(`${c.rightDocumentId}|${c.rightChapter}`)
      );
    });
  }, [connections, layers, minWeight, leftLayout, rightLayout]);

  const wilsonShown = visible.filter((c) => c.kind === "wilson").length;
  const wilsonTotal = connections.filter(
    (c) => c.kind === "wilson" && layers.wilson,
  ).length;

  const arcPath = (c: OverviewConnection): string => {
    const a = leftLayout!.chapters.get(`${c.leftDocumentId}|${c.leftChapter}`)!;
    const b = rightLayout!.chapters.get(`${c.rightDocumentId}|${c.rightChapter}`)!;
    const x1 = LEFT_X + STRIP_W;
    const x2 = RIGHT_X;
    const dx = (x2 - x1) / 3;
    return `M ${x1} ${a.y} C ${x1 + dx} ${a.y}, ${x2 - dx} ${b.y}, ${x2} ${b.y}`;
  };

  const tipFor = (c: OverviewConnection): string => {
    const a = leftLayout!.chapters.get(`${c.leftDocumentId}|${c.leftChapter}`)!;
    const b = rightLayout!.chapters.get(`${c.rightDocumentId}|${c.rightChapter}`)!;
    return `${a.title} ↔ ${b.title} — ${c.label}`;
  };

  const renderStrip = (layout: StripLayout, x: number, labelSide: "left" | "right") => (
    <g>
      {layout.books.map((b) => (
        <g key={b.documentId}>
          <rect
            x={x}
            y={b.y}
            width={STRIP_W}
            height={Math.max(b.h, 0.5)}
            className={`ov-book ${b.index % 2 ? "ov-book-alt" : ""}`}
          >
            <title>{b.title}</title>
          </rect>
          {b.h > 11 && (
            <text
              x={labelSide === "left" ? x - 6 : x + STRIP_W + 6}
              y={b.y + b.h / 2 + 3}
              className="ov-book-label"
              textAnchor={labelSide === "left" ? "end" : "start"}
            >
              {b.title}
            </text>
          )}
        </g>
      ))}
    </g>
  );

  return (
    <div className="overview">
      <div className="overview-bar">
        <select value={leftScope} onChange={(e) => setLeftScope(e.target.value)}>
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="overview-vs">↔</span>
        <select value={rightScope} onChange={(e) => setRightScope(e.target.value)}>
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <span className="overview-controls">
          <label className="ov-layer" style={{ color: KIND_COLOR.wilson }}>
            <input
              type="checkbox"
              checked={layers.wilson}
              onChange={(e) => setLayers({ ...layers, wilson: e.target.checked })}
            />
            Wilson motifs
          </label>
          <label className="ov-layer" style={{ color: KIND_COLOR.parallel }}>
            <input
              type="checkbox"
              checked={layers.parallel}
              onChange={(e) => setLayers({ ...layers, parallel: e.target.checked })}
            />
            Parallels
          </label>
          <label className="ov-layer" style={{ color: KIND_COLOR.link }}>
            <input
              type="checkbox"
              checked={layers.link}
              onChange={(e) => setLayers({ ...layers, link: e.target.checked })}
            />
            My links
          </label>
          <label className="ov-layer">
            shared motifs ≥
            <select value={minWeight} onChange={(e) => setMinWeight(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          {layers.wilson && wilsonShown < wilsonTotal && (
            <span className="ov-note">
              {wilsonShown} of {wilsonTotal} motif pairs shown
            </span>
          )}
        </span>

        <button className="ghost" onClick={onClose}>
          ✕ Close overview
        </button>
      </div>

      <div className="overview-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {leftLayout && rightLayout && (
            <>
              {visible.map((c, i) => {
                const strong = c.kind !== "wilson" || c.weight >= 2;
                return (
                  <g key={i}>
                    {strong && (
                      <path
                        d={arcPath(c)}
                        stroke="transparent"
                        strokeWidth={8}
                        fill="none"
                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, text: tipFor(c) })}
                        onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: tipFor(c) })}
                        onMouseLeave={() => setTip(null)}
                        onClick={() =>
                          onOpenPair(c.leftDocumentId, c.leftChapter, c.rightDocumentId, c.rightChapter)
                        }
                      />
                    )}
                    <path
                      d={arcPath(c)}
                      stroke={KIND_COLOR[c.kind]}
                      strokeWidth={c.kind === "wilson" ? Math.min(0.6 + c.weight * 0.5, 2.6) : 1.6}
                      strokeDasharray={c.kind === "parallel" ? "3 3" : undefined}
                      fill="none"
                      opacity={c.kind === "wilson" ? Math.min(0.12 + c.weight * 0.14, 0.65) : 0.75}
                      style={{ pointerEvents: "none" }}
                    />
                  </g>
                );
              })}
              {renderStrip(leftLayout, LEFT_X, "left")}
              {renderStrip(rightLayout, RIGHT_X, "right")}
            </>
          )}
        </svg>
        {tip && (
          <div
            className="motif-tooltip"
            style={{ left: Math.min(tip.x + 14, window.innerWidth - 260), top: tip.y + 16 }}
          >
            <div className="motif-tooltip-row">
              <span className="motif-tooltip-grade">{tip.text}</span>
            </div>
            <div className="motif-tooltip-hint">click to open this pair</div>
          </div>
        )}
      </div>
    </div>
  );
}
