import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Anchor,
  BookPassage,
  BookSummary,
  HydratedWorkspace,
  PaneSide,
  Parallel,
  PassageMotifInstance,
  RelationshipType,
} from "@typologos/shared";
import * as api from "../data";
import { useAnchorRects } from "../hooks/useAnchorRects";
import type { Block, PaneData, PaneView, PendingSelection } from "../viewTypes";
import { PassagePane } from "./PassagePane";
import { PaneLoading } from "./PaneLoading";
import { ConnectorOverlay } from "./ConnectorOverlay";
import { LinkModal } from "./LinkModal";
import { LinkInspector } from "./LinkInspector";
import { MotifPanel } from "./MotifPanel";
import { ParallelInspector } from "./ParallelInspector";
import { Overview } from "./Overview";
import { StartScreen } from "./StartScreen";
import { IndexPage, type IndexSection } from "./IndexPage";
import { AboutPage } from "./AboutPage";
import { MotifArcOverlay, type MotifArc } from "./MotifArcOverlay";
import type { LocalRect } from "../hooks/useAnchorRects";

interface WorkspaceProps {
  workspaceId: string;
}

type SideViews = { left: PaneView | null; right: PaneView | null };
type SideBooks = { left: BookPassage | null; right: BookPassage | null };
type SideMotifs = { left: PassageMotifInstance[]; right: PassageMotifInstance[] };

// Older saved views used a per-chapter "passage" mode; fold those into the
// scrolling book mode.
function normalizeView(raw: unknown): PaneView | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (v.mode === "document" && typeof v.documentId === "string") {
    return { mode: "document", documentId: v.documentId };
  }
  if ((v.mode === "book" || v.mode === "passage") && typeof v.bookId === "string") {
    return { mode: "book", bookId: v.bookId };
  }
  return null;
}

// Which verse's motif drawer is open, and in which pane it was opened.
interface MotifPanelState {
  side: PaneSide;
  segmentId: string;
  refLabel: string;
}

// ?left=kjv-Exod:3:2 -> a book view plus a scroll target (verse defaults to 1);
// ?left=doc:<id> -> a legacy standalone document.
function viewFromParam(raw: string | null): { view: PaneView; target: string | null } | null {
  if (!raw) return null;
  if (raw.startsWith("doc:")) {
    return { view: { mode: "document", documentId: raw.slice(4) }, target: null };
  }
  const [bookId, ch, v] = raw.split(":");
  const target = ch ? `seg-${bookId}-${Number(ch)}-${v ? Number(v) : 1}` : null;
  return { view: { mode: "book", bookId }, target };
}

// seg-kjv-Luke-5-10 -> "kjv-Luke:5:10" (deep-link parameter form)
function segToParam(seg: string | null): string | null {
  if (!seg) return null;
  const m = seg.match(/^seg-(.+)-(\d+)-(\d+)$/);
  return m ? `${m[1]}:${m[2]}:${m[3]}` : null;
}

// Inverse of viewFromParam, minus the scroll target (a bare book id keeps the
// pane where it is).
function viewToParam(v: PaneView | null): string | null {
  if (!v) return null;
  return v.mode === "document" ? `doc:${v.documentId}` : v.bookId;
}

function sameView(a: PaneView | null, b: PaneView | null): boolean {
  if (!a || !b || a.mode !== b.mode) return a === b;
  return a.mode === "book"
    ? a.bookId === (b as { bookId: string }).bookId
    : a.documentId === (b as { documentId: string }).documentId;
}

// Line icons for the mobile bottom tab bar.
const NAV_ICONS: Record<string, JSX.Element> = {
  start: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  ),
  reading: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6c-1.8-1.4-4.2-2-7-2v14c2.8 0 5.2.6 7 2 1.8-1.4 4.2-2 7-2V4c-2.8 0-5.2.6-7 2Z" />
      <path d="M12 6v14" />
    </svg>
  ),
  overview: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4v16" />
      <path d="M19 4v16" />
      <path d="M5 8c6 0 8 8 14 8" />
      <path d="M5 16c6 0 8-8 14-8" />
    </svg>
  ),
  index: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  ),
};

const INDEX_SLUGS: IndexSection[] = ["atwill", "mason", "wilson", "control", "links"];

function indexSectionFromParam(raw: string | null): IndexSection | null {
  if (raw === "1") return "atwill"; // legacy links
  return INDEX_SLUGS.includes(raw as IndexSection) ? (raw as IndexSection) : null;
}

