import { describe, expect, it } from 'vitest';
import { chooseChart, type Column } from '../src/chart/choose.js';

const col = (name: string, type: Column['type']): Column => ({ name, type });

describe('chooseChart', () => {
  it('picks a line for a time series', () => {
    expect(chooseChart([col('day', 'temporal'), col('revenue', 'numeric')])).toBe('line');
  });

  it('picks a bar for a category against a measure', () => {
    expect(chooseChart([col('region', 'categorical'), col('revenue', 'numeric')])).toBe('bar');
  });

  it('picks a scatter for two measures', () => {
    expect(chooseChart([col('x', 'numeric'), col('y', 'numeric')])).toBe('scatter');
  });

  it('falls back to the table when no chart would say more', () => {
    expect(chooseChart([col('id', 'other'), col('name', 'categorical')])).toBe('table');
  });
});
