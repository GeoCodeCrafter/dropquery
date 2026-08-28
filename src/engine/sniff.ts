/**
 * Working out what a dropped file actually is.
 *
 * Extensions lie constantly - `.csv` files that are tab separated, `.txt` files
 * that are JSON, `.csv` files that are semicolon separated because they were
 * exported from Excel in a European locale. So the signature is checked first
 * and the extension is only a tie-breaker.
 */

export type Format = 'csv' | 'tsv' | 'json' | 'ndjson' | 'parquet' | 'xlsx' | 'unknown';

export interface Sniffed {
  format: Format;
  /** For delimited formats only. */
  delimiter?: string;
  /** True when the first row looks like names rather than values. */
  hasHeader?: boolean;
  /** Why this conclusion was reached, surfaced in the UI. */
  reason: string;
}

const DELIMITERS = [',', '\t', ';', '|'] as const;

/** Magic bytes, checked before anything else. */
export function sniffBytes(bytes: Uint8Array): Format | null {
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'xlsx'; // a zip, so xlsx
  if (startsWith(bytes, [0x50, 0x41, 0x52, 0x31])) return 'parquet'; // 'PAR1'
  return null;
}

export function sniff(sample: string, filename = '', bytes?: Uint8Array): Sniffed {
  const magic = bytes ? sniffBytes(bytes) : null;
  if (magic === 'xlsx') return { format: 'xlsx', reason: 'zip signature, so an xlsx workbook' };
  if (magic === 'parquet') return { format: 'parquet', reason: 'PAR1 signature' };

  const text = stripBom(sample).trimStart();
  if (text === '') return { format: 'unknown', reason: 'the file is empty' };

  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

  // NDJSON before JSON: several objects, one per line, is not a JSON document.
  if (lines.length > 1 && lines.every(looksLikeJsonValue)) {
    return { format: 'ndjson', reason: 'every line parses as its own JSON value' };
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    return { format: 'json', reason: 'starts with a JSON object or array' };
  }

  const delimiter = pickDelimiter(lines);
  if (delimiter) {
    return {
      format: delimiter === '\t' ? 'tsv' : 'csv',
      delimiter,
      hasHeader: looksLikeHeader(lines, delimiter),
      reason: `consistent ${describeDelimiter(delimiter)} separation across the sample`,
    };
  }

  const byExtension = fromExtension(filename);
  if (byExtension) {
    return { format: byExtension, reason: `nothing conclusive in the content; going by the ${filename.split('.').pop()} extension` };
  }

  return { format: 'unknown', reason: 'no signature, no consistent delimiter, and not JSON' };
}

/**
 * The delimiter that splits every sampled line into the same number of fields,
 * preferring the one producing most columns. Consistency is what matters: a
 * comma appearing inside quoted prose will not divide the rows evenly.
 */
function pickDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 10);
  let best: { delimiter: string; columns: number } | null = null;

  for (const delimiter of DELIMITERS) {
    const counts = sample.map((line) => splitRespectingQuotes(line, delimiter).length);
    const first = counts[0];
    if (first === undefined || first < 2) continue;
    if (!counts.every((count) => count === first)) continue;

    if (!best || first > best.columns) best = { delimiter, columns: first };
  }

  return best?.delimiter ?? null;
}

/** A header row is one where no field parses as a number. */
function looksLikeHeader(lines: string[], delimiter: string): boolean {
  const first = lines[0];
  if (first === undefined) return false;

  const fields = splitRespectingQuotes(first, delimiter);
  return fields.length > 0 && fields.every((field) => field.trim() !== '' && !isNumeric(field));
}

export function splitRespectingQuotes(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      fields.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function looksLikeJsonValue(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function fromExtension(filename: string): Format | null {
  const extension = filename.toLowerCase().split('.').pop();
  switch (extension) {
    case 'csv':
      return 'csv';
    case 'tsv':
      return 'tsv';
    case 'json':
      return 'json';
    case 'ndjson':
    case 'jsonl':
      return 'ndjson';
    case 'parquet':
      return 'parquet';
    case 'xlsx':
    case 'xlsm':
      return 'xlsx';
    default:
      return null;
  }
}

export function isNumeric(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  return Number.isFinite(Number(trimmed));
}

function describeDelimiter(delimiter: string): string {
  return delimiter === '\t' ? 'tab' : `'${delimiter}'`;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}
