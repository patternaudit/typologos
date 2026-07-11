import { useState } from "react";
import type { Anchor, RelationshipType } from "@typologos/shared";
import { RELATIONSHIP_TYPES } from "@typologos/shared";
import { RELATIONSHIP_LABELS } from "../relationshipStyle";

interface LinkModalProps {
  sourceAnchor: Anchor;
  targetAnchor: Anchor;
  busy: boolean;
  onCancel: () => void;
  onCreate: (input: { type: RelationshipType; title: string; rationale: string }) => void;
}

// Modal dialog for defining a link once both endpoints are staged.
export function LinkModal({ sourceAnchor, targetAnchor, busy, onCancel, onCreate }: LinkModalProps) {
  const [type, setType] = useState<RelationshipType>("typology");
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Create link</h2>

        <div className="modal-endpoints">
          <blockquote>
            <div className="inspector-label">Source · {sourceAnchor.passageRef}</div>
            {sourceAnchor.selectedText}
          </blockquote>
          <span className="draft-arrow">→</span>
          <blockquote>
            <div className="inspector-label">Target · {targetAnchor.passageRef}</div>
            {targetAnchor.selectedText}
          </blockquote>
        </div>

        <div className="link-builder-fields">
          <label>
            Relationship
            <select value={type} onChange={(e) => setType(e.target.value as RelationshipType)}>
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RELATIONSHIP_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Beloved son offered by father"
            />
          </label>
          <label className="full">
            Rationale
            <textarea
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why are these connected?"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => onCreate({ type, title, rationale })}
          >
            {busy ? "Creating…" : "Create link"}
          </button>
        </div>
      </div>
    </div>
  );
}
