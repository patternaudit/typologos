import { useEffect, useMemo, useState } from "react";
import type { OverviewConnection, OverviewStructure } from "@typologos/shared";
import * as api from "../api/client";

// Whole-scope connection map: two vertical strips (one scope each), every
// connection between them drawn as an arc. Books stack proportionally to
// verse count; chapters are bands inside books. Click an arc to drop into the
// reading panes at that chapter pair; click a book band to load that book on
// that side.

const SCOPES: { id: string; label: string }[] = [
  { id: "bible", label: "Bible (KJV)" },
  { id: "ot", label: "Old Testament" },
  { id: "nt", label: "New Testament" },
  { id: "josephus", label: "Josephus (all)" },
  { id: "wars", label: "Wars of the Jews" },
  { id: "antiquities", label: "Antiquities" },
];

const W = 1440;
const H = 880;
const TOP = 30;
const BOTTOM = 16;
const STRIP_W = 30;
const LEFT_X = 210;
const RIGHT_X = W - 210 - STRIP_W;

// One toggleable data layer in the map.
interface LayerDef {
  id: string; // matches connection kind or parallel source
  label: string;
  color: string;
  hint: string;
  dash?: string;
  match: (c: OverviewConnection) => boolean;
}

const LAYERS: LayerDef[] = [
  {
    id: "wilson",
    label: "Wilson motifs",
    color: "#b8742a",
    hint: "Chapters sharing a symbol from Wilson's Dictionary of Bible Types (Lamb, Fire, …). Arc weight = how many symbols the two chapters share.",
    match: (c) => c.kind === "wilson",
  },
  {
    id: "atwill-cm",
    label: "Atwill parallels",
    color: "#4a6b8a",
    dash: "3 3",
    hint: "The 34-step Flavian Signature sequence from Caesar's Messiah (NT ↔ Josephus), with textual-check verdicts.",
    match: (c) => c.kind === "parallel" && c.source === "atwill-cm",
  },
  {
    id: "mason-dependence",
    label: "Mason dependence",
    color: "#7d5a86",
    dash: "3 3",
    hint: "Touchpoints for the mainstream 'Luke used Josephus' source hypothesis (Theudas, the census, the Egyptian, …).",
    match: (c) => c.kind === "parallel" && c.source === "mason-dependence",
  },
  {
    id: "link",
    label: "My links",
    color: "#3a8a5f",
    hint: "Links you created by hand between anchored passages.",
    match: (c) => c.kind === "link",
  },
];

interface ChapterPos {
  y: number; // center y
  h: number;
  title: string;
  chapter: number;
}

interface StripLayout {
  chapters: Map<string, ChapterPos>; // documentId|chapter -> position
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
  // Load one book into the given reading pane (overview stays open).
  onLoadBook: (side: "left" | "right", documentId: string) => void;
}

