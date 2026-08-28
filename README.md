# dropquery

[![CI](https://github.com/GeoCodeCrafter/dropquery/actions/workflows/ci.yml/badge.svg)](https://github.com/GeoCodeCrafter/dropquery/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

Drop a CSV. Write SQL against it. Chart the result. Export it as anything.

Your file never leaves your machine - open the network tab and watch nothing
happen.

---

## Why this exists

The moment you need to look at a 200 MB CSV, your options are: open a spreadsheet
that will not open it, write a throwaway pandas script, or paste company data
into `some-free-csv-tool.com` and hope.

That third option is the one people actually take, and it is the one where the
data ends up on someone else's server. There is no technical reason for it. SQL
engines compile to WebAssembly now. The whole job - parse, query, join, chart,
convert - runs in a browser tab with the network disconnected.

dropquery is that tab.

## What it does

- **Reads** CSV, TSV, JSON, NDJSON, Parquet and XLSX, including gzipped.
- **Queries** with real SQL - joins across several dropped files, window
  functions, CTEs - via DuckDB compiled to WebAssembly.
- **Charts** the result set immediately: the column types pick a sensible default
  chart, and you override it.
- **Converts** to CSV, JSON, NDJSON, Parquet or XLSX, and copies the result as a
  markdown table for pasting into a PR.
- **Remembers nothing.** Files are held in memory. Reload and it is gone.

## The privacy claim, and how it is kept honest

The claim is the product, so it is stated precisely and enforced mechanically.

The precise claim is **not** "this page cannot make a network request". DuckDB
has to load its own WebAssembly module, and it uses XHR to do it. A README
promising `connect-src 'none'` would be a lie that anyone could catch in a
minute, so here is the true version:

> The page talks to its own origin and nowhere else. Your data has nowhere to go.

Enforced by:

1. **`connect-src 'self'`** in the Content Security Policy, alongside
   `object-src 'none'`, `base-uri 'none'` and `form-action 'none'`. The browser
   refuses any cross-origin request regardless of what the code asks for.
2. **The application bundle contains no network primitives at all** - no
   `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or `EventSource`. Vite's
   module-preload polyfill is switched off in `vite.config.ts` specifically so
   this stays literally true and mechanically checkable.
3. **A CI check that fails the build** ([`scripts/check-no-network.mjs`](scripts/check-no-network.mjs))
   if a primitive appears in application code, or if any CDN host appears as a
   request target anywhere. The engine's own loader is exempted by name, and the
   check prints its exemptions on every run rather than hiding them.
4. **No analytics, no CDN fonts, no error reporting.** The WASM is bundled from
   `node_modules` and served from this origin, never from jsDelivr.
5. It works **offline**. Load it once, pull the network cable, use it forever.

## Install

Use the hosted build, or run it yourself:

```bash
npm install
npm run dev
```

## Status

Pre-alpha. See [PLAN.md](PLAN.md) for the build order.

## Licence

MIT (c) OpusDevs
