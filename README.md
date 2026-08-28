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

The claim is the product, so it is enforced rather than promised:

1. A **strict Content Security Policy** with `connect-src 'none'` after the WASM
   bundle has loaded. The page cannot make a network request, even if a
   dependency tried.
2. A **CI test that fails the build** if any bundled module references `fetch`,
   `XMLHttpRequest`, `WebSocket` or `navigator.sendBeacon` outside the allowed
   loader path.
3. **No analytics, no fonts from a CDN, no error reporting.** The dependency
   list is short specifically so this stays checkable.
4. It works **offline**. Load it once, pull the network cable, use it forever.

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
