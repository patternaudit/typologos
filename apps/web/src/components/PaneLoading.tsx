import { LoadingIndicator } from "./LoadingIndicator";

// Pane placeholder while a book loads.
export function PaneLoading() {
  return (
    <div className="pane pane-loading">
      <LoadingIndicator label="Loading passage…" />
    </div>
  );
}
