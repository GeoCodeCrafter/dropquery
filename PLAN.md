# Build plan - dropquery

**Pitch:** VERT's trick, applied to data. VERT converts files in the browser and
stops. This one converts *and* queries *and* charts - which is the half people
actually need, and the half that shows off the front-end stack.

**Why it matters for hiring:** this repo is the CV. Vite, WASM, Canvas, D3 or
Recharts, dashboards, large-data rendering, and a hard performance constraint -
all of the weighted skills in one artefact a hiring manager can open in a tab.

---

## Architecture

```
src/
  engine/
    duckdb.ts       worker init, bundle selection, OPFS-free in-memory mode
    register.ts     dropped File -> registered virtual table
    sniff.ts        format and delimiter detection, encoding, gzip
    types.ts        column type inference used for chart defaults
  ui/
    dropzone.ts
    table.ts        virtualised grid - only rows in view are in the DOM
    editor.ts       SQL editor with schema-aware completion
    chart/
      choose.ts     column types -> default chart form
      render.ts     the chart itself
  export/
    to-csv.ts  to-json.ts  to-parquet.ts  to-xlsx.ts  to-markdown.ts
  privacy/
    no-network.ts   the runtime guard, mirrored by the CI check
```

DuckDB-WASM runs in a worker. The main thread never blocks on a query, and a
long query stays cancellable - which is the difference between a demo and a tool.

## Milestones

### v0.1 - the demo that sells the idea

- [ ] Drop a CSV, see a virtualised table of it
- [ ] SQL box, run query, see results
- [ ] One export format (CSV) and one chart type (bar)
- [ ] Network tab is provably empty - record that as the GIF

### v0.2 - actually useful

- [ ] Parquet, JSON, NDJSON, XLSX, gzip
- [ ] Multiple files registered at once, joinable by filename
- [ ] Chart auto-selection from column types; manual override
- [ ] All export formats, plus copy-as-markdown-table
- [ ] Query cancellation and a progress indicator

### v0.3 - the claim, enforced

- [ ] CSP with `connect-src 'none'` post-load
- [ ] CI check failing the build on any network primitive in the bundle
- [ ] Offline-first service worker, installable as a PWA
- [ ] 1 GB file test in CI (generated, not committed) with a memory ceiling

### v1.0

- [ ] Shareable query permalinks that encode the SQL only, never the data
- [ ] Saved query snippets in localStorage
- [ ] Keyboard-first flow end to end

## Hard problems, decided up front

**Big files without dying.** Never read the whole file into a JS string. Register
the `File` handle with DuckDB and let it range-read. The table view is
virtualised and paginated by `LIMIT`/`OFFSET` over the result, not by holding
results in memory.

**Type inference driving the chart.** The chart choice is a pure function of the
result schema - one temporal column plus one numeric means a line; one
categorical plus one numeric means a bar; two numerics means a scatter. Pure,
therefore unit-testable, therefore trustworthy.

**The privacy claim is load-bearing.** If one dependency phones home, the entire
pitch collapses and the repo becomes a liability. Hence the CI guard, and hence
keeping the dependency list short enough to audit by eye.

**XLSX is not a format, it is a zip of XML.** Writing it correctly is a real
chunk of work. Read support first; write support can wait for v0.2.

## Launch checklist

- [ ] Hosted demo linked at the very top of the README
- [ ] GIF: drop file, type SQL, chart appears, network tab empty
- [ ] A sample dataset one click away so nobody has to find a CSV first
- [ ] Post to Hacker News (Show HN), r/webdev, r/dataengineering, Bluesky
- [ ] Lead with the privacy line - it is the reason people share it
