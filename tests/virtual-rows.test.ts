import { describe, expect, it } from 'vitest';
import { visibleRange } from '../src/ui/virtual-rows.js';

describe('visibleRange', () => {
  it('renders the slice on screen plus overscan either side', () => {
    // 400px tall viewport, 20px rows: 20 rows visible, 8 either side.
    const w = visibleRange(1000, 400, 20, 10_000, 8);

    expect(w.first).toBe(50 - 8);
    expect(w.last).toBe(w.first + 20 + 16);
    expect(w.offsetTop).toBe(42 * 20);
  });

  it('sizes the scrollbar for the whole result, not the rendered slice', () => {
    expect(visibleRange(0, 400, 20, 10_000).totalHeight).toBe(200_000);
  });

  it('does not run off the start', () => {
    const w = visibleRange(0, 400, 20, 10_000);

    expect(w.first).toBe(0);
    expect(w.offsetTop).toBe(0);
  });

  it('does not run off the end', () => {
    const w = visibleRange(999_999, 400, 20, 100);

    expect(w.last).toBe(100);
    expect(w.first).toBeLessThan(100);
  });

  it('clamps a negative scrollTop, which overscroll produces', () => {
    expect(visibleRange(-250, 400, 20, 500).first).toBe(0);
  });

  it('renders everything when the result is shorter than the viewport', () => {
    const w = visibleRange(0, 400, 20, 5);

    expect(w.first).toBe(0);
    expect(w.last).toBe(5);
  });

  it('returns an empty window for an empty result', () => {
    expect(visibleRange(0, 400, 20, 0)).toEqual({
      first: 0,
      last: 0,
      offsetTop: 0,
      totalHeight: 0,
    });
  });

  it('does not divide by a zero row height', () => {
    expect(() => visibleRange(0, 400, 0, 100)).not.toThrow();
    expect(visibleRange(0, 400, 0, 100).last).toBe(0);
  });

  it('always covers the visible area, so there is never a blank gap', () => {
    const rowHeight = 24;
    const viewport = 500;
    const total = 5000;

    for (let scrollTop = 0; scrollTop < total * rowHeight - viewport; scrollTop += 137) {
      const w = visibleRange(scrollTop, viewport, rowHeight, total);
      const topOfViewport = Math.min(scrollTop, total * rowHeight - viewport);

      expect(w.first * rowHeight).toBeLessThanOrEqual(topOfViewport);
      expect(w.last * rowHeight).toBeGreaterThanOrEqual(topOfViewport + viewport);
    }
  });
});
