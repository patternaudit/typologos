import type { RelationshipType } from "@typologos/shared";

// One accent color per relationship type. Used for connectors and chips so the
// theology reads visually at a glance.
export const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  typology: "#b8742a", // warm amber — the headline relationship
  quotation: "#2f6f8f",
  allusion: "#6a5acd",
  parallel: "#3a8a5f",
  contrast: "#b0413e",
  historical_context: "#7a6c54",
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  typology: "Typology",
  quotation: "Quotation",
  allusion: "Allusion",
  parallel: "Parallel",
  contrast: "Contrast",
  historical_context: "Historical context",
};

export function colorFor(type: RelationshipType): string {
  return RELATIONSHIP_COLORS[type] ?? "#888";
}
