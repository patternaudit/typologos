import { useEffect, useMemo, useState } from "react";
import type { Anchor, Link, MotifDetail, MotifSummary, Parallel } from "@typologos/shared";
import * as api from "../data";
import { LoadingIndicator } from "./LoadingIndicator";

// The Index: a browsable table of contents, one layer at a time. The active
// section lives in the URL (?index=atwill|mason|wilson|links) so the browser
// back button returns here after opening an item.

export type IndexSection = "atwill" | "mason" | "wilson" | "control" | "links";

export const INDEX_SECTIONS: {
  slug: IndexSection;
  label: string;
  heading: string;
  color: string;
  blurb: string;
}[] = [
  {
    slug: "atwill",
    label: "Caesar's Messiah",
    heading: "Caesar's Messiah by Joseph Atwill",
    color: "#4a6b8a",
    blurb:
      "The 34-step Flavian Signature sequence: claimed parallels between the New Testament and Josephus, in Atwill's order, with textual-check verdicts.",
  },
  {
    slug: "mason",
    label: "Did Luke read Josephus?",
    heading: "Did Luke read Josephus? — the mainstream hypothesis",
    color: "#7d5a86",
    blurb:
      "The classic source-critical touchpoints (Krenkel 1894; Mason 1992; Pervo 2006) for Luke-Acts' knowledge of Josephus.",
  },
  {
    slug: "wilson",
    label: "Wilson's dictionary",
    heading: "Wilson's types & figures",
    color: "#b8742a",
    blurb:
      "Every symbol headword from Wilson's Dictionary of Bible Types. Click one to list its passages; click a passage to open it in the left pane.",
  },
  {
    slug: "control",
    label: "Control experiment",
    heading: "Control: Luke ↔ Xenophon's Anabasis",
    color: "#2f7d74",
    blurb:
      "The base-rate check: parallels a motivated reader can mine between Luke and a text nobody claims Luke read, under pre-registered rules, graded with the identical standard.",
  },
  {
    slug: "links",
    label: "My links",
    heading: "My links",
    color: "#3a8a5f",
    blurb: "Links you create between anchored passages.",
  },
];

const SECTION_SOURCE: Record<string, string> = {
  atwill: "atwill-cm",
  mason: "mason-dependence",
  control: "control-anabasis",
};

interface IndexPageProps {
  section: IndexSection;
  parallels: Parallel[];
  links: Link[];
  anchorsById: Map<string, Anchor>;
  onSectionChange: (s: IndexSection) => void;
  onOpenParallel: (p: Parallel) => void;
  onOpenLink: (l: Link) => void;
  onOpenInstance: (documentId: string, chapter: number, verse: number) => void;
}

export function IndexPage({
  section,
  parallels,
  links,
  anchorsById,
  onSectionChange,
  onOpenParallel,
  onOpenLink,
  onOpenInstance,
}: IndexPageProps) {
  const [filter, setFilter] = useState("");
  const [motifs, setMotifs] = useState<MotifSummary[]>([]);
  const [motifsLoading, setMotifsLoading] = useState(false);
  const [openMotif, setOpenMotif] = useState<MotifDetail | null>(null);

  useEffect(() => {
    if (section === "wilson" && motifs.length === 0) {
      setMotifsLoading(true);
      api
        .fetchMotifIndex()
        .then(setMotifs)
        .catch(() => setMotifs([]))
        .finally(() => setMotifsLoading(false));
    }
  }, [section, motifs.length]);

  const meta = INDEX_SECTIONS.find((s) => s.slug === section) ?? INDEX_SECTIONS[0];
  const q = filter.trim().toLowerCase();
  const matches = (...texts: (string | null | undefined)[]) =>
    !q || texts.some((t) => t?.toLowerCase().includes(q));

  const sectionParallels = useMemo(
    () =>
      parallels.filter(
        (p) =>
          p.source === SECTION_SOURCE[section] &&
          matches(p.title, p.leftRef, p.rightRef, p.claim),
      ),
    [parallels, section, q],
  );

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
          <nav className="index-tabs">
            {INDEX_SECTIONS.map((s) => (
              <button
                key={s.slug}
                className={s.slug === section ? "active" : ""}
                style={s.slug === section ? { background: s.color } : undefined}
                onClick={() => onSectionChange(s.slug)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        <section className="index-section">
          <h2 style={{ borderLeftColor: meta.color }}>
            {meta.heading}{" "}
            <span className="index-count">
              (
              {section === "wilson"
                ? `${visibleMotifs.length} symbols`
                : section === "links"
                  ? visibleLinks.length
                  : sectionParallels.length}
              )
            </span>
          </h2>
          <p className="index-blurb">{meta.blurb}</p>
          <input
            className="index-filter"
            placeholder="Filter by title, reference, or symbol…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          {(section === "atwill" || section === "mason" || section === "control") && (
            <div className="index-rows">
              {sectionParallels.map((p) => (
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
          )}

          {section === "wilson" && (
            <>
              {motifsLoading && <LoadingIndicator label="Loading the symbol index…" />}
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
            </>
          )}

          {section === "links" && (
            <div className="index-rows">
              {visibleLinks.length === 0 && (
                <p className="index-blurb">
                  Select text in each pane, anchor it, and create a link — it will be listed
                  here.
                </p>
              )}
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
          )}
        </section>
      </div>
    </div>
  );
}
