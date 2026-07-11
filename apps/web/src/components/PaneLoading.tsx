import { useEffect, useState } from "react";
import { dataMode, getLoadStats } from "../data";

// Pane placeholder while a book loads. In static mode the corpus streams in
// 4KB pages over HTTP, so the first visit takes a while — show live progress
// instead of a bare label.
export function PaneLoading() {
  const [stats, setStats] = useState<{ fetchedBytes: number; requests: number } | null>(null);

  useEffect(() => {
    if (dataMode !== "static") return;
    let stop = false;
    const tick = async () => {
      const s = await getLoadStats().catch(() => null);
      if (!stop && s) setStats({ fetchedBytes: s.fetchedBytes, requests: s.requests });
    };
    tick();
    const timer = setInterval(tick, 400);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="pane pane-loading">
      <div className="loading-box">
        <div className="loading-bar">
          <div className="loading-bar-fill" />
        </div>
        <div className="loading-label">
          {stats
            ? `Streaming the corpus… ${(stats.fetchedBytes / 1024 / 1024).toFixed(1)} MB · ${stats.requests} requests`
            : "Loading passage…"}
        </div>
        {dataMode === "static" && (
          <div className="loading-hint">
            The database streams in small pages on demand — the first visit takes a few
            seconds; return visits are cached.
          </div>
        )}
      </div>
    </div>
  );
}
