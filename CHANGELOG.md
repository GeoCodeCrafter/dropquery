# Changelog

## [0.1.0] - 2026-08-29

First cut. Drop a file, query it, chart it, export it.

### Added

- CSV, TSV, JSON, NDJSON and Parquet, detected by magic bytes first and file
  extension only as a fallback. The delimiter is picked by which candidate splits
  every sampled line into the same number of fields, so a comma inside quoted
  prose doesn't win.
- DuckDB-WASM in a worker, with the dropped file registered as a handle it
  range-reads rather than a buffer.
- Chart selection from the result schema, with hand-rolled axis maths that put
  ticks on numbers a person would have chosen.
- Export to CSV, JSON, NDJSON, or a markdown table on the clipboard.
- A CI check that fails the build if the app bundle grows any way to reach the
  network.

### Fixed while building it

- **JSON export threw on any 64-bit integer.** DuckDB hands those back as
  `BigInt` and `JSON.stringify` refuses them outright — not a rounding problem, a
  hard `TypeError`. They serialise as strings now, since narrowing to a double
  would lose precision on exactly the values big enough to need a BigInt.
- **The chart never redrew on resize.** A canvas is sized in device pixels, so
  it stayed at whatever width the window happened to be when the query ran, then
  stretched. A `ResizeObserver` handles it, which also covers a canvas that is
  laid out at zero width inside a hidden container and gets a real size later.
- **The privacy claim in the README was false.** It promised `connect-src 'none'`,
  which would have broken DuckDB's own WASM load and was catchable in about a
  minute by anyone who looked. Rewritten to what's actually true and enforceable:
  same-origin only, no network primitives in app code, checked in CI.

### Not done yet

- XLSX. It's a zip of XML and writing it properly is a real chunk of work.
- Query cancellation in the UI — the worker supports it, the button doesn't exist.
- The results table caps at 200 rows rather than virtualising properly.

[0.1.0]: https://github.com/GeoCodeCrafter/dropquery/releases/tag/v0.1.0
