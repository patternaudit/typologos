import { useEffect, useState } from "react";
import { dataMode, getLoadStats } from "../data";

// Shared loading readout: animated bar plus, in static mode, live streaming
// stats from the WASM SQLite worker.
export function LoadingIndicator({ label = "Loading…" }: { label?: string }) {
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
    <div className="loading-box">
      <div className="loading-bar">
        <div className="loading-bar-fill" />
      </div>
      <div className="loading-label">
        {stats
          ? `Streaming the corpus… ${(stats.fetchedBytes / 1024 / 1024).toFixed(1)} MB · ${stats.requests} requests`
          : label}
      </div>
      {dataMode === "static" && (
        <div className="loading-hint">
          The database streams in on demand — only the pages this view needs, never the whole
          corpus.
        </div>
      )}
    </div>
  );
}
