/**
 * Result set to text. Pure functions over the query result, so every escaping
 * rule is unit tested rather than eyeballed in a download.
 */

export interface ResultSet {
  columns: string[];
  rows: unknown[][];
}

export function toCsv(result: ResultSet, delimiter = ','): string {
  const lines = [result.columns.map((c) => csvField(c, delimiter)).join(delimiter)];
  for (const row of result.rows) {
    lines.push(row.map((value) => csvField(stringify(value), delimiter)).join(delimiter));
  }
  return lines.join('\n');
}

export function toJson(result: ResultSet): string {
  return JSON.stringify(toObjects(result), null, 2);
}

export function toNdjson(result: ResultSet): string {
  return toObjects(result)
    .map((row) => JSON.stringify(row))
    .join('\n');
}

/**
 * A markdown table, for pasting into a pull request. Pipes inside values are
 * escaped, because a table that breaks when pasted is worse than no table.
 */
export function toMarkdown(result: ResultSet): string {
  const header = `| ${result.columns.map(markdownCell).join(' | ')} |`;
  const rule = `| ${result.columns.map(() => '---').join(' | ')} |`;
  const body = result.rows.map((row) => `| ${row.map((v) => markdownCell(stringify(v))).join(' | ')} |`);
  return [header, rule, ...body].join('\n');
}

export function toObjects(result: ResultSet): Record<string, unknown>[] {
  return result.rows.map((row) => {
    const object: Record<string, unknown> = {};
    result.columns.forEach((column, index) => {
      object[column] = jsonSafe(row[index] ?? null);
    });
    return object;
  });
}

/**
 * DuckDB returns BigInt for 64-bit integers and JSON.stringify throws outright
 * on those - not a rounding problem, a hard TypeError that would take the whole
 * export down. They become strings, because silently narrowing to a double
 * would lose precision on exactly the values big enough to need a BigInt.
 */
function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function csvField(value: string, delimiter: string): string {
  const needsQuotes = value.includes(delimiter) || value.includes('"') || /[\r\n]/.test(value);
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * BigInt is what DuckDB hands back for 64-bit integers and JSON.stringify
 * throws on it, so it is turned into text rather than being allowed to take the
 * export down.
 */
function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
