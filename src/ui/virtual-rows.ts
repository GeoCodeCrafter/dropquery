/**
 * Which rows to actually put in the DOM.
 *
 * A result set can be millions of rows and the browser will cheerfully try to
 * lay out every `<tr>` you give it, so only the visible slice gets rendered and
 * the rest is faked with a tall spacer.
 *
 * Pure maths, kept separate from the rendering so the off-by-ones are testable
 * — which matters, because the failure mode of getting this wrong is a blank
 * gap while scrolling rather than an exception.
 */

export interface Window {
  /** First row index to render, inclusive. */
  first: number;
  /** Last row index to render, exclusive. */
  last: number;
  /** Pixels to push the rendered slice down by. */
  offsetTop: number;
  /** Height of the full list, so the scrollbar is the right size. */
  totalHeight: number;
}

export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalRows: number,
  overscan = 8,
): Window {
  if (rowHeight <= 0 || totalRows <= 0) {
    return { first: 0, last: 0, offsetTop: 0, totalHeight: 0 };
  }

  const totalHeight = totalRows * rowHeight;
  // Clamping the scroll position matters on elastic/overscroll platforms, where
  // scrollTop can briefly go negative or past the end.
  const clamped = Math.min(Math.max(scrollTop, 0), Math.max(0, totalHeight - viewportHeight));

  const first = Math.max(0, Math.floor(clamped / rowHeight) - overscan);
  const onScreen = Math.ceil(viewportHeight / rowHeight);
  const last = Math.min(totalRows, first + onScreen + overscan * 2);

  return { first, last, offsetTop: first * rowHeight, totalHeight };
}
