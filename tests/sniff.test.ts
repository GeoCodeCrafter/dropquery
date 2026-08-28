import { describe, expect, it } from 'vitest';
import { isNumeric, sniff, sniffBytes, splitRespectingQuotes } from '../src/engine/sniff.js';

describe('sniff', () => {
  it('reads magic bytes before believing anything else', () => {
    const parquet = new Uint8Array([0x50, 0x41, 0x52, 0x31, 0x00]);
    expect(sniff('nonsense,text', 'data.csv', parquet).format).toBe('parquet');

    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(sniff('anything', 'book.csv', zip).format).toBe('xlsx');
  });

  it('finds a tab separator in a file called .csv', () => {
    const result = sniff('name\tage\nada\t36\ngrace\t45', 'people.csv');

    expect(result.format).toBe('tsv');
    expect(result.delimiter).toBe('\t');
  });

  it('finds the semicolons in a European export', () => {
    const result = sniff('name;age\nada;36\ngrace;45', 'export.csv');

    expect(result.delimiter).toBe(';');
    expect(result.format).toBe('csv');
  });

  it('is not fooled by commas inside quoted prose', () => {
    // Only the semicolon divides every row evenly; the commas do not.
    const result = sniff(
      'name;note\nada;"born in London, England"\ngrace;"a compiler, and a rear admiral"',
      'notes.csv',
    );

    expect(result.delimiter).toBe(';');
  });

  it('tells ndjson from json', () => {
    expect(sniff('{"a":1}\n{"a":2}', 'x.txt').format).toBe('ndjson');
    expect(sniff('[{"a":1},{"a":2}]', 'x.txt').format).toBe('json');
    expect(sniff('{\n  "a": 1\n}', 'x.txt').format).toBe('json');
  });

  it('detects a header row by the absence of numbers', () => {
    expect(sniff('name,age\nada,36', 'p.csv').hasHeader).toBe(true);
    expect(sniff('ada,36\ngrace,45', 'p.csv').hasHeader).toBe(false);
  });

  it('falls back to the extension only when the content says nothing', () => {
    const result = sniff('a single line with no delimiters', 'mystery.parquet');

    expect(result.format).toBe('parquet');
    expect(result.reason).toContain('extension');
  });

  it('admits when it does not know', () => {
    expect(sniff('', 'empty.csv').format).toBe('unknown');
    expect(sniff('one line only', 'thing.bin').format).toBe('unknown');
  });

  it('strips a byte order mark before looking', () => {
    expect(sniff('﻿{"a":1}', 'x.json').format).toBe('json');
  });
});

describe('sniffBytes', () => {
  it('returns null for anything unrecognised', () => {
    expect(sniffBytes(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe('splitRespectingQuotes', () => {
  it('keeps a quoted delimiter inside its field', () => {
    expect(splitRespectingQuotes('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
  });

  it('unescapes a doubled quote', () => {
    expect(splitRespectingQuotes('a,"say ""hi""",c', ',')).toEqual(['a', 'say "hi"', 'c']);
  });

  it('returns a single field when there is no delimiter', () => {
    expect(splitRespectingQuotes('alone', ',')).toEqual(['alone']);
  });
});

describe('isNumeric', () => {
  it.each([
    ['36', true],
    ['-1.5', true],
    ['1e6', true],
    ['', false],
    ['   ', false],
    ['36 years', false],
    ['NaN', false],
  ])('%s', (input, expected) => {
    expect(isNumeric(input)).toBe(expected);
  });
});
