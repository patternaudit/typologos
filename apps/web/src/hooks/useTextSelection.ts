// Maps a live DOM selection inside a passage body element back to character
// offsets in the original `body` string.
//
// Trick: a passage body renders *exactly* the body string (anchor highlights
// are nested spans, but no extra characters are added). So the number of
// characters between the container start and a selection endpoint equals that
// endpoint's offset into `body`. We measure that with a Range.

export interface SelectionOffsets {
  start: number;
  end: number;
  text: string;
}

function offsetWithin(container: HTMLElement, node: Node, nodeOffset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, nodeOffset);
  return range.toString().length;
}

export function getSelectionOffsets(
  container: HTMLElement,
  body: string,
): SelectionOffsets | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }

  let start = offsetWithin(container, range.startContainer, range.startOffset);
  let end = offsetWithin(container, range.endContainer, range.endOffset);
  if (start === end) return null;
  if (start > end) [start, end] = [end, start];

  return { start, end, text: body.slice(start, end) };
}
