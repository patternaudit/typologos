import { useEffect, useMemo, useState } from "react";
import type { Anchor, Link, MotifDetail, MotifSummary, Parallel } from "@typologos/shared";
import * as api from "../data";

// The Index: a browsable table of contents for every connection layer.
// Parallels grouped by source (click a row to open the pair with its claim
// inspector), a searchable Wilson motif index with expandable instances, and
// the user's own links.

interface IndexPageProps {
  parallels: Parallel[];
  links: Link[];
  anchorsById: Map<string, Anchor>;
  onOpenParallel: (p: Parallel) => void;
  onOpenLink: (l: Link) => void;
  onOpenInstance: (documentId: string, chapter: number, verse: number) => void;
}

const SOURCE_META: Record<string, { heading: string; color: string; blurb: string }> = {
  "atwill-cm": {
    heading: "Caesar's Messiah — the Flavian Signature sequence",
    color: "#4a6b8a",
    blurb:
      "Joseph Atwill's 34 claimed parallels between the New Testament and Josephus, in his order, with textual-check verdicts.",
  },
  "mason-dependence": {
    heading: "Did Luke read Josephus? — dependence touchpoints",
    color: "#7d5a86",
    blurb:
      "The classic source-critical touchpoints (Krenkel 1894; Mason 1992; Pervo 2006) for Luke-Acts' knowledge of Josephus.",
  },
};

export function IndexPage({
  parallels,
  links,
  anchorsById,
  onOpenParallel,
  onOpenLink,
  onOpenInstance,
}: IndexPageProps) {
  const [filter, setFilter] = useState("");
  const [motifs, setMotifs] = useState<MotifSummary[]>([]);
  const [openMotif, setOpenMotif] = useState<MotifDetail | null>(null);

  useEffect(() => {
    api.fetchMotifIndex().then(setMotifs).catch(() => setMotifs([]));
  }, []);

  const q = filter.trim().toLowerCase();
  const matches = (...texts: (string | null | undefined)[]) =>
    !q || texts.some((t) => t?.toLowerCase().includes(q));

  const bySource = useMemo(() => {
    const groups = new Map<string, Parallel[]>();
    for (const p of parallels) {
      if (!matches(p.title, p.leftRef, p.rightRef, p.claim)) continue;
      const list = groups.get(p.source) ?? [];
      list.push(p);
      groups.set(p.source, list);
    }
    return groups;
  }, [parallels, q]);

  const visibleMotifs = useMemo(
    () => motifs.filter((m) => matches(m.headword)),
    [motifs, q],
  );

  const visibleLinks = useMemo(
    () =>
      links.filter((l) => {
        const s = anchorsById.get(l.sourceAnchorId);
        const t = anchorsById.get(l.targetAnchorId);
        return matches(l.title, l.type, s?.passageRef, t?.passageRef, s?.selectedText, t?.selectedText);
      }),
    [links, anchorsById, q],
  );

  const expandMotif = (m: MotifSummary) => {
    if (openMotif?.motif.id === m.id) {
      setOpenMotif(null);
      return;
    }
    api.fetchMotifDetail(m.id).then(setOpenMotif).catch(() => {});
  };

  return (
    <div className="index-page">
      <div className="index-inner">
        <div className="index-head">
          <h1>Index</h1>
          <input
            className="index-filter"
            placeholder="Filter by title, reference, or symbol…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {[...bySource.entries()].map(([source, list]) => {
          const meta = SOURCE_META[source] ?? {
            heading: source,
            color: "#9b9183",
            blurb: "",
          };
          return (
            <section key={source} className="index-section">
              <h2 style={{ borderLeftColor: meta.color }}>
                {meta.heading} <span className="index-count">({list.length})</span>
              </h2>
              {meta.blurb && <p className="index-blurb">{meta.blurb}</p>}
              <div className="index-rows">
                {list.map((p) => (
                  <button key={p.id} className="index-row" onClick={() => onOpenParallel(p)}>
                    <span className="index-row-num">#{p.position}</span>
                    <span className="index-row-title">{p.title}</span>
                    <span className="index-row-refs">
                      {p.leftRef} ↔ {p.rightRef}
                    </span>
                    <span className={`verdict-chip verdict-${p.verdict}`}>{p.verdict}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <section className="index-section">
          <h2 style={{ borderLeftColor: "#b8742a" }}>
            Wilson's types &amp; figures{" "}
            <span className="index-count">({visibleMotifs.length} symbols)</span>
          </h2>
          <p className="index-blurb">
            Every symbol headword from Wilson's <em>Dictionary of Bible Types</em>. Click one to
            list its passages; click a passage to open it in the left pane.
          </p>
          {openMotif && (
            <div className="index-motif-detail">
              <div className="motif-item-head">
                <span className="motif-headword">{openMotif.motif.headword}</span>
                <button className="icon-button" onClick={() => setOpenMotif(null)}>
                  ✕
                </button>
              </div>
              <div className="motif-refs">
                {openMotif.instances.map((mi) => (
                  <button
                    key={mi.id}
                    className="motif-ref-pill"
                    onClick={() => onOpenInstance(mi.documentId, mi.chapter, mi.verse)}
                  >
                    {mi.ref} ({mi.confidence})
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="index-motifs">
            {visibleMotifs.map((m) => (
              <button
                key={m.id}
                className={`index-motif ${openMotif?.motif.id === m.id ? "active" : ""}`}
                onClick={() => expandMotif(m)}
              >
                {m.headword} <span className="index-count">{m.instanceCount}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="index-section">
          <h2 style={{ borderLeftColor: "#3a8a5f" }}>
            My links <span className="index-count">({visibleLinks.length})</span>
          </h2>
          {visibleLinks.length === 0 && (
            <p className="index-blurb">
              Links you create between anchored passages will be listed here.
            </p>
          )}
          <div className="index-rows">
            {visibleLinks.map((l) => {
              const s = anchorsById.get(l.sourceAnchorId);
              const t = anchorsById.get(l.targetAnchorId);
              return (
                <button key={l.id} className="index-row" onClick={() => onOpenLink(l)}>
                  <span className="index-row-title">{l.title || l.type}</span>
                  <span className="index-row-refs">
                    {s?.passageRef ?? "?"} ↔ {t?.passageRef ?? "?"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
