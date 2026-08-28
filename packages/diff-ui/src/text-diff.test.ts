import { describe, expect, it } from 'vitest';

import {
  compactRows,
  diffTextRows,
  diffTokenRows,
  diffWords,
  displayText,
  splitLines,
} from './text-diff.js';

describe('line diffing', () => {
  it('reports identical text as unchanged rows', () => {
    expect(diffTextRows('a\nb\nc', 'a\nb\nc')).toEqual([
      { type: 'same', before: 'a', after: 'a' },
      { type: 'same', before: 'b', after: 'b' },
      { type: 'same', before: 'c', after: 'c' },
    ]);
  });

  it('marks appended lines as additions', () => {
    expect(diffTextRows('a', 'a\nb')).toEqual([
      { type: 'same', before: 'a', after: 'a' },
      { type: 'added', after: 'b' },
    ]);
  });

  it('marks removed lines', () => {
    expect(diffTextRows('a\nb\nc', 'a\nc')).toEqual([
      { type: 'same', before: 'a', after: 'a' },
      { type: 'removed', before: 'b' },
      { type: 'same', before: 'c', after: 'c' },
    ]);
  });

  it('drains removals before additions for replaced text', () => {
    expect(
      diffTextRows('old one\nold two', 'new one\nnew two').map(
        (row) => row.type,
      ),
    ).toEqual(['removed', 'removed', 'added', 'added']);
  });

  it('splits CRLF and CR line endings', () => {
    expect(splitLines('a\r\nb\rc')).toEqual(['a', 'b', 'c']);
  });

  it('falls back to full replacement for very large inputs', () => {
    const before = Array.from({ length: 1600 }, (_, i) => `old ${i}`);
    const after = Array.from({ length: 1600 }, (_, i) => `new ${i}`);
    const rows = diffTokenRows(before, after);
    expect(rows.filter((row) => row.type === 'same')).toHaveLength(0);
    expect(rows.filter((row) => row.type === 'removed')).toHaveLength(1600);
    expect(rows.filter((row) => row.type === 'added')).toHaveLength(1600);
  });
});

describe('word diffing', () => {
  it('interleaves additions around shared words within a line', () => {
    expect(diffWords('return items;', 'return all items;')).toEqual([
      { type: 'same', before: 'return', after: 'return' },
      { type: 'same', before: ' ', after: ' ' },
      { type: 'added', after: 'all' },
      { type: 'added', after: ' ' },
      { type: 'same', before: 'items;', after: 'items;' },
    ]);
  });
});

describe('compacting rows', () => {
  it('keeps context around changes and collapses the rest into gaps', () => {
    const rows = diffTextRows(
      '1\n2\n3\n4\n5\n6\nx\n7\n8\n9\n10\n11\n12',
      '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12',
    );
    expect(compactRows(rows, 1)).toEqual([
      { type: 'gap', count: 5 },
      { type: 'same', before: '6', after: '6' },
      { type: 'removed', before: 'x' },
      { type: 'same', before: '7', after: '7' },
      { type: 'gap', count: 5 },
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(compactRows([], 2)).toEqual([]);
  });
});

describe('displaying values', () => {
  it('passes strings through unchanged', () => {
    expect(displayText('hello')).toBe('hello');
  });

  it('formats non-string values as indented JSON', () => {
    expect(displayText({ b: 2, a: 1 })).toBe('{\n  "b": 2,\n  "a": 1\n}');
    expect(displayText(42)).toBe('42');
  });

  it('renders missing values as empty strings', () => {
    expect(displayText(undefined)).toBe('');
    expect(displayText(null)).toBe('');
  });
});
