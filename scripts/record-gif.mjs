#!/usr/bin/env node
/**
 * Records the README GIF by driving the app in a real browser.
 *
 * Playwright screenshots each frame, gifenc encodes them. Playwright bundles an
 * ffmpeg, but it's a stripped webm-only build with no GIF muxer and no palette
 * filters, so the encoding happens here instead.
 *
 * Screenshots don't include the mouse pointer, so a fake one is drawn into the
 * page and moved in step with the real one.
 *
 *   npm run dev &
 *   node scripts/record-gif.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';
// Both are CommonJS and Node's named-export detection doesn't see through
// either, so they arrive as defaults.
import gifenc from 'gifenc';
import pngjs from 'pngjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;
const { PNG } = pngjs;

const URL = process.env.DEMO_URL ?? 'http://localhost:5173';
const OUT = 'docs/demo.gif';
const WIDTH = 900;
const HEIGHT = 680;

/** A small sales table with a repeated region, so GROUP BY has work to do. */
const CSV = [
  'region,product,revenue,orders',
  'north,widgets,4373.28,120',
  'south,widgets,2810.10,88',
  'east,widgets,5120.00,143',
  'west,widgets,1990.55,61',
  'north,gadgets,3120.40,77',
  'east,gadgets,900.00,20',
  'south,gadgets,1740.90,52',
  'west,gadgets,2210.15,66',
].join('\n');

const frames = [];

async function shoot(page, delay = 90) {
  const png = PNG.sync.read(await page.screenshot({ type: 'png' }));
  frames.push({ data: new Uint8Array(png.data), delay });
}

const hold = (page, ms) => shoot(page, ms);

async function glide(page, to, steps = 7) {
  const from = glide.at ?? { x: 40, y: 40 };

  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await page.mouse.move(x, y);
    await page.evaluate(({ x, y }) => window.__moveCursor?.(x, y), { x, y });
    await shoot(page, 60);
  }

  glide.at = to;
}

async function press(page) {
  await page.evaluate(() => window.__pressCursor?.(true));
  await shoot(page, 90);
  await page.evaluate(() => window.__pressCursor?.(false));
}

async function centreOf(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

await page.evaluate(() => {
  const cursor = document.createElement('div');
  cursor.style.cssText =
    'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-2px 0 0 -2px;pointer-events:none';
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22">' +
    '<path d="M5 3l14 8.5-6 1.2L10.5 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>' +
    '</svg>';
  document.body.append(cursor);
  window.__moveCursor = (x, y) => {
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  };
  window.__pressCursor = (down) => {
    cursor.style.transform = down ? 'scale(0.82)' : 'scale(1)';
  };
  window.__moveCursor(40, 40);
});

await hold(page, 800);

// 1. Drop the file. A real drag can't be synthesised across the OS boundary, so
//    the cursor is walked to the dropzone and the drop event is dispatched there.
await glide(page, await centreOf(page, '#dropzone'), 8);
await page.evaluate(() => document.getElementById('dropzone').classList.add('is-over'));
await hold(page, 400);
await press(page);

await page.evaluate((csv) => {
  const file = new File([csv], 'sales.csv', { type: 'text/csv' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const zone = document.getElementById('dropzone');
  zone.classList.remove('is-over');
  zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
}, CSV);

// DuckDB has to spin up its worker and instantiate the wasm on the first drop.
await page.waitForSelector('#results tbody tr', { timeout: 30_000 });
await hold(page, 1800);

// 2. Write a real query over it.
await glide(page, await centreOf(page, '#sql'), 6);
await press(page);
await page.locator('#sql').click();
await page.keyboard.press('Control+A');

const sql = 'SELECT region, SUM(revenue) AS revenue, SUM(orders) AS orders\nFROM sales GROUP BY region ORDER BY revenue DESC';
for (const chunk of sql.match(/.{1,4}/gs) ?? []) {
  await page.keyboard.type(chunk, { delay: 0 });
  await shoot(page, 55);
}

await hold(page, 500);

// 3. Run it. The chart picks itself from the column types.
await glide(page, await centreOf(page, '#run'), 6);
await press(page);
await page.locator('#run').click();
await page.waitForTimeout(400);
await hold(page, 1400);

// The dropzone eats most of the fold, so scroll it away - the chart and the
// table sitting together is the thing worth showing.
await page.evaluate(() => document.getElementById('chart')?.scrollIntoView({ block: 'start' }));
await page.evaluate(() => window.scrollBy(0, -70));
await hold(page, 2600);

// 4. The network panel stays empty, which is the whole point.
await page.evaluate(() => {
  const note = document.createElement('div');
  note.textContent = 'no requests left this tab';
  note.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483646;' +
    'background:#171b21;border:1px solid #4f9cf9;color:#e6e8eb;padding:10px 18px;' +
    'border-radius:999px;font:13px ui-monospace,Menlo,Consolas,monospace';
  note.id = '__note';
  document.body.append(note);
});
await hold(page, 2600);

await browser.close();

// One palette for every frame; per-frame quantising makes the colours crawl.
const sample = frames.filter((_, i) => i % 3 === 0);
const merged = new Uint8Array(sample.reduce((n, f) => n + f.data.length, 0));
let at = 0;
for (const frame of sample) {
  merged.set(frame.data, at);
  at += frame.data.length;
}

const palette = quantize(merged, 256, { format: 'rgb565' });
const encoder = GIFEncoder();

for (const frame of frames) {
  encoder.writeFrame(applyPalette(frame.data, palette, 'rgb565'), WIDTH, HEIGHT, {
    palette,
    delay: frame.delay,
  });
}

encoder.finish();
mkdirSync(dirname(OUT), { recursive: true });
const bytes = encoder.bytes();
writeFileSync(OUT, bytes);

const seconds = frames.reduce((n, f) => n + f.delay, 0) / 1000;
console.log(`${OUT}: ${frames.length} frames, ${seconds.toFixed(1)}s, ${(bytes.length / 1e6).toFixed(2)} MB`);
