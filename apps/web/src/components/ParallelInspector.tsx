import type { Parallel } from "@typologos/shared";

interface ParallelInspectorProps {
  parallel: Parallel;
  onClose: () => void;
  // Open both endpoints side by side.
  onOpenPair: (p: Parallel) => void;
}

const VERDICT_TITLES: Record<Parallel["verdict"], string> = {
  supported: "Textual check: the corresponding elements are literally present in both passages",
  partial: "Textual check: quotes are faithful, but the correspondence depends on interpretation",
  unsupported: "Textual check: the cited passage does not contain the claimed content",
  unchecked: "Not yet checked against the source texts",
};

// Right-rail inspector for a claimed parallel (Atwill layer): the claim, both
// quoted passages, and the verification verdict from checking the actual
// texts.
export function ParallelInspector({ parallel, onClose, onOpenPair }: ParallelInspectorProps) {
  return (
    <aside className="inspector parallel-inspector">
      <div className="inspector-header">
        <span
          className={`verdict-chip verdict-${parallel.verdict}`}
          title={VERDICT_TITLES[parallel.verdict]}
        >
          {parallel.verdict}
        </span>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <h2 className="inspector-title">{parallel.title}</h2>
      {parallel.claim && <p className="parallel-claim">{parallel.claim}</p>}

      <div className="inspector-section">
        <div className="inspector-label">New Testament · {parallel.leftRef}</div>
        <blockquote>{parallel.leftQuote ?? "—"}</blockquote>
      </div>

      <div className="inspector-section">
        <div className="inspector-label">
          {parallel.rightDocumentId.startsWith("xen-") ? "Xenophon" : "Josephus"} ·{" "}
          {parallel.rightRef}
        </div>
        <blockquote>{parallel.rightQuote ?? "—"}</blockquote>
      </div>

      {parallel.verification && (
        <div className="inspector-section">
          <div className="inspector-label">Verification</div>
          <p className="inspector-rationale">{parallel.verification}</p>
        </div>
      )}

      <div className="inspector-actions">
        <button onClick={() => onOpenPair(parallel)}>Open both passages</button>
      </div>

      <p className="motif-panel-note">
        {parallel.source === "control-anabasis" ? (
          <>
            From the control experiment: a parallel mined between Luke and Xenophon's{" "}
            <em>Anabasis</em> — a text nobody claims Luke read — under pre-registered rules,
            graded with the same standard as the Atwill layer. It measures what a motivated
            reader can find, not a real dependence.
          </>
        ) : parallel.source === "mason-dependence" ? (
          <>
            From the "Luke used Josephus" source hypothesis (Krenkel 1894; Mason 1992;
            Pervo 2006). Verification checks the cited texts only — not the dependence
            conclusion.
          </>
        ) : (
          <>
            From Joseph Atwill, <em>Caesar's Messiah</em> (Flavian Signature Edition), ch. 5.
            Verification checks the cited texts only — not the authorship thesis.
          </>
        )}
      </p>
    </aside>
  );
}
