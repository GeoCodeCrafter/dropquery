# dropquery

[![CI](https://github.com/GeoCodeCrafter/dropquery/actions/workflows/ci.yml/badge.svg)](https://github.com/GeoCodeCrafter/dropquery/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

**[Try it →](https://geocodecrafter.github.io/dropquery/)**

Drop a CSV in. Write SQL against it. Chart the result, export it, close the tab.

Nothing gets uploaded. Open the network panel and watch it stay empty.

---

## Why

You get handed a 200 MB CSV and your options are: a spreadsheet that won't open
it, twenty minutes writing a throwaway pandas script, or pasting company data
into `free-csv-tool-online.com` and not thinking too hard about it.

People pick the third one. I've picked the third one. And there's no good reason
for it any more — DuckDB compiles to WebAssembly, so the entire job (parse,
query, join, chart, convert) runs in a browser tab with the network unplugged.

So that's what this is.

## What it does

- Reads CSV, TSV, JSON, NDJSON and Parquet.
- Real SQL over them — joins across several dropped files, window functions,
  CTEs, the lot. It's DuckDB underneath, not a query-shaped toy.
- Charts the result immediately. The column types pick something sensible and you
  override it if it guessed wrong.
- Exports to CSV, JSON or NDJSON, or copies the result as a markdown table for
  pasting into a PR.
- Handles big results — the table only puts the visible rows in the DOM, so 50k
  rows is about 40 `<tr>`s and a tall scrollbar.
- Forgets everything on reload. Nothing is written to storage.

## About the privacy claim

This is the whole selling point, so it's worth being precise, and the precise
version isn't the punchy one.

I originally wrote that the page "cannot make a network request" and was going to
ship it with `connect-src 'none'`. That's false. DuckDB has to fetch its own
WebAssembly module, and it uses XHR to do it, so the page would simply not have
worked — and anyone who opened the bundle would have caught me inside a minute.

What's actually true:

> The page talks to its own origin and nothing else. Your data has nowhere to go.

And rather than asking you to take that on trust:

1. **`connect-src 'self'`** in the CSP, with `object-src 'none'`, `base-uri 'none'`
   and `form-action 'none'` alongside it. The browser blocks anything
   cross-origin no matter what the code tries.
2. **No network primitives in the application bundle at all** — no `fetch`, no
   `XMLHttpRequest`, no `WebSocket`, no `sendBeacon`. Vite's module-preload
   polyfill is switched off in `vite.config.ts` for exactly this reason: it
   injects a `fetch` that only ever hits same-origin chunks, which is harmless
   but makes the claim unverifiable by grep.
3. **[A CI check](scripts/check-no-network.mjs) that fails the build** if one
   turns up in app code, or if any CDN host appears as a request target. DuckDB's
   own loader is exempted by name and the check prints its exemptions on every
   run, so the exception is visible rather than buried.
4. The WASM is bundled from `node_modules` and served from this origin. Never
   jsDelivr.
5. It works offline. Load it once, pull the cable, carry on.

## Running it

```bash
npm install
npm run dev
```

There's a sample CSV in the repo if you don't have one to hand.

## How it's put together

```
src/
  engine/   format sniffing, DuckDB setup, file registration
  chart/    which chart to draw, and the axis maths
  export/   result set -> csv / json / ndjson / markdown
  privacy/  the runtime guard that mirrors the CI check
```

DuckDB runs in a worker, so a slow query doesn't lock the page up and stays
cancellable.

The bit I'd point at is `engine/sniff.ts`. Extensions lie constantly — `.csv`
files that are tab-separated, `.csv` files that are semicolon-separated because
Excel exported them in a European locale, `.txt` files that are actually JSON. So
it checks magic bytes first, then picks the delimiter by which candidate splits
every sampled line into the same number of fields. A comma inside quoted prose
won't divide the rows evenly, so it doesn't win.

Anything with a decision in it is a pure function and unit tested — 52 of those.
The parts that only exist in a browser get a Playwright suite instead, run
against the production build rather than the dev server, because the local WASM
assets are exactly the thing that breaks only once it's bundled. That suite
checks a real SQL round trip, that 50k rows stay windowed while you scroll, that
the chart actually has pixels in it, and that nothing off-origin gets requested.

## Known gaps

- **XLSX is read-only-ish**, which is to say not done. It's a zip full of XML and
  writing it properly is real work.
- No query cancellation UI yet — the worker supports it, the button doesn't exist.
- No column sorting or resizing in the results table yet.

## Licence

MIT © OpusDevs
