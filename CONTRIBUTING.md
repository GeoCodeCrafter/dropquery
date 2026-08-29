# Contributing

## Setup

```bash
npm install
npm run dev
npm test
npm run build && npm run check:no-network
```

That last one is worth running before you push anything — it's the check that
keeps the README honest, and it fails the build rather than warning.

## The one rule

**The application bundle must not be able to reach the network.** That's the
entire product. A dependency that phones home doesn't get merged no matter how
useful it is, and neither does an analytics snippet, a CDN font, or an error
reporter.

`scripts/check-no-network.mjs` enforces it. DuckDB's own loader is exempted by
name, because it genuinely has to fetch its WebAssembly from this origin, and the
check prints that exemption on every run so it stays visible. If you find
yourself widening that allowlist, stop and work out why first.

Beyond that:

- **Nothing is persisted unless someone asked for it.** No localStorage caches of
  other people's data.
- **Large files stream.** Never read a whole file into one buffer — DuckDB gets a
  file handle and range-reads it, and that's what makes big files work at all.

## Where things live

Anything with a decision in it is a pure function with tests: format sniffing,
the chart choice, the axis maths, the serialisers. The DuckDB and canvas layers
are excluded from coverage and verified by running them instead, because mocking
a WASM database only proves the mock got called.

If you're adding a format, `engine/sniff.ts` is the place, and it needs a test
for the case where it should *not* fire — misdetecting a file is worse than
refusing it.

## Pull requests

One change at a time. A bug fix comes with the test that would have caught it.