export function Overview({
  initialLeft,
  initialRight,
  onClose,
  onOpenPair,
  onLoadBook,
}: OverviewProps) {
  const [leftScope, setLeftScope] = useState(initialLeft ?? "ot");
  const [rightScope, setRightScope] = useState(initialRight ?? "nt");
  const [left, setLeft] = useState<OverviewStructure | null>(null);
  const [right, setRight] = useState<OverviewStructure | null>(null);
  const [connections, setConnections] = useState<OverviewConnection[]>([]);
  const [minWeight, setMinWeight] = useState(2);
  const [layersOn, setLayersOn] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LAYERS.map((l) => [l.id, true])),
  );
  const [tip, setTip] = useState<{ x: number; y: number; text: string; hint?: string } | null>(
    null,
  );
  const [loadedNote, setLoadedNote] = useState<string | null>(null);

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

  const layerOf = (c: OverviewConnection): LayerDef | undefined => LAYERS.find((l) => l.match(c));

  const visible = useMemo(() => {
    if (!leftLayout || !rightLayout) return [];
    return connections.filter((c) => {
      const layer = layerOf(c);
      if (!layer || !layersOn[layer.id]) return false;
      if (c.kind === "wilson" && c.weight < minWeight) return false;
      return (
        leftLayout.chapters.has(`${c.leftDocumentId}|${c.leftChapter}`) &&
        rightLayout.chapters.has(`${c.rightDocumentId}|${c.rightChapter}`)
      );
    });
  }, [connections, layersOn, minWeight, leftLayout, rightLayout]);

  const wilsonShown = visible.filter((c) => c.kind === "wilson").length;
  const wilsonTotal = connections.filter((c) => c.kind === "wilson").length;

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

  const renderStrip = (
    layout: StripLayout,
    x: number,
    labelSide: "left" | "right",
    paneSide: "left" | "right",
  ) => (
    <g>
      {layout.books.map((b) => (
        <g key={b.documentId}>
          <rect
            x={x}
            y={b.y}
            width={STRIP_W}
            height={Math.max(b.h, 0.5)}
            className={`ov-book ${b.index % 2 ? "ov-book-alt" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => {
              onLoadBook(paneSide, b.documentId);
              setLoadedNote(`${b.title} loaded in the ${paneSide} pane — switch to Reading view`);
            }}
            onMouseEnter={(e) =>
              setTip({
                x: e.clientX,
                y: e.clientY,
                text: b.title,
                hint: `click to load in the ${paneSide} pane`,
              })
            }
            onMouseLeave={() => setTip(null)}
          />
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
        <span className="ov-group">
          <span className="ov-group-label">Compare</span>
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
        </span>

        <span className="ov-group">
          <span className="ov-group-label">Layers</span>
          {LAYERS.map((l) => (
            <label key={l.id} className="ov-layer" style={{ color: l.color }} title={l.hint}>
              <input
                type="checkbox"
                checked={layersOn[l.id]}
                onChange={(e) => setLayersOn({ ...layersOn, [l.id]: e.target.checked })}
              />
              {l.label}
            </label>
          ))}
        </span>

        <span className="ov-group">
          <span
            className="ov-group-label"
            title="Wilson arcs only: hide chapter pairs sharing fewer symbols than this"
          >
            Min shared symbols
          </span>
          <select value={minWeight} onChange={(e) => setMinWeight(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          {layersOn["wilson"] && wilsonShown < wilsonTotal && (
            <span className="ov-note">
              {wilsonShown} of {wilsonTotal} shown
            </span>
          )}
        </span>

        <button className="ghost" onClick={onClose}>
          ✕ Close
        </button>
      </div>

      {loadedNote && (
        <div className="ov-loaded-note" onClick={() => setLoadedNote(null)}>
          {loadedNote}
        </div>
      )}

      <div className="overview-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {leftLayout && rightLayout && (
            <>
              {visible.map((c, i) => {
                const layer = layerOf(c)!;
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
                        onMouseEnter={(e) =>
                          setTip({ x: e.clientX, y: e.clientY, text: tipFor(c), hint: "click to open this pair" })
                        }
                        onMouseMove={(e) =>
                          setTip({ x: e.clientX, y: e.clientY, text: tipFor(c), hint: "click to open this pair" })
                        }
                        onMouseLeave={() => setTip(null)}
                        onClick={() =>
                          onOpenPair(c.leftDocumentId, c.leftChapter, c.rightDocumentId, c.rightChapter)
                        }
                      />
                    )}
                    <path
                      d={arcPath(c)}
                      stroke={layer.color}
                      strokeWidth={c.kind === "wilson" ? Math.min(0.6 + c.weight * 0.5, 2.6) : 1.6}
                      strokeDasharray={layer.dash}
                      fill="none"
                      opacity={c.kind === "wilson" ? Math.min(0.12 + c.weight * 0.14, 0.65) : 0.75}
                      style={{ pointerEvents: "none" }}
                    />
                  </g>
                );
              })}
              {renderStrip(leftLayout, LEFT_X, "left", "left")}
              {renderStrip(rightLayout, RIGHT_X, "right", "right")}
            </>
          )}
        </svg>
        {tip && (
          <div
            className="motif-tooltip"
            style={{ left: Math.min(tip.x + 14, window.innerWidth - 280), top: tip.y + 16 }}
          >
            <div className="motif-tooltip-row">
              <span className="motif-tooltip-grade">{tip.text}</span>
            </div>
            {tip.hint && <div className="motif-tooltip-hint">{tip.hint}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
