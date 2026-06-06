import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Anchor,
  HydratedWorkspace,
  PaneSide,
  RelationshipType,
} from "@typologos/shared";
import * as api from "../api/client";
import { useAnchorRects } from "../hooks/useAnchorRects";
import type { SelectionOffsets } from "../hooks/useTextSelection";
import { PassagePane } from "./PassagePane";
import { ConnectorOverlay } from "./ConnectorOverlay";
import { AnchorControls } from "./AnchorControls";
import { LinkInspector } from "./LinkInspector";

interface WorkspaceProps {
  workspaceId: string;
}

export function Workspace({ workspaceId }: WorkspaceProps) {
  const [data, setData] = useState<HydratedWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  const [leftSelection, setLeftSelection] = useState<SelectionOffsets | null>(null);
  const [rightSelection, setRightSelection] = useState<SelectionOffsets | null>(null);
  const [draftSourceId, setDraftSourceId] = useState<string | null>(null);
  const [draftTargetId, setDraftTargetId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    try {
      const next = await api.fetchWorkspace(workspaceId);
      setData(next);
      setVersion((v) => v + 1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [workspaceId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const rects = useAnchorRects(mainRef, version);

  const leftPane = data?.panes.find((p) => p.side === "left") ?? null;
  const rightPane = data?.panes.find((p) => p.side === "right") ?? null;

  // Index every anchor by id, and remember which side it lives on.
  const { anchorsById, sideByAnchorId } = useMemo(() => {
    const byId = new Map<string, Anchor>();
    const sideById = new Map<string, PaneSide>();
    for (const pane of data?.panes ?? []) {
      for (const a of pane.anchors) {
        byId.set(a.id, a);
        sideById.set(a.id, pane.side);
      }
    }
    return { anchorsById: byId, sideByAnchorId: sideById };
  }, [data]);

  const linkedAnchorIds = useMemo(() => {
    const set = new Set<string>();
    for (const link of data?.links ?? []) {
      set.add(link.sourceAnchorId);
      set.add(link.targetAnchorId);
    }
    return set;
  }, [data]);

  const selectedLink = data?.links.find((l) => l.id === selectedLinkId) ?? null;
  const selectedLinkAnchorIds = useMemo(() => {
    if (!selectedLink) return new Set<string>();
    return new Set([selectedLink.sourceAnchorId, selectedLink.targetAnchorId]);
  }, [selectedLink]);

  // --- anchor creation -------------------------------------------------------

  const createAnchor = useCallback(
    async (side: PaneSide) => {
      const pane = side === "left" ? leftPane : rightPane;
      const selection = side === "left" ? leftSelection : rightSelection;
      if (!pane || !selection) return;
      setBusy(true);
      try {
        const anchor = await api.createAnchor({
          documentId: pane.document.id,
          passageRef: pane.document.reference,
          startOffset: selection.start,
          endOffset: selection.end,
          selectedText: selection.text,
        });
        window.getSelection()?.removeAllRanges();
        if (side === "left") {
          setLeftSelection(null);
          setDraftSourceId(anchor.id);
        } else {
          setRightSelection(null);
          setDraftTargetId(anchor.id);
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [leftPane, rightPane, leftSelection, rightSelection, reload],
  );

  // --- draft picking ---------------------------------------------------------

  const handleAnchorClick = useCallback(
    (anchor: Anchor) => {
      const side = sideByAnchorId.get(anchor.id);
      if (side === "left") setDraftSourceId(anchor.id);
      else if (side === "right") setDraftTargetId(anchor.id);
    },
    [sideByAnchorId],
  );

  const clearDraft = useCallback(() => {
    setDraftSourceId(null);
    setDraftTargetId(null);
  }, []);

  const deleteAnchor = useCallback(
    async (anchorId: string) => {
      setBusy(true);
      try {
        await api.deleteAnchor(anchorId);
        if (draftSourceId === anchorId) setDraftSourceId(null);
        if (draftTargetId === anchorId) setDraftTargetId(null);
        // If the open inspector belonged to a link that referenced this anchor,
        // that link is gone now — close it.
        const openLink = data?.links.find((l) => l.id === selectedLinkId);
        if (
          openLink &&
          (openLink.sourceAnchorId === anchorId || openLink.targetAnchorId === anchorId)
        ) {
          setSelectedLinkId(null);
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [draftSourceId, draftTargetId, selectedLinkId, data, reload],
  );

  // --- link creation / deletion ---------------------------------------------

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
        <p>Is the API running on :5179? Try <code>npm run db:setup</code> then <code>npm run dev</code>.</p>
      </div>
    );
  }

  if (!data || !leftPane || !rightPane) {
    return <div className="loading">Loading workspace…</div>;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Typologos</div>
        <div className="ws-title">{data.workspace.title}</div>
        <div className="selection-actions">
          <SelectionAction
            label={leftPane.document.title}
            selection={leftSelection}
            disabled={busy}
            onCreate={() => createAnchor("left")}
          />
          <SelectionAction
            label={rightPane.document.title}
            selection={rightSelection}
            disabled={busy}
            onCreate={() => createAnchor("right")}
          />
        </div>
      </header>

      <div className="workspace-main" ref={mainRef}>
        <div className="panes">
          <PassagePane
            pane={leftPane}
            draftSourceId={draftSourceId}
            draftTargetId={draftTargetId}
            selectedLinkAnchorIds={selectedLinkAnchorIds}
            linkedAnchorIds={linkedAnchorIds}
            onSelectionChange={setLeftSelection}
            onAnchorClick={handleAnchorClick}
          />
          <PassagePane
            pane={rightPane}
            draftSourceId={draftSourceId}
            draftTargetId={draftTargetId}
            selectedLinkAnchorIds={selectedLinkAnchorIds}
            linkedAnchorIds={linkedAnchorIds}
            onSelectionChange={setRightSelection}
            onAnchorClick={handleAnchorClick}
          />
        </div>

        <ConnectorOverlay
          links={data.links}
          rects={rects}
          selectedLinkId={selectedLinkId}
          onSelectLink={setSelectedLinkId}
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
      </div>

      <footer className="builder-bar">
        <AnchorControls
          sourceAnchor={draftSourceId ? anchorsById.get(draftSourceId) ?? null : null}
          targetAnchor={draftTargetId ? anchorsById.get(draftTargetId) ?? null : null}
          busy={busy}
          onClear={clearDraft}
          onCreate={createLink}
          onDeleteAnchor={deleteAnchor}
        />
      </footer>

      {error && <div className="toast-error" onClick={() => setError(null)}>{error}</div>}
    </div>
  );
}

interface SelectionActionProps {
  label: string;
  selection: SelectionOffsets | null;
  disabled: boolean;
  onCreate: () => void;
}

function SelectionAction({ label, selection, disabled, onCreate }: SelectionActionProps) {
  return (
    <div className={`selection-action ${selection ? "active" : ""}`}>
      <span className="selection-action-label">{label}</span>
      <button
        className="primary small"
        disabled={!selection || disabled}
        onClick={onCreate}
        title={selection ? `“${selection.text.slice(0, 60)}”` : "Select text in this passage first"}
      >
        + Anchor
      </button>
    </div>
  );
}
