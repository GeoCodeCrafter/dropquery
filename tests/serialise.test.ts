import { describe, expect, it } from 'vitest';
import { toCsv, toJson, toMarkdown, toNdjson, toObjects } from '../src/export/serialise.js';

const result = {
  columns: ['name', 'note', 'count'],
  rows: [
    ['ada', 'born in London, England', 36],
    ['grace', 'said "hello"', 45n],
    ['alan', null, 0],
  ],
};

describe('toCsv', () => {
  it('quotes a field containing the delimiter', () => {
    expect(toCsv(result)).toContain('"born in London, England"');
  });

  it('doubles an embedded quote', () => {
    expect(toCsv(result)).toContain('"said ""hello"""');
  });

  it('writes an empty field for null rather than the word null', () => {
    expect(toCsv(result).split('\n')[3]).toBe('alan,,0');
  });

  it('leads with the header row', () => {
    expect(toCsv(result).split('\n')[0]).toBe('name,note,count');
  });
});

describe('toJson', () => {
  it('survives the BigInt that DuckDB returns for 64-bit integers', () => {
    expect(() => toJson(result)).not.toThrow();
    expect(toJson(result)).toContain('"count": "45"');
  });
});

describe('toNdjson', () => {
  it('writes one object per line', () => {
    expect(toNdjson(result).split('\n')).toHaveLength(3);
  });
});

describe('toMarkdown', () => {
  it('escapes a pipe so the table does not break when pasted', () => {
    const piped = { columns: ['a'], rows: [['x|y']] };

    expect(toMarkdown(piped)).toContain('x\\|y');
  });

  it('writes a header and a rule', () => {
    const lines = toMarkdown(result).split('\n');

    expect(lines[0]).toBe('| name | note | count |');
    expect(lines[1]).toBe('| --- | --- | --- |');
  });
});

describe('toObjects', () => {
  it('pairs each column with its value', () => {
    expect(toObjects(result)[0]).toEqual({
      name: 'ada',
      note: 'born in London, England',
      count: 36,
    });
  });

  it('uses null for a missing cell', () => {
    expect(toObjects({ columns: ['a', 'b'], rows: [['x']] })[0]).toEqual({ a: 'x', b: null });
  });
});
