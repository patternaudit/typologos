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
import * as api from "../api/client";
import { useAnchorRects } from "../hooks/useAnchorRects";
import type { Block, PaneData, PaneView, PendingSelection } from "../viewTypes";
import { PassagePane } from "./PassagePane";
import { ConnectorOverlay } from "./ConnectorOverlay";
import { LinkModal } from "./LinkModal";
import { LinkInspector } from "./LinkInspector";
import { MotifPanel } from "./MotifPanel";
import { ParallelInspector } from "./ParallelInspector";
import { Overview } from "./Overview";
import { StartScreen } from "./StartScreen";
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

export function Workspace({ workspaceId }: WorkspaceProps) {
  const [data, setData] = useState<HydratedWorkspace | null>(null);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [views, setViews] = useState<SideViews>({ left: null, right: null });
  const [sideBooks, setSideBooks] = useState<SideBooks>({ left: null, right: null });
  const [motifs, setMotifs] = useState<SideMotifs>({ left: [], right: [] });
  const [parallels, setParallels] = useState<Parallel[]>([]);
  const [selectedParallelId, setSelectedParallelId] = useState<string | null>(null);
  const [motifPanel, setMotifPanel] = useState<MotifPanelState | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(
    () => new URLSearchParams(window.location.search).get("overview") === "1",
  );
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  // Land on the curated start screen when arriving with no saved place and no
  // deep link; reopenable from the topbar.
  const [startOpen, setStartOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("start") === "1") return true;
    if ([...params.keys()].length > 0) return false;
    return localStorage.getItem(`typologos:views:${workspaceId}`) === null;
  });
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
  const viewsKey = `typologos:views:${workspaceId}`;
  const bumpLayout = useCallback(() => setVersion((v) => v + 1), []);

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
    if (!leftPane || !rightPane) return;

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
    // Deep links win over saved state: ?left=kjv-Exod (whole book),
    // ?left=kjv-Exod:3:2 (book, scrolled to a verse; verse defaults to 1),
    // or ?left=doc:<documentId> for legacy standalone documents.
    const params = new URLSearchParams(window.location.search);
    const fromParam = (
      raw: string | null,
    ): { view: PaneView; target: string | null } | null => {
      if (!raw) return null;
      if (raw.startsWith("doc:")) {
        return { view: { mode: "document", documentId: raw.slice(4) }, target: null };
      }
      const [bookId, ch, v] = raw.split(":");
      const target = ch ? `seg-${bookId}-${Number(ch)}-${v ? Number(v) : 1}` : null;
      return { view: { mode: "book", bookId }, target };
    };
    const qLeft = fromParam(params.get("left"));
    const qRight = fromParam(params.get("right"));
    setViews({
      left:
        qLeft?.view ?? savedLeft ?? { mode: "document", documentId: leftPane.document.id },
      right:
        qRight?.view ?? savedRight ?? { mode: "document", documentId: rightPane.document.id },
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Typologos</div>
        <nav className="view-switch">
          <button
            className={startOpen ? "active" : ""}
            onClick={() => {
              setStartOpen(true);
              setOverviewOpen(false);
            }}
          >
            Start
          </button>
          <button
            className={!overviewOpen && !startOpen ? "active" : ""}
            onClick={() => {
              setOverviewOpen(false);
              setStartOpen(false);
            }}
          >
            Reading
          </button>
          <button
            className={overviewOpen && !startOpen ? "active" : ""}
            onClick={() => {
              setOverviewOpen(true);
              setStartOpen(false);
            }}
          >
            Overview
          </button>
        </nav>
      </header>

      <div className="workspace-main" ref={mainRef}>
        {startOpen && <StartScreen onClose={() => setStartOpen(false)} />}
        {overviewOpen && (
          <Overview
            initialLeft={new URLSearchParams(window.location.search).get("a") ?? undefined}
            initialRight={new URLSearchParams(window.location.search).get("b") ?? undefined}
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
            <div className="pane pane-loading">Loading passage…</div>
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
            <div className="pane pane-loading">Loading passage…</div>
          )}
        </div>

        <MotifArcOverlay arcs={motifArcs} onArcClick={handleArcClick} />

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

