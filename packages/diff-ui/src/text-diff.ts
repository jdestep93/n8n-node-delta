export type DiffRowType = 'same' | 'added' | 'removed';

export interface DiffRow {
  type: DiffRowType;
  before?: string;
  after?: string;
}

export interface GapRow {
  type: 'gap';
  count: number;
}

export type TextDiffRow = DiffRow | GapRow;

const MAX_DIFF_ITEMS = 1500;

function removedRow(value: string): DiffRow {
  return { type: 'removed', before: value };
}

function addedRow(value: string): DiffRow {
  return { type: 'added', after: value };
}

function sameRow(before: string, after: string): DiffRow {
  return { type: 'same', before, after };
}

function longestCommonSuffixTable(
  before: string[],
  after: string[],
): number[][] {
  const table: number[][] = [];
  for (let beforeIndex = 0; beforeIndex <= before.length; beforeIndex += 1) {
    table.push(new Array<number>(after.length + 1).fill(0));
  }
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const currentRow = table[i];
    const nextRow = table[i + 1];
    if (currentRow === undefined || nextRow === undefined) continue;
    for (let j = after.length - 1; j >= 0; j -= 1) {
      const diagonal = nextRow[j + 1] ?? 0;
      const below = nextRow[j] ?? 0;
      const right = currentRow[j + 1] ?? 0;
      currentRow[j] =
        before[i] === after[j] ? diagonal + 1 : Math.max(below, right);
    }
  }
  return table;
}

export function diffTokenRows(before: string[], after: string[]): DiffRow[] {
  if (before.length > MAX_DIFF_ITEMS || after.length > MAX_DIFF_ITEMS) {
    return [...before.map(removedRow), ...after.map(addedRow)];
  }
  const table = longestCommonSuffixTable(before, after);
  const rows: DiffRow[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length && afterIndex < after.length) {
    if (before[beforeIndex] === after[afterIndex]) {
      rows.push(sameRow(before[beforeIndex] ?? '', after[afterIndex] ?? ''));
      beforeIndex += 1;
      afterIndex += 1;
    } else if (
      (table[beforeIndex + 1]?.[afterIndex] ?? 0) >=
      (table[beforeIndex]?.[afterIndex + 1] ?? 0)
    ) {
      rows.push(removedRow(before[beforeIndex] ?? ''));
      beforeIndex += 1;
    } else {
      rows.push(addedRow(after[afterIndex] ?? ''));
      afterIndex += 1;
    }
  }
  while (beforeIndex < before.length) {
    rows.push(removedRow(before[beforeIndex] ?? ''));
    beforeIndex += 1;
  }
  while (afterIndex < after.length) {
    rows.push(addedRow(after[afterIndex] ?? ''));
    afterIndex += 1;
  }
  return rows;
}

export function splitLines(value: string): string[] {
  return value.split(/\r\n|\r|\n/u);
}

export function diffTextRows(before: string, after: string): DiffRow[] {
  return diffTokenRows(splitLines(before), splitLines(after));
}

export function diffWords(before: string, after: string): DiffRow[] {
  const tokenize = (value: string): string[] =>
    value.split(/(\s+)/u).filter((token) => token !== '');
  return diffTokenRows(tokenize(before), tokenize(after));
}

export function compactRows(
  rows: readonly DiffRow[],
  context: number,
): TextDiffRow[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((row, index) => {
    if (row.type === 'same') return;
    const start = Math.max(0, index - context);
    const end = Math.min(rows.length - 1, index + context);
    for (let i = start; i <= end; i += 1) keep[i] = true;
  });
  const result: TextDiffRow[] = [];
  let gap = 0;
  rows.forEach((row, index) => {
    if (keep[index] === true) {
      if (gap > 0) {
        result.push({ type: 'gap', count: gap });
        gap = 0;
      }
      result.push(row);
    } else {
      gap += 1;
    }
  });
  if (gap > 0) result.push({ type: 'gap', count: gap });
  return result;
}

export function displayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '';
  }
}
