import type { Anchor, Link } from "@typologos/shared";
import { RELATIONSHIP_LABELS, colorFor } from "../relationshipStyle";

interface LinkInspectorProps {
  link: Link;
  sourceAnchor: Anchor | null;
  targetAnchor: Anchor | null;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function LinkInspector({
  link,
  sourceAnchor,
  targetAnchor,
  busy,
  onClose,
  onDelete,
}: LinkInspectorProps) {
  const color = colorFor(link.type);
  return (
    <aside className="inspector">
      <div className="inspector-header">
        <span className="type-chip" style={{ background: color }}>
          {RELATIONSHIP_LABELS[link.type] ?? link.type}
        </span>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <h2 className="inspector-title">{link.title || "Untitled link"}</h2>

      <div className="inspector-section">
        <div className="inspector-label">
          Source {sourceAnchor ? `· ${sourceAnchor.passageRef}` : ""}
        </div>
        <blockquote style={{ borderColor: color }}>
          {sourceAnchor ? sourceAnchor.selectedText : "—"}
        </blockquote>
      </div>

      <div className="inspector-section">
        <div className="inspector-label">
          Target {targetAnchor ? `· ${targetAnchor.passageRef}` : ""}
        </div>
        <blockquote style={{ borderColor: color }}>
          {targetAnchor ? targetAnchor.selectedText : "—"}
        </blockquote>
      </div>

      {link.rationale && (
        <div className="inspector-section">
          <div className="inspector-label">Rationale</div>
          <p className="inspector-rationale">{link.rationale}</p>
        </div>
      )}

      <div className="inspector-actions">
        <button className="danger" onClick={onDelete} disabled={busy}>
          {busy ? "Deleting…" : "Delete link"}
        </button>
      </div>
    </aside>
  );
}
