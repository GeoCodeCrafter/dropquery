import { describe, expect, it } from 'vitest';
import { niceScale, project } from '../src/chart/scale.js';

describe('niceScale', () => {
  it('rounds outwards to numbers a person would have chosen', () => {
    const scale = niceScale(0, 4373.2891);

    expect(scale.min).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(4373.2891);
    expect(scale.ticks.every((t) => Number.isInteger(t))).toBe(true);
  });

  it('always contains the data', () => {
    const scale = niceScale(3.7, 96.2);

    expect(scale.min).toBeLessThanOrEqual(3.7);
    expect(scale.max).toBeGreaterThanOrEqual(96.2);
  });

  it('gives a flat series an axis with height', () => {
    const scale = niceScale(42, 42);

    expect(scale.max).toBeGreaterThan(scale.min);
  });

  it('handles a flat series at zero', () => {
    const scale = niceScale(0, 0);

    expect(scale.max).toBeGreaterThan(scale.min);
  });

  it('keeps floating point noise out of the labels', () => {
    const scale = niceScale(0, 0.7);

    for (const tick of scale.ticks) {
      expect(String(tick)).not.toMatch(/\d{8,}/);
    }
  });

  it('copes with negatives spanning zero', () => {
    const scale = niceScale(-37, 82);

    expect(scale.min).toBeLessThanOrEqual(-37);
    expect(scale.max).toBeGreaterThanOrEqual(82);
    expect(scale.ticks).toContain(0);
  });

  it('returns a usable axis rather than NaN for bad input', () => {
    expect(niceScale(Number.NaN, 10)).toEqual({ min: 0, max: 1, ticks: [0, 1] });
    expect(niceScale(0, Number.POSITIVE_INFINITY).ticks.length).toBeGreaterThan(0);
  });
});

describe('project', () => {
  it('maps the domain onto the pixel range', () => {
    const scale = { min: 0, max: 100, ticks: [] };

    expect(project(0, scale, 400)).toBe(0);
    expect(project(50, scale, 400)).toBe(200);
    expect(project(100, scale, 400)).toBe(400);
  });

  it('does not divide by zero on a degenerate scale', () => {
    expect(project(5, { min: 5, max: 5, ticks: [] }, 400)).toBe(0);
  });
});
