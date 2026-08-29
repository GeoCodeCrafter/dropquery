import type { ResultSet } from '../export/serialise.js';
import { chooseChart, type ChartForm, type Column } from './choose.js';
import { niceScale, project } from './scale.js';

/**
 * Canvas drawing. Thin on purpose — the decisions (which chart, what the axis
 * runs to) are made by tested pure functions above, and this just puts pixels
 * where they say.
 */
export function renderChart(
  canvas: HTMLCanvasElement,
  result: ResultSet,
  columns: Column[],
  form: ChartForm = chooseChart(columns),
): ChartForm {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) return 'table';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (form === 'table' || result.rows.length === 0) return 'table';

  const valueIndex = columns.findIndex((c) => c.type === 'numeric');
  const labelIndex = columns.findIndex((c) => c.type !== 'numeric');
  if (valueIndex < 0) return 'table';

  const values = result.rows.map((row) => Number(row[valueIndex] ?? 0)).filter(Number.isFinite);
  if (values.length === 0) return 'table';

  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const scale = niceScale(Math.min(0, ...values), Math.max(...values));

  drawAxis(ctx, scale, pad, plotWidth, plotHeight);

  const style = getComputedStyle(canvas);
  ctx.fillStyle = style.getPropertyValue('--chart-ink').trim() || '#4f9cf9';
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 2;

  const step = plotWidth / values.length;

  if (form === 'bar' || form === 'histogram') {
    const barWidth = Math.max(1, step * 0.7);
    values.forEach((value, index) => {
      const y = project(value, scale, plotHeight);
      const zero = project(0, scale, plotHeight);
      ctx.fillRect(
        pad.left + index * step + (step - barWidth) / 2,
        pad.top + plotHeight - Math.max(y, zero),
        barWidth,
        Math.abs(y - zero),
      );
    });
  } else {
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = pad.left + index * step + step / 2;
      const y = pad.top + plotHeight - project(value, scale, plotHeight);
      if (form === 'scatter') {
        ctx.moveTo(x + 3, y);
        ctx.arc(x, y, 3, 0, Math.PI * 2);
      } else if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    if (form === 'scatter') ctx.fill();
    else ctx.stroke();
  }

  void labelIndex;
  return form;
}

function drawAxis(
  ctx: CanvasRenderingContext2D,
  scale: ReturnType<typeof niceScale>,
  pad: { top: number; left: number },
  plotWidth: number,
  plotHeight: number,
): void {
  ctx.strokeStyle = 'rgba(128,138,157,0.28)';
  ctx.fillStyle = 'rgba(128,138,157,0.9)';
  ctx.lineWidth = 1;
  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (const tick of scale.ticks) {
    const y = pad.top + plotHeight - project(tick, scale, plotHeight);
    ctx.beginPath();
    ctx.moveTo(pad.left, y + 0.5);
    ctx.lineTo(pad.left + plotWidth, y + 0.5);
    ctx.stroke();
    ctx.fillText(format(tick), pad.left - 8, y);
  }
}

function format(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString();
  return String(value);
}
