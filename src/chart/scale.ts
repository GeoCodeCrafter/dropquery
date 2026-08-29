/**
 * Axis maths, kept away from any drawing so it can be tested.
 *
 * An axis running 0 to 4373.2891 with seven decimals on every tick is the
 * giveaway that nobody thought about whoever has to read it. Ticks should land
 * on numbers a person would have picked.
 */

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * Rounds the domain outwards to values ending in 1, 2, 2.5 or 5 times a power of
 * ten, and places roughly `target` ticks inside it.
 */
export function niceScale(min: number, max: number, target = 5): Scale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] };

  if (min === max) {
    // A flat series still needs an axis with height, or the line vanishes.
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }

  const step = niceStep((max - min) / Math.max(1, target));
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  // Accumulating by multiplication rather than repeated addition keeps floating
  // point drift out of the labels.
  const count = Math.round((end - start) / step);
  for (let i = 0; i <= count; i++) ticks.push(round(start + i * step));

  return { min: start, max: end, ticks };
}

function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;

  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Maps a value in the domain onto a pixel position. */
export function project(value: number, scale: Scale, pixels: number): number {
  const span = scale.max - scale.min;
  if (span === 0) return 0;
  return ((value - scale.min) / span) * pixels;
}

function round(value: number): number {
  return Number(value.toPrecision(12));
}
