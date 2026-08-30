import { renderChart } from './chart/render.js';
import type { Column, ColumnType } from './chart/choose.js';
import { Engine } from './engine/duckdb.js';
import { sniff } from './engine/sniff.js';
import { toCsv, toMarkdown, type ResultSet } from './export/serialise.js';
import { visibleRange } from './ui/virtual-rows.js';

/**
 * Wiring. Anything that could be wrong lives in the tested modules; this hooks
 * them to the DOM and keeps the two promises the README makes — nothing
 * uploaded, nothing persisted.
 */

const dropzone = byId<HTMLElement>('dropzone');
const fileInput = byId<HTMLInputElement>('file');
const status = byId<HTMLElement>('status');
const workspace = byId<HTMLElement>('workspace');
const sqlBox = byId<HTMLTextAreaElement>('sql');
const results = byId<HTMLTableElement>('results');
const chart = byId<HTMLCanvasElement>('chart');
const tableScroll = byId<HTMLElement>('table-scroll');
const meta = byId<HTMLElement>('meta');

let engine: Engine | null = null;
let current: ResultSet = { columns: [], rows: [] };
let currentColumns: Column[] = [];

// A canvas is sized in device pixels, so it has to be redrawn whenever its CSS
// size changes - otherwise the chart stays at whatever width the window happened
// to be when the query ran, stretched or clipped. Also covers the case where the
// canvas is laid out at zero width (inside a hidden tab, say) and gets a real
// size later.
const chartResize = new ResizeObserver(() => {
  if (current.rows.length > 0 && chart.clientWidth > 0) {
    renderChart(chart, current, currentColumns);
  }
});
chartResize.observe(chart);

// Re-window on scroll. rAF-throttled: scroll events outrun layout otherwise and
// the DOM writes start queueing up behind each other.
let scrollQueued = false;
tableScroll.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    if (current.rows.length > 0) renderRows(current);
  });
});

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') fileInput.click();
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void load(file);
});

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('is-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-over');
  const file = event.dataTransfer?.files?.[0];
  if (file) void load(file);
});

byId<HTMLButtonElement>('run').addEventListener('click', () => void run(sqlBox.value));
sqlBox.addEventListener('keydown', (event) => {
  // Ctrl/Cmd+Enter runs, the way every SQL client does it.
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void run(sqlBox.value);
});

byId<HTMLButtonElement>('copy-md').addEventListener('click', () => {
  void navigator.clipboard.writeText(toMarkdown(current));
  say('Copied the result as a markdown table.');
});

byId<HTMLButtonElement>('download-csv').addEventListener('click', () => {
  const blob = new Blob([toCsv(current)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement('a'), { href: url, download: 'result.csv' });
  anchor.click();
  URL.revokeObjectURL(url);
});

async function load(file: File): Promise<void> {
  say(`Reading ${file.name}...`);

  // Only the first 64 kB is sampled to work out what the file is - the rest is
  // never pulled into memory.
  const head = file.slice(0, 65_536);
  const bytes = new Uint8Array(await head.arrayBuffer());
  const detected = sniff(await head.text(), file.name, bytes);

  if (detected.format === 'unknown' || detected.format === 'xlsx') {
    say(`dropquery cannot read this yet: ${detected.reason}.`);
    return;
  }

  try {
    engine ??= await Engine.create();
    const table = await engine.register(file, detected.format);
    workspace.hidden = false;
    sqlBox.value = `SELECT * FROM ${table} LIMIT 100`;
    say(`${file.name}: ${detected.reason}. Registered as ${table}.`);
    await run(sqlBox.value);
  } catch (error) {
    say(`Could not open it: ${(error as Error).message}`);
  }
}

async function run(sql: string): Promise<void> {
  if (!engine) return;
  const started = performance.now();

  try {
    current = await engine.query(sql);
    renderTable(current);
    currentColumns = inferColumns(current);
    const form = renderChart(chart, current, currentColumns);
    meta.textContent = `${current.rows.length} rows in ${Math.round(performance.now() - started)}ms - ${form}`;
  } catch (error) {
    say((error as Error).message);
  }
}

/**
 * Row height in CSS pixels. Has to match `#results tbody tr` in style.css - the
 * windowing maths needs a fixed row height, and measuring it back out of the DOM
 * every frame would cost a layout per scroll event.
 */
const ROW_HEIGHT = 30;

function renderTable(result: ResultSet): void {
  const header = `<thead><tr>${result.columns.map((c) => `<th>${escape(c)}</th>`).join('')}</tr></thead>`;
  results.innerHTML = `${header}<tbody></tbody>`;
  renderRows(result);
}

/**
 * Only the visible slice goes into the DOM. The rest is two spacer rows holding
 * the scrollbar open.
 *
 * Spacers rather than a transform because it keeps one table: the sticky header
 * still works and the columns still line themselves up, both of which break the
 * moment you split the header and body into separate tables.
 */
function renderRows(result: ResultSet): void {
  const body = results.tBodies[0];
  if (!body) return;

  const window = visibleRange(
    tableScroll.scrollTop,
    tableScroll.clientHeight || 400,
    ROW_HEIGHT,
    result.rows.length,
  );

  const rows: string[] = [];
  if (window.offsetTop > 0) rows.push(`<tr class="spacer" style="height:${window.offsetTop}px"></tr>`);

  for (let i = window.first; i < window.last; i++) {
    const row = result.rows[i];
    if (!row) continue;
    rows.push(`<tr>${row.map((cell) => `<td>${escape(String(cell ?? ''))}</td>`).join('')}</tr>`);
  }

  const below = window.totalHeight - window.last * ROW_HEIGHT;
  if (below > 0) rows.push(`<tr class="spacer" style="height:${below}px"></tr>`);

  body.innerHTML = rows.join('');
}

/** Column types from the values actually returned, for the chart heuristic. */
function inferColumns(result: ResultSet): Column[] {
  return result.columns.map((name, index) => {
    const sample = result.rows.slice(0, 50).map((row) => row[index]);
    return { name, type: typeOf(sample), cardinality: new Set(sample.map(String)).size };
  });
}

function typeOf(values: unknown[]): ColumnType {
  const present = values.filter((value) => value !== null && value !== undefined);
  if (present.length === 0) return 'other';
  if (present.every((v) => typeof v === 'number' || typeof v === 'bigint')) return 'numeric';
  if (present.every((v) => v instanceof Date)) return 'temporal';
  if (present.every((v) => typeof v === 'boolean')) return 'boolean';
  return 'categorical';
}

function say(message: string): void {
  status.textContent = message;
}

function escape(value: string): string {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing #${id}`);
  return element as T;
}