export function Workspace({ workspaceId }: WorkspaceProps) {
  const [data, setData] = useState<HydratedWorkspace | null>(null);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [views, setViews] = useState<SideViews>({ left: null, right: null });
  const [sideBooks, setSideBooks] = useState<SideBooks>({ left: null, right: null });
  const [motifs, setMotifs] = useState<SideMotifs>({ left: [], right: [] });
  const [parallels, setParallels] = useState<Parallel[]>([]);
  const [selectedParallelId, setSelectedParallelId] = useState<string | null>(null);
  const [motifPanel, setMotifPanel] = useState<MotifPanelState | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(
    () => new URLSearchParams(window.location.search).get("overview") === "1",
  );
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  // A plain URL (no params) always lands on the curated start screen; deep
  // links go straight to their destination. Saved pane views still resume
  // underneath once the visitor leaves Start.
  const [startOpen, setStartOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("start") === "1") return true;
    return [...params.keys()].length === 0;
  });
  const [indexSection, setIndexSection] = useState<IndexSection | null>(() =>
    indexSectionFromParam(new URLSearchParams(window.location.search).get("index")),
  );
  const [aboutOpen, setAboutOpen] = useState(
    () => new URLSearchParams(window.location.search).get("about") === "1",
  );
  // Verse block to scroll into view once its pane has rendered (segment id).
  const [scrollTargets, setScrollTargets] = useState<{
    left: string | null;
    right: string | null;
  }>({ left: null, right: null });
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  const [leftSelection, setLeftSelection] = useState<PendingSelection | null>(null);
  const [rightSelection, setRightSelection] = useState<PendingSelection | null>(null);
  const [draftSourceId, setDraftSourceId] = useState<string | null>(null);
  const [draftTargetId, setDraftTargetId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const viewsKey = `typologos:views:${workspaceId}`;
  const bumpLayout = useCallback(() => setVersion((v) => v + 1), []);

  // Re-derive view state from the URL (initial load, history navigation, and
  // in-app pushState navigation all funnel through here).
  const applyLocation = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    setStartOpen(params.get("start") === "1" || [...params.keys()].length === 0);
    setIndexSection(indexSectionFromParam(params.get("index")));
    setOverviewOpen(params.get("overview") === "1");
    setAboutOpen(params.get("about") === "1");
    const qLeft = viewFromParam(params.get("left"));
    const qRight = viewFromParam(params.get("right"));
    if (qLeft || qRight) {
      // Keep the existing view object when it's equivalent — a new identity
      // would re-stream the whole book in static mode.
      setViews((v) => {
        const nl = qLeft?.view ?? v.left;
        const nr = qRight?.view ?? v.right;
        return {
          left: sameView(v.left, nl) ? v.left : nl,
          right: sameView(v.right, nr) ? v.right : nr,
        };
      });
      setScrollTargets({ left: qLeft?.target ?? null, right: qRight?.target ?? null });
    }
    const par = params.get("parallel");
    setSelectedParallelId(par);
    if (par) {
      setMotifPanel(null);
      setSelectedLinkId(null);
    }
  }, []);

  // In-app navigation that participates in browser history: e.g. index ->
  // claim pushes an entry, so Back returns to the index section.
  const gotoUrl = useCallback(
    (search: string) => {
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      window.history.pushState(null, "", url);
      applyLocation();
    },
    [applyLocation],
  );

  useEffect(() => {
    const onPop = () => applyLocation();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyLocation]);

  const reload = useCallback(async () => {
    try {
      const next = await api.fetchWorkspace(workspaceId);
      setData(next);
      bumpLayout();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [workspaceId, bumpLayout]);

  useEffect(() => {
    reload();
    api.fetchBooks().then(setBooks).catch(() => setBooks([]));
    api
      .fetchParallels()
      .then((list) => {
        setParallels(list);
        // Deep link: ?parallel=par-atwill-24 opens the claim inspector.
        const want = new URLSearchParams(window.location.search).get("parallel");
        if (want && list.some((p) => p.id === want)) setSelectedParallelId(want);
      })
      .catch(() => setParallels([]));
  }, [reload]);

  // Initialise pane views once data is available: restore saved navigation
  // (normalizing older formats), or default both panes to their seeded
  // documents.
  useEffect(() => {
    if (!data || (views.left && views.right)) return;
    const leftPane = data.panes.find((p) => p.side === "left");
    const rightPane = data.panes.find((p) => p.side === "right");
    // Local-first mode has no seeded document panes; fall back to books.
    const leftDefault: PaneView = leftPane
      ? { mode: "document", documentId: leftPane.document.id }
      : { mode: "book", bookId: "kjv-Gen" };
    const rightDefault: PaneView = rightPane
      ? { mode: "document", documentId: rightPane.document.id }
      : { mode: "book", bookId: "kjv-John" };

    let savedLeft: PaneView | null = null;
    let savedRight: PaneView | null = null;
    try {
      const raw = localStorage.getItem(viewsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        savedLeft = normalizeView(parsed.left);
        savedRight = normalizeView(parsed.right);
      }
    } catch {
      /* fall through to defaults */
    }
    // Deep links win over saved state.
    const params = new URLSearchParams(window.location.search);
    const qLeft = viewFromParam(params.get("left"));
    const qRight = viewFromParam(params.get("right"));
    setViews({
      left: qLeft?.view ?? savedLeft ?? leftDefault,
      right: qRight?.view ?? savedRight ?? rightDefault,
    });
    if (qLeft?.target || qRight?.target) {
      setScrollTargets({ left: qLeft?.target ?? null, right: qRight?.target ?? null });
    }
  }, [data, views, viewsKey]);

  // Persist navigation.
  useEffect(() => {
    if (views.left && views.right) {
      try {
        localStorage.setItem(viewsKey, JSON.stringify(views));
      } catch {
        /* ignore quota errors */
      }
    }
  }, [views, viewsKey]);

  const fetchSide = useCallback(
    async (side: PaneSide, view: PaneView | null) => {
      if (!view || view.mode !== "book") {
        setSideBooks((p) => ({ ...p, [side]: null }));
        setMotifs((m) => ({ ...m, [side]: [] }));
        return;
      }
      try {
        const [bp, mi] = await Promise.all([
          api.fetchBookPassage(view.bookId),
          // Motifs are decoration: a failure shouldn't block the passage.
          api.fetchBookMotifs(view.bookId).catch(() => [] as PassageMotifInstance[]),
        ]);
        setSideBooks((p) => ({ ...p, [side]: bp }));
        setMotifs((m) => ({ ...m, [side]: mi }));
        bumpLayout();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [bumpLayout],
  );

  // Load passages whenever a side's view changes.
  useEffect(() => {
    fetchSide("left", views.left);
  }, [views.left, fetchSide]);
  useEffect(() => {
    fetchSide("right", views.right);
  }, [views.right, fetchSide]);

  const rects = useAnchorRects(mainRef, version);

  // Merge every anchor we know about (link endpoints + loaded books) so draft
  // slots, the inspector, and highlights all resolve by id.
  const anchorsById = useMemo(() => {
    const byId = new Map<string, Anchor>();
    for (const a of data?.linkAnchors ?? []) byId.set(a.id, a);
    for (const pane of data?.panes ?? []) for (const a of pane.anchors) byId.set(a.id, a);
    for (const a of sideBooks.left?.anchors ?? []) byId.set(a.id, a);
    for (const a of sideBooks.right?.anchors ?? []) byId.set(a.id, a);
    return byId;
  }, [data, sideBooks]);

  const linkedAnchorIds = useMemo(() => {
    const set = new Set<string>();
    for (const link of data?.links ?? []) {
      set.add(link.sourceAnchorId);
      set.add(link.targetAnchorId);
    }
    return set;
  }, [data]);

  // Arcs between visible verses of the two panes that share a Wilson motif —
  // the reference layer's own strings. Recomputed as panes scroll (rects are
  // refreshed per scroll frame); capped to keep the space readable.
  const MAX_ARCS = 80;
  const motifArcs = useMemo<MotifArc[]>(() => {
    const lp = rects.panes.left;
    const rp = rects.panes.right;
    if (!lp || !rp) return [];
    const MARGIN = 30;
    const isVisible = (r: LocalRect, pane: LocalRect) =>
      r.bottom > pane.top - MARGIN && r.top < pane.bottom + MARGIN;

    const collect = (list: PassageMotifInstance[], side: PaneSide, pane: LocalRect) => {
      const byMotif = new Map<string, PassageMotifInstance[]>();
      for (const mi of list) {
        if (!mi.segmentId) continue;
        const r = rects.blocks[side][mi.segmentId];
        if (!r || !isVisible(r, pane)) continue;
        const arr = byMotif.get(mi.motifId) ?? [];
        arr.push(mi);
        byMotif.set(mi.motifId, arr);
      }
      return byMotif;
    };
    const leftBy = collect(motifs.left, "left", lp);
    const rightBy = collect(motifs.right, "right", rp);

    const byPair = new Map<string, MotifArc>();
    for (const [motifId, leftInsts] of leftBy) {
      const rightInsts = rightBy.get(motifId);
      if (!rightInsts) continue;
      for (const li of leftInsts) {
        for (const ri of rightInsts) {
          if (li.segmentId === ri.segmentId) continue;
          const key = `${li.segmentId}|${ri.segmentId}`;
          const existing = byPair.get(key);
          if (existing) {
            if (!existing.headwords.includes(li.headword)) existing.headwords.push(li.headword);
          } else {
            byPair.set(key, {
              key,
              kind: "wilson",
              from: rects.blocks.left[li.segmentId!],
              to: rects.blocks.right[ri.segmentId!],
              headwords: [li.headword],
              leftSegmentId: li.segmentId!,
              leftRef: li.ref,
              rightRef: ri.ref,
            });
          }
        }
      }
    }

    // Claimed parallels (Atwill): endpoints are fixed segment pairs; draw in
    // whichever orientation the panes currently hold the two documents.
    // Presence in rects.blocks already implies near-visibility.
    for (const p of parallels) {
      if (!p.leftSegmentId || !p.rightSegmentId) continue;
      const sourceName = p.source === "mason-dependence" ? "Mason" : "Atwill";
      const label = [p.title, `${sourceName} #${p.position} · ${p.verdict}`];
      const pairs = [
        { key: `par|${p.id}|lr`, a: p.leftSegmentId, aRef: p.leftRef, b: p.rightSegmentId, bRef: p.rightRef },
        { key: `par|${p.id}|rl`, a: p.rightSegmentId, aRef: p.rightRef, b: p.leftSegmentId, bRef: p.leftRef },
      ];
      for (const { key, a, aRef, b, bRef } of pairs) {
        const from = rects.blocks.left[a];
        const to = rects.blocks.right[b];
        if (!from || !to) continue;
        byPair.set(key, {
          key,
          kind: "parallel",
          source: p.source,
          from,
          to,
          headwords: label,
          leftSegmentId: a,
          leftRef: aRef,
          rightRef: bRef,
          parallelId: p.id,
        });
      }
    }
    return [...byPair.values()].slice(0, MAX_ARCS);
  }, [motifs, parallels, rects]);

  // Motif instances keyed by the verse segment they annotate, per side.
  const motifsBySegment = useMemo(() => {
    const build = (list: PassageMotifInstance[]) => {
      const map = new Map<string, PassageMotifInstance[]>();
      for (const mi of list) {
        if (!mi.segmentId) continue;
        const entry = map.get(mi.segmentId) ?? [];
        entry.push(mi);
        map.set(mi.segmentId, entry);
      }
      return map;
    };
    return { left: build(motifs.left), right: build(motifs.right) };
  }, [motifs]);

  const selectedLink = data?.links.find((l) => l.id === selectedLinkId) ?? null;
  const selectedLinkAnchorIds = useMemo(() => {
    if (!selectedLink) return new Set<string>();
    return new Set([selectedLink.sourceAnchorId, selectedLink.targetAnchorId]);
  }, [selectedLink]);

  // --- pane data (blocks) ----------------------------------------------------

  const paneData = useCallback(
    (side: PaneSide, view: PaneView | null): PaneData | null => {
      if (!view || !data) return null;
      if (view.mode === "document") {
        const pane = data.panes.find((p) => p.side === side);
        if (!pane) return null;
        const doc = pane.document;
        return {
          title: doc.title,
          reference: doc.reference,
          blocks: [
            {
              key: doc.id,
              segmentId: null,
              documentId: doc.id,
              passageRef: doc.reference,
              body: doc.body,
              anchors: pane.anchors,
            },
          ],
        };
      }

      const bp = sideBooks[side];
      // Still loading (or stale for a different book).
      if (!bp || bp.document.id !== view.bookId) return null;

      const anchorsBySeg = new Map<string, Anchor[]>();
      for (const a of bp.anchors) {
        if (!a.segmentId) continue;
        const list = anchorsBySeg.get(a.segmentId) ?? [];
        list.push(a);
        anchorsBySeg.set(a.segmentId, list);
      }

      let lastChapter = -1;
      const blocks = bp.verses.map((v) => {
        const chapterStart = v.chapter !== lastChapter ? v.chapter : undefined;
        lastChapter = v.chapter;
        return {
          key: v.id,
          segmentId: v.id,
          documentId: view.bookId,
          passageRef: v.ref,
          verseLabel: v.verse != null ? String(v.verse) : undefined,
          chapterStart,
          body: v.body,
          anchors: anchorsBySeg.get(v.id) ?? [],
        };
      });

      const name = bp.document.title;
      return { title: name, reference: bp.document.reference, blocks };
    },
    [data, sideBooks],
  );

  const leftData = paneData("left", views.left);
  const rightData = paneData("right", views.right);

  // --- navigation ------------------------------------------------------------

  const navigate = useCallback(
    (side: PaneSide, view: PaneView) => {
      setViews((v) => ({ ...v, [side]: view }));
      if (side === "left") setLeftSelection(null);
      else setRightSelection(null);
      // The drawer's verse leaves the screen with its pane.
      setMotifPanel((p) => (p?.side === side ? null : p));
    },
    [],
  );

  const refreshSide = useCallback(
    (side: PaneSide) => {
      const view = side === "left" ? views.left : views.right;
      if (view?.mode === "book") return fetchSide(side, view);
      return reload();
    },
    [views, fetchSide, reload],
  );

  // --- anchor creation -------------------------------------------------------

  const createAnchor = useCallback(
    async (side: PaneSide) => {
      const selection = side === "left" ? leftSelection : rightSelection;
      if (!selection) return;
      setBusy(true);
      try {
        const anchor = await api.createAnchor({
          documentId: selection.documentId,
          segmentId: selection.segmentId,
          passageRef: selection.passageRef,
          startOffset: selection.start,
          endOffset: selection.end,
          selectedText: selection.text,
        });
        window.getSelection()?.removeAllRanges();
        if (side === "left") setLeftSelection(null);
        else setRightSelection(null);
        await refreshSide(side);
        if (side === "left") setDraftSourceId(anchor.id);
        else setDraftTargetId(anchor.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [leftSelection, rightSelection, refreshSide],
  );

  // --- draft picking & deletion ----------------------------------------------

  const sideOfAnchor = useCallback(
    (anchorId: string): PaneSide | null => {
      if ((leftData?.blocks ?? []).some((b) => b.anchors.some((a) => a.id === anchorId)))
        return "left";
      if ((rightData?.blocks ?? []).some((b) => b.anchors.some((a) => a.id === anchorId)))
        return "right";
      return null;
    },
    [leftData, rightData],
  );

  const handleAnchorClick = useCallback(
    (anchor: Anchor) => {
      const side = sideOfAnchor(anchor.id);
      if (side === "left") setDraftSourceId(anchor.id);
      else if (side === "right") setDraftTargetId(anchor.id);
    },
    [sideOfAnchor],
  );

  const clearDraft = useCallback(() => {
    setDraftSourceId(null);
    setDraftTargetId(null);
  }, []);

  // --- motif drawer ------------------------------------------------------------

  // The motif drawer, link inspector, and parallel inspector share the right
  // rail: opening one closes the others.
  const openMotifPanel = useCallback((side: PaneSide, segmentId: string | null, refLabel: string) => {
    if (!segmentId) return;
    setSelectedLinkId(null);
    setSelectedParallelId(null);
    setMotifPanel({ side, segmentId, refLabel });
  }, []);

  const selectLink = useCallback((id: string | null) => {
    setSelectedLinkId(id);
    if (id) {
      setMotifPanel(null);
      setSelectedParallelId(null);
    }
  }, []);

  const handleArcClick = useCallback(
    (arc: MotifArc) => {
      if (arc.kind === "parallel" && arc.parallelId) {
        setSelectedLinkId(null);
        setMotifPanel(null);
        setSelectedParallelId(arc.parallelId);
        return;
      }
      openMotifPanel("left", arc.leftSegmentId, arc.leftRef);
    },
    [openMotifPanel],
  );

  // From the inspector: put the NT passage on the left, Josephus on the
  // right, scrolled to both verses.
  const openParallelPair = useCallback(
    (p: Parallel) => {
      if (!p.leftSegmentId || !p.rightSegmentId) return;
      setViews({
        left: { mode: "book", bookId: p.leftDocumentId },
        right: { mode: "book", bookId: p.rightDocumentId },
      });
      setScrollTargets({ left: p.leftSegmentId, right: p.rightSegmentId });
      setLeftSelection(null);
      setRightSelection(null);
    },
    [],
  );

  const selectedParallel = parallels.find((p) => p.id === selectedParallelId) ?? null;
  const [hoveredParallelIds, setHoveredParallelIds] = useState<string[]>([]);

  // A parallel's full verse RANGE (the range end lives in the ref string,
  // e.g. "Luke 23:50-53"; the stored segment is the range head).
  const parallelRangeIds = useCallback((segId: string | null, ref: string): string[] => {
    if (!segId) return [];
    const m = segId.match(/^seg-(.+)-(\d+)-(\d+)$/);
    if (!m) return [];
    const [, doc, ch, v] = m;
    const endM = ref.match(/:(\d+)\s*[-–]\s*(\d+)\s*$/);
    const start = Number(v);
    const end = endM ? Number(endM[2]) : start;
    const ids: string[] = [];
    for (let i = start; i <= Math.max(start, end); i++) ids.push(`seg-${doc}-${ch}-${i}`);
    return ids;
  }, []);

  // Every segment that belongs to some parallel's range -> the parallels
  // touching it (for hover-to-illuminate on the text itself).
  const parallelsBySegment = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of parallels) {
      const ids = [
        ...parallelRangeIds(p.leftSegmentId, p.leftRef),
        ...parallelRangeIds(p.rightSegmentId, p.rightRef),
      ];
      for (const id of ids) {
        const list = map.get(id) ?? [];
        list.push(p.id);
        map.set(id, list);
      }
    }
    return map;
  }, [parallels, parallelRangeIds]);

  const assignToSides = useCallback(
    (ids: string[]): Record<PaneSide, Set<string>> => {
      const sets: Record<PaneSide, Set<string>> = { left: new Set(), right: new Set() };
      (["left", "right"] as PaneSide[]).forEach((side) => {
        const view = side === "left" ? views.left : views.right;
        if (view?.mode !== "book") return;
        for (const id of ids) if (id.startsWith(`seg-${view.bookId}-`)) sets[side].add(id);
      });
      return sets;
    },
    [views],
  );

  // Persistent highlight: the open inspector's parallel (fades in, settles).
  const parallelHighlights = useMemo(() => {
    if (!selectedParallel) return { left: new Set<string>(), right: new Set<string>() };
    return assignToSides([
      ...parallelRangeIds(selectedParallel.leftSegmentId, selectedParallel.leftRef),
      ...parallelRangeIds(selectedParallel.rightSegmentId, selectedParallel.rightRef),
    ]);
  }, [selectedParallel, parallelRangeIds, assignToSides]);

  // Transient highlight: parallels under the cursor (arc hover, or hovering a
  // verse inside a parallel's range) — instant, both sides.
  const hoverHighlights = useMemo(() => {
    if (hoveredParallelIds.length === 0)
      return { left: new Set<string>(), right: new Set<string>() };
    const ids: string[] = [];
    for (const pid of hoveredParallelIds) {
      const p = parallels.find((x) => x.id === pid);
      if (!p) continue;
      ids.push(
        ...parallelRangeIds(p.leftSegmentId, p.leftRef),
        ...parallelRangeIds(p.rightSegmentId, p.rightRef),
      );
    }
    return assignToSides(ids);
  }, [hoveredParallelIds, parallels, parallelRangeIds, assignToSides]);

  // From the overview: load a chapter pair into the reading panes.
  const openOverviewPair = useCallback(
    (leftDoc: string, leftChapter: number, rightDoc: string, rightChapter: number) => {
      setViews({
        left: { mode: "book", bookId: leftDoc },
        right: { mode: "book", bookId: rightDoc },
      });
      setScrollTargets({
        left: `seg-${leftDoc}-${leftChapter}-1`,
        right: `seg-${rightDoc}-${rightChapter}-1`,
      });
      setOverviewOpen(false);
    },
    [],
  );

  // From the drawer, open a referenced passage in the opposite pane and land
  // on the verse (segment ids are deterministic: seg-<doc>-<ch>-<v>). If that
  // pane already shows the book, just scroll — no refetch.
  const navigateOppositePane = useCallback(
    (documentId: string, chapter: number, verse: number) => {
      if (!motifPanel) return;
      const other: PaneSide = motifPanel.side === "left" ? "right" : "left";
      const otherView = other === "left" ? views.left : views.right;
      if (!(otherView?.mode === "book" && otherView.bookId === documentId)) {
        navigate(other, { mode: "book", bookId: documentId });
      }
      setScrollTargets((t) => ({ ...t, [other]: `seg-${documentId}-${chapter}-${verse}` }));
    },
    [motifPanel, views, navigate],
  );

  const consumeScrollTarget = useCallback((side: PaneSide) => {
    setScrollTargets((t) => (t[side] ? { ...t, [side]: null } : t));
  }, []);

  const motifPanelInstances = motifPanel
    ? motifsBySegment[motifPanel.side].get(motifPanel.segmentId) ?? []
    : [];

  const deleteAnchor = useCallback(
    async (anchorId: string) => {
      setBusy(true);
      try {
        await api.deleteAnchor(anchorId);
        if (draftSourceId === anchorId) setDraftSourceId(null);
        if (draftTargetId === anchorId) setDraftTargetId(null);
        const openLink = data?.links.find((l) => l.id === selectedLinkId);
        if (
          openLink &&
          (openLink.sourceAnchorId === anchorId || openLink.targetAnchorId === anchorId)
        ) {
          setSelectedLinkId(null);
        }
        await Promise.all([reload(), fetchSide("left", views.left), fetchSide("right", views.right)]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [draftSourceId, draftTargetId, selectedLinkId, data, reload, fetchSide, views],
  );

  // --- link creation / deletion ----------------------------------------------

  const createLink = useCallback(
    async (input: { type: RelationshipType; title: string; rationale: string }) => {
      if (!draftSourceId || !draftTargetId) return;
      setBusy(true);
      try {
        const link = await api.createLink({
          workspaceId,
          sourceAnchorId: draftSourceId,
          targetAnchorId: draftTargetId,
          type: input.type,
          title: input.title || null,
          rationale: input.rationale || null,
        });
        clearDraft();
        setLinkModalOpen(false);
        await reload();
        setSelectedLinkId(link.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [draftSourceId, draftTargetId, workspaceId, clearDraft, reload],
  );

  const deleteSelectedLink = useCallback(async () => {
    if (!selectedLinkId) return;
    setBusy(true);
    try {
      await api.deleteLink(selectedLinkId);
      setSelectedLinkId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [selectedLinkId, reload]);

  // --- render ---------------------------------------------------------------

  if (error && !data) {
    return (
      <div className="fatal">
        <h1>Couldn’t load workspace</h1>
        <pre>{error}</pre>
        <p>
          Is the API running on :5179? Try <code>npm run db:setup</code> then{" "}
          <code>npm run dev</code>.
        </p>
      </div>
    );
  }

  if (!data || !views.left || !views.right) {
    return <div className="loading">Loading workspace…</div>;
  }

  const aboutActive = aboutOpen && !startOpen;
  const indexActive = !!indexSection && !startOpen;
  const overviewActive = overviewOpen && !startOpen && !indexSection && !aboutOpen;
  const readingActive = !startOpen && !overviewOpen && !indexSection && !aboutOpen;
  const goReading = () => {
    const params = new URLSearchParams(window.location.search);
    const l = params.get("left") ?? viewToParam(views.left);
    const r = params.get("right") ?? viewToParam(views.right);
    const qs = [l && `left=${l}`, r && `right=${r}`].filter(Boolean).join("&");
    gotoUrl(qs || "reading=1");
  };
  const navItems = [
    { key: "start", label: "Start", active: startOpen, go: () => gotoUrl("start=1") },
    { key: "reading", label: "Reading", active: readingActive, go: goReading },
    { key: "overview", label: "Overview", active: overviewActive, go: () => gotoUrl("overview=1") },
    { key: "index", label: "Index", active: indexActive, go: () => gotoUrl("index=atwill") },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Typologos</div>
        <nav className="main-nav">
          {navItems.map((item) => (
            <button key={item.key} className={item.active ? "active" : ""} onClick={item.go}>
              {item.label}
            </button>
          ))}
          <button className={`nav-about ${aboutActive ? "active" : ""}`} onClick={() => gotoUrl("about=1")}>
            About
          </button>
        </nav>
        <div className="topbar-tools">
          <button
            className="ghost small-ghost tools-toggle"
            aria-label="Tools menu"
            title="Tools"
            onClick={() => setToolsOpen((o) => !o)}
          >
            ⋯
          </button>
          {toolsOpen && (
            <>
              <div className="tools-backdrop" onClick={() => setToolsOpen(false)} />
              <div className="tools-pop" role="menu">
                <button
                  className="tools-about"
                  onClick={() => {
                    setToolsOpen(false);
                    gotoUrl("about=1");
                  }}
                >
                  About
                </button>
                <button
                  title="Download your anchors and links as a portable .json file"
                  onClick={() => {
                    setToolsOpen(false);
                    api
                      .exportLayerToFile()
                      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
                  }}
                >
                  Export layer
                </button>
                <button
                  title="Import a Typologos layer file (merges; duplicates skipped)"
                  onClick={() => {
                    setToolsOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  Import layer
                </button>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const res = await api.importLayerFromFile(file);
                setError(null);
                setImportNote(`Imported ${res.linksAdded} links and ${res.anchorsAdded} anchors`);
                await Promise.all([
                  reload(),
                  fetchSide("left", views.left),
                  fetchSide("right", views.right),
                ]);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            }}
          />
        </div>
      </header>
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <button key={item.key} className={item.active ? "active" : ""} onClick={item.go}>
            {NAV_ICONS[item.key]}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {importNote && (
        <div className="ov-loaded-note" style={{ top: 64 }} onClick={() => setImportNote(null)}>
          {importNote}
        </div>
      )}

      <div className="workspace-main" ref={mainRef}>
        {startOpen && <StartScreen onClose={() => setStartOpen(false)} />}
        {aboutOpen && !startOpen && <AboutPage />}
        {indexSection && !startOpen && (
          <IndexPage
            section={indexSection}
            parallels={parallels}
            links={data.links}
            anchorsById={anchorsById}
            onSectionChange={(s) => gotoUrl(`index=${s}`)}
            onOpenParallel={(p) => {
              const l = segToParam(p.leftSegmentId);
              const r = segToParam(p.rightSegmentId);
              if (l && r) gotoUrl(`left=${l}&right=${r}&parallel=${p.id}`);
            }}
            onOpenLink={(l) => {
              const s = anchorsById.get(l.sourceAnchorId);
              const t = anchorsById.get(l.targetAnchorId);
              const lp = segToParam(s?.segmentId ?? null);
              const rp = segToParam(t?.segmentId ?? null);
              if (lp && rp) {
                gotoUrl(`left=${lp}&right=${rp}`);
              } else {
                // Legacy document-mode anchors: state-only navigation.
                const viewFor = (a: Anchor | undefined): PaneView | null =>
                  a ? { mode: "document", documentId: a.documentId } : null;
                const lv = viewFor(s);
                const rv = viewFor(t);
                if (lv && rv) setViews({ left: lv, right: rv });
                setIndexSection(null);
              }
              selectLink(l.id);
            }}
            onOpenInstance={(documentId, chapter, verse) => {
              const right =
                views.right?.mode === "book" ? `&right=${views.right.bookId}` : "";
              gotoUrl(`left=${documentId}:${chapter}:${verse}${right}`);
            }}
          />
        )}
        {overviewOpen && (
          <Overview
            initialLeft={new URLSearchParams(window.location.search).get("a") ?? undefined}
            initialRight={new URLSearchParams(window.location.search).get("b") ?? undefined}
            hiddenScopes={books.some((b) => b.id.startsWith("xen-")) ? [] : ["anabasis"]}
            onClose={() => setOverviewOpen(false)}
            onOpenPair={openOverviewPair}
            onLoadBook={(side, documentId) =>
              setViews((v) => ({ ...v, [side]: { mode: "book", bookId: documentId } }))
            }
          />
        )}
        <div className="panes">
          {leftData ? (
            <PassagePane
              side="left"
              data={leftData}
              view={views.left}
              books={books}
              draftSourceId={draftSourceId}
              draftTargetId={draftTargetId}
              selectedLinkAnchorIds={selectedLinkAnchorIds}
              linkedAnchorIds={linkedAnchorIds}
              motifsBySegment={motifsBySegment.left}
              highlightSegments={parallelHighlights.left}
              hoverHighlightSegments={hoverHighlights.left}
              parallelSegments={parallelsBySegment}
              onParallelHover={(segId) =>
                setHoveredParallelIds(segId ? parallelsBySegment.get(segId) ?? [] : [])
              }
              scrollTargetKey={scrollTargets.left}
              selection={leftSelection}
              draftAnchor={draftSourceId ? anchorsById.get(draftSourceId) ?? null : null}
              draftLabel="Source"
              busy={busy}
              onCreateAnchor={() => createAnchor("left")}
              onClearDraft={() => setDraftSourceId(null)}
              onDeleteDraftAnchor={() => draftSourceId && deleteAnchor(draftSourceId)}
              onScrollTargetDone={() => consumeScrollTarget("left")}
              onNavigate={(v) => navigate("left", v)}
              onSelectionChange={setLeftSelection}
              onAnchorClick={handleAnchorClick}
              onMotifVerseClick={(block) => openMotifPanel("left", block.segmentId, block.passageRef)}
            />
          ) : (
            <PaneLoading />
          )}
          {rightData ? (
            <PassagePane
              side="right"
              data={rightData}
              view={views.right}
              books={books}
              draftSourceId={draftSourceId}
              draftTargetId={draftTargetId}
              selectedLinkAnchorIds={selectedLinkAnchorIds}
              linkedAnchorIds={linkedAnchorIds}
              motifsBySegment={motifsBySegment.right}
              highlightSegments={parallelHighlights.right}
              hoverHighlightSegments={hoverHighlights.right}
              parallelSegments={parallelsBySegment}
              onParallelHover={(segId) =>
                setHoveredParallelIds(segId ? parallelsBySegment.get(segId) ?? [] : [])
              }
              scrollTargetKey={scrollTargets.right}
              selection={rightSelection}
              draftAnchor={draftTargetId ? anchorsById.get(draftTargetId) ?? null : null}
              draftLabel="Target"
              busy={busy}
              onCreateAnchor={() => createAnchor("right")}
              onClearDraft={() => setDraftTargetId(null)}
              onDeleteDraftAnchor={() => draftTargetId && deleteAnchor(draftTargetId)}
              onScrollTargetDone={() => consumeScrollTarget("right")}
              onNavigate={(v) => navigate("right", v)}
              onSelectionChange={setRightSelection}
              onAnchorClick={handleAnchorClick}
              onMotifVerseClick={(block) => openMotifPanel("right", block.segmentId, block.passageRef)}
            />
          ) : (
            <PaneLoading />
          )}
        </div>

        <MotifArcOverlay
          arcs={motifArcs}
          onArcClick={handleArcClick}
          onArcHover={(arc) =>
            setHoveredParallelIds(
              arc?.kind === "parallel" && arc.parallelId ? [arc.parallelId] : [],
            )
          }
        />

        <ConnectorOverlay
          links={data.links}
          rects={rects.anchors}
          selectedLinkId={selectedLinkId}
          onSelectLink={selectLink}
        />

        {selectedLink && (
          <LinkInspector
            link={selectedLink}
            sourceAnchor={anchorsById.get(selectedLink.sourceAnchorId) ?? null}
            targetAnchor={anchorsById.get(selectedLink.targetAnchorId) ?? null}
            busy={busy}
            onClose={() => setSelectedLinkId(null)}
            onDelete={deleteSelectedLink}
          />
        )}

        {motifPanel && (
          <MotifPanel
            refLabel={motifPanel.refLabel}
            instances={motifPanelInstances}
            onClose={() => setMotifPanel(null)}
            onNavigateRef={navigateOppositePane}
          />
        )}

        {selectedParallel && (
          <ParallelInspector
            parallel={selectedParallel}
            onClose={() => setSelectedParallelId(null)}
            onOpenPair={openParallelPair}
          />
        )}

        {/* Both endpoints staged: offer the link, centered between the panes. */}
        {!overviewOpen && draftSourceId && draftTargetId && !linkModalOpen && (
          <button className="primary create-link-pill" onClick={() => setLinkModalOpen(true)}>
            Create link →
          </button>
        )}
      </div>

      {linkModalOpen && draftSourceId && draftTargetId && (
        <LinkModal
          sourceAnchor={anchorsById.get(draftSourceId)!}
          targetAnchor={anchorsById.get(draftTargetId)!}
          busy={busy}
          onCancel={() => setLinkModalOpen(false)}
          onCreate={createLink}
        />
      )}

      {error && (
        <div className="toast-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
}

