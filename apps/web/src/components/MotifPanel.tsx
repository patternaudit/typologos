import { useEffect, useState } from "react";
import type { MotifConfidence, MotifDetail, PassageMotifInstance } from "@typologos/shared";
import * as api from "../data";

// Wilson's own grading: abbreviated inline (the footer legend explains it),
// fuller wording on hover.
const GRADE_TITLES: Record<MotifConfidence, string> = {
  a: "Wilson grade (a): Scripture itself identifies this as a type",
  b: "Wilson grade (b): typical meaning evident from usage",
  c: "Wilson grade (c): suggested reading, offered devotionally",
};

interface MotifPanelProps {
  refLabel: string; // the verse the panel is showing, e.g. "Genesis 22:7"
  instances: PassageMotifInstance[];
  onClose: () => void;
  // Open a referenced passage in the opposite pane, landing on the verse.
  onNavigateRef: (documentId: string, chapter: number, verse: number) => void;
}

export function MotifPanel({ refLabel, instances, onClose, onNavigateRef }: MotifPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Map<string, MotifDetail>>(new Map());

  // Collapse any expansion when the panel moves to another verse.
  useEffect(() => {
    setExpandedId(null);
  }, [refLabel]);

  const toggleExpand = (motifId: string) => {
    if (expandedId === motifId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(motifId);
    if (!details.has(motifId)) {
      api
        .fetchMotifDetail(motifId)
        .then((d) => setDetails((prev) => new Map(prev).set(motifId, d)))
        .catch(() => {});
    }
  };

  return (
    <aside className="inspector motif-panel">
      <div className="inspector-header">
        <span className="inspector-label motif-panel-kicker">Types &amp; figures</span>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <h2 className="inspector-title">{refLabel}</h2>

      {instances.length === 0 && (
        <p className="motif-empty">No typological readings recorded for this verse.</p>
      )}

      {instances.map((inst) => {
        const detail = details.get(inst.motifId);
        const expanded = expandedId === inst.motifId;
        return (
          <div className="motif-item" key={inst.id}>
            <div className="motif-item-head">
              <span className="motif-headword">{inst.headword}</span>
              <span className="motif-grade" title={GRADE_TITLES[inst.confidence]}>
                ({inst.confidence})
              </span>
            </div>
            <p className="motif-rationale">{inst.rationale}</p>
            <button className="ghost motif-expand" onClick={() => toggleExpand(inst.motifId)}>
              {expanded ? "Hide passages" : `Everywhere “${inst.headword}” appears`}
            </button>
            {expanded && (
              <div className="motif-refs">
                {!detail && <span className="motif-refs-loading">Loading…</span>}
                {detail?.instances.map((mi) => {
                  const isCurrent = mi.id === inst.id;
                  return (
                    <button
                      key={mi.id}
                      className={`motif-ref-pill ${isCurrent ? "current" : ""}`}
                      disabled={isCurrent}
                      title={
                        isCurrent
                          ? "This verse"
                          : `Open ${mi.ref} in the other pane · grade (${mi.confidence})`
                      }
                      onClick={() => onNavigateRef(mi.documentId, mi.chapter, mi.verse)}
                    >
                      {mi.ref}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p className="motif-panel-note">
        From Walter L. Wilson, <em>A Dictionary of Bible Types</em>. Grades are Wilson's own:
        (a) named a type by Scripture, (b) evident from usage, (c) suggested.
      </p>
    </aside>
  );
}
