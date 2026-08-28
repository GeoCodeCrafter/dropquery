/**
 * Choosing the chart is a pure function of the result schema. Keeping it pure is
 * what makes the auto-selection testable, and the auto-selection is what makes
 * the tool feel immediate rather than like another SQL client.
 */

export type ColumnType = 'temporal' | 'numeric' | 'categorical' | 'boolean' | 'other';

export interface Column {
  name: string;
  type: ColumnType;
  /** Distinct values, where known. Drives bar-vs-scatter for categoricals. */
  cardinality?: number;
}

export type ChartForm = 'line' | 'bar' | 'scatter' | 'histogram' | 'table';

/**
 * Returns the chart form that best fits the columns, or 'table' when no chart
 * would say more than the numbers already do.
 */
export function chooseChart(columns: Column[]): ChartForm {
  const numeric = columns.filter((c) => c.type === 'numeric');
  const temporal = columns.filter((c) => c.type === 'temporal');
  const categorical = columns.filter((c) => c.type === 'categorical');

  if (temporal.length >= 1 && numeric.length >= 1) return 'line';
  if (categorical.length >= 1 && numeric.length >= 1) return 'bar';
  if (numeric.length >= 2) return 'scatter';
  if (numeric.length === 1) return 'histogram';
  return 'table';
}
