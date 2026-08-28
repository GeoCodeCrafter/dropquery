import * as duckdb from '@duckdb/duckdb-wasm';
import { LOCAL_BUNDLES } from './bundles.js';
import type { Format } from './sniff.js';

/**
 * DuckDB, in a worker, over the dropped file.
 *
 * The important detail is `registerFileHandle`: the `File` is handed to DuckDB
 * as a handle it range-reads on demand. The bytes are never pulled into a
 * JavaScript string or buffer, which is the only reason a 1 GB CSV is survivable
 * in a browser tab.
 *
 * The bundle is resolved from assets served by this origin - never a CDN. That
 * is not a preference, it is the privacy claim: the page must be able to run
 * with `connect-src 'none'` and no network at all.
 */
export class Engine {
  readonly #db: duckdb.AsyncDuckDB;
  readonly #connection: duckdb.AsyncDuckDBConnection;

  private constructor(db: duckdb.AsyncDuckDB, connection: duckdb.AsyncDuckDBConnection) {
    this.#db = db;
    this.#connection = connection;
  }

  static async create(bundles: duckdb.DuckDBBundles = LOCAL_BUNDLES): Promise<Engine> {
    const bundle = await duckdb.selectBundle(bundles);
    if (!bundle.mainWorker) throw new Error('no DuckDB worker bundle available');

    const worker = new Worker(bundle.mainWorker);
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);

    return new Engine(db, await db.connect());
  }

  /**
   * Makes a dropped file queryable under `name`. Returns the table name to use
   * in SQL - sanitised, because a filename is user input that ends up in a
   * query.
   */
  async register(file: File, format: Format): Promise<string> {
    const table = tableName(file.name);
    await this.#db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

    const reader = readerFor(format, file.name);
    await this.#connection.query(`CREATE OR REPLACE VIEW "${table}" AS SELECT * FROM ${reader}`);
    return table;
  }

  async query(sql: string): Promise<{ columns: string[]; rows: unknown[][] }> {
    const result = await this.#connection.query(sql);
    const columns = result.schema.fields.map((field) => field.name);
    const rows = result.toArray().map((row) => columns.map((column) => row[column]));
    return { columns, rows };
  }

  async close(): Promise<void> {
    await this.#connection.close();
    await this.#db.terminate();
  }
}

/** The DuckDB reader function for a format, with the filename as its argument. */
function readerFor(format: Format, filename: string): string {
  const quoted = `'${filename.replace(/'/g, "''")}'`;

  switch (format) {
    case 'csv':
    case 'tsv':
      return `read_csv(${quoted}, auto_detect=true)`;
    case 'json':
    case 'ndjson':
      return `read_json_auto(${quoted})`;
    case 'parquet':
      return `read_parquet(${quoted})`;
    default:
      throw new Error(`dropquery cannot read ${format} yet`);
  }
}

/**
 * A filename is user input and it is about to be interpolated into SQL, so it
 * is reduced to an identifier rather than escaped and hoped for.
 */
export function tableName(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '');
  const safe = stem.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  return safe === '' ? 'data' : safe.slice(0, 63);
}
