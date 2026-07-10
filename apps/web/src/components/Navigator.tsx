import type { BookSummary } from "@typologos/shared";
import type { PaneView } from "../viewTypes";

interface NavigatorProps {
  books: BookSummary[];
  view: PaneView;
  onNavigate: (view: PaneView) => void;
}

// Compact per-pane corpus navigator: pick a book + chapter, optionally narrow to
// a verse range. This is the "large-corpus navigation" surface.
export function Navigator({ books, view, onNavigate }: NavigatorProps) {
  const bookId = view.mode === "passage" ? view.bookId : "";
  const book = books.find((b) => b.id === bookId) ?? null;
  const chapter = view.mode === "passage" ? view.chapter : 1;
  const startVerse = view.mode === "passage" ? view.startVerse : null;
  const endVerse = view.mode === "passage" ? view.endVerse : null;

  const chapterCount = book?.chapterCount ?? 0;

  const goBook = (id: string) => {
    if (!id) return;
    onNavigate({ mode: "passage", bookId: id, chapter: 1, startVerse: null, endVerse: null });
  };
  const goChapter = (ch: number) => {
    if (view.mode !== "passage") return;
    onNavigate({ ...view, chapter: ch, startVerse: null, endVerse: null });
  };
  const setRange = (start: number | null, end: number | null) => {
    if (view.mode !== "passage") return;
    onNavigate({ ...view, startVerse: start, endVerse: end });
  };

  const parseVerse = (raw: string): number | null => {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return (
    <div className="navigator">
      <select
        className="nav-book"
        value={bookId}
        onChange={(e) => goBook(e.target.value)}
        disabled={books.length === 0}
        title={books.length === 0 ? "Run `npm run corpus:import` to load the KJV" : "Book"}
      >
        <option value="">
          {books.length === 0 ? "No corpus imported" : "Browse corpus…"}
        </option>
        {books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>

      {view.mode === "passage" && (
        <>
          <select
            className="nav-chapter"
            value={chapter}
            onChange={(e) => goChapter(Number(e.target.value))}
          >
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map((ch) => (
              <option key={ch} value={ch}>
                ch {ch}
              </option>
            ))}
          </select>
          <span className="nav-range">
            v
            <input
              type="number"
              min={1}
              placeholder="1"
              value={startVerse ?? ""}
              onChange={(e) => setRange(parseVerse(e.target.value), endVerse)}
            />
            –
            <input
              type="number"
              min={1}
              placeholder="end"
              value={endVerse ?? ""}
              onChange={(e) => setRange(startVerse, parseVerse(e.target.value))}
            />
          </span>
        </>
      )}

    </div>
  );
}
