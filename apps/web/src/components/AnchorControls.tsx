import { useState } from "react";
import type { Anchor, RelationshipType } from "@typologos/shared";
import { RELATIONSHIP_TYPES } from "@typologos/shared";
import { RELATIONSHIP_LABELS, colorFor } from "../relationshipStyle";

interface AnchorControlsProps {
  sourceAnchor: Anchor | null;
  targetAnchor: Anchor | null;
  busy: boolean;
  onClear: () => void;
  onCreate: (input: {
    type: RelationshipType;
    title: string;
    rationale: string;
  }) => void;
}

function truncate(text: string, n = 48): string {
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}

// The link builder. Source comes from the left pane, target from the right.
export function AnchorControls({
  sourceAnchor,
  targetAnchor,
  busy,
  onClear,
  onCreate,
}: AnchorControlsProps) {
  const [type, setType] = useState<RelationshipType>("typology");
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");

  const ready = sourceAnchor && targetAnchor;

  const handleCreate = () => {
    if (!ready) return;
    onCreate({ type, title: title.trim(), rationale: rationale.trim() });
    setTitle("");
    setRationale("");
    setType("typology");
  };

  return (
    <div className="link-builder">
      <div className="link-builder-title">Create link</div>

      <div className="draft-anchors">
        <div className={`draft-slot ${sourceAnchor ? "filled" : ""}`}>
          <span className="draft-slot-label">Source · left</span>
          <span className="draft-slot-text">
            {sourceAnchor ? truncate(sourceAnchor.selectedText) : "click a left highlight"}
          </span>
        </div>
        <div className="draft-arrow" style={{ color: colorFor(type) }}>→</div>
        <div className={`draft-slot ${targetAnchor ? "filled" : ""}`}>
          <span className="draft-slot-label">Target · right</span>
          <span className="draft-slot-text">
            {targetAnchor ? truncate(targetAnchor.selectedText) : "click a right highlight"}
          </span>
        </div>
      </div>

      <div className="link-builder-fields">
        <label>
          <span>Relationship</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RelationshipType)}
          >
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {RELATIONSHIP_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Title</span>
          <input
            value={title}
            placeholder="e.g. Beloved son offered by father"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="full">
          <span>Rationale</span>
          <textarea
            value={rationale}
            rows={2}
            placeholder="Why are these connected?"
            onChange={(e) => setRationale(e.target.value)}
          />
        </label>
      </div>

      <div className="link-builder-actions">
        <button className="ghost" onClick={onClear} disabled={busy}>
          Clear
        </button>
        <button className="primary" onClick={handleCreate} disabled={!ready || busy}>
          {busy ? "Linking…" : "Create link"}
        </button>
      </div>
    </div>
  );
}
