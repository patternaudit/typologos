// Maps a live DOM selection back to character offsets inside a single "block".
//
// A block is one measured text region: a whole legacy document body, or a single
// corpus verse. Each block element carries `data-block-key` and renders EXACTLY
// its body string (anchor highlights are nested spans, but add no characters).
// So the number of characters from the block start to a selection endpoint is
// that endpoint's offset into the block body.
//
// Selections that spill past the start block are clamped to that block — boring
// and predictable for the MVP.

export interface BlockSelection {
  blockKey: string;
  start: number;
  end: number;
  text: string;
}

function offsetWithin(blockEl: HTMLElement, node: Node, nodeOffset: number): number {
  const range = document.createRange();
  range.selectNodeContents(blockEl);
  range.setEnd(node, nodeOffset);
  return range.toString().length;
}

function closestBlock(node: Node | null, root: HTMLElement): HTMLElement | null {
  let el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null);
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.dataset.blockKey != null) return el;
    el = el.parentElement;
  }
  return null;
}

export function getSelectionOffsets(root: HTMLElement): BlockSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;

  const blockEl = closestBlock(range.startContainer, root);
  if (!blockEl || blockEl.dataset.blockKey == null) return null;

  let start = offsetWithin(blockEl, range.startContainer, range.startOffset);
  let end = blockEl.contains(range.endContainer)
    ? offsetWithin(blockEl, range.endContainer, range.endOffset)
    : (blockEl.textContent ?? "").length; // selection ran past this block — clamp

  if (start === end) return null;
  if (start > end) [start, end] = [end, start];

  const body = blockEl.textContent ?? "";
  return { blockKey: blockEl.dataset.blockKey, start, end, text: body.slice(start, end) };
}
