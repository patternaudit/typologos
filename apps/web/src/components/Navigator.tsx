import { useEffect, useState } from "react";
import type { BookSummary } from "@typologos/shared";
import type { PaneView } from "../viewTypes";

interface NavigatorProps {
  books: BookSummary[];
  view: PaneView;
  onNavigate: (view: PaneView) => void;
  // Book mode is a continuous scroll: picking a chapter scrolls, not reloads.
  onScrollToChapter: (chapter: number) => void;
}

// Compact per-pane corpus navigator: pick a book to load it whole; pick a
// chapter to scroll to it.
export function Navigator({ books, view, onNavigate, onScrollToChapter }: NavigatorProps) {
  const bookId = view.mode === "book" ? view.bookId : "";
  const book = books.find((b) => b.id === bookId) ?? null;
  const chapterCount = book?.chapterCount ?? 0;

  // Local chapter selection: purely a scroll control, reset on book change.
  const [chapter, setChapter] = useState(1);
  useEffect(() => {
    setChapter(1);
  }, [bookId]);

  const goBook = (id: string) => {
    if (!id) return;
    onNavigate({ mode: "book", bookId: id });
  };
  const goChapter = (ch: number) => {
    setChapter(ch);
    onScrollToChapter(ch);
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

      {view.mode === "book" && chapterCount > 1 && (
        <select
          className="nav-chapter"
          value={chapter}
          onChange={(e) => goChapter(Number(e.target.value))}
          title="Scroll to chapter"
        >
          {Array.from({ length: chapterCount }, (_, i) => i + 1).map((ch) => (
            <option key={ch} value={ch}>
              ch {ch}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
