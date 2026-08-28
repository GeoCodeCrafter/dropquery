import type { DuckDBBundles } from '@duckdb/duckdb-wasm';

// Bundled from node_modules by Vite and served from this origin. Deliberately
// NOT `getJsDelivrBundles()`: that fetches the engine from a CDN, which would
// make the first thing this page does a network request to somebody else's
// server. The entire pitch is that the network is unused, so the WASM ships
// with the app.
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

/**
 * Two builds: `mvp` runs anywhere, `eh` uses WebAssembly exception handling and
 * is meaningfully faster where it is supported. DuckDB picks between them.
 */
export const LOCAL_BUNDLES: DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};
