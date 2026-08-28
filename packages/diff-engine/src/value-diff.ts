import { canonicalJson, isRecord, type ValueChange } from '@nodedelta/core';

export function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => valuesEqual(item, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => key in right && valuesEqual(left[key], right[key]),
      )
    );
  }
  return false;
}

function joinPath(parent: string, key: string | number): string {
  return parent === '' ? String(key) : `${parent}.${String(key)}`;
}

function valueChange(
  before: unknown,
  after: unknown,
  path: string,
): ValueChange {
  if (before === undefined) return { path, kind: 'added', after };
  if (after === undefined) return { path, kind: 'removed', before };
  return { path, kind: 'modified', before, after };
}

interface Anchor {
  beforeIndex: number;
  afterIndex: number;
}

function alignmentKey(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of ['id', 'name', 'key'] as const) {
    const candidate = value[key];
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      return `${key}:${String(candidate)}`;
    }
  }
  return undefined;
}

function valuesAlign(left: unknown, right: unknown): boolean {
  if (valuesEqual(left, right)) return true;
  const leftKey = alignmentKey(left);
  return leftKey !== undefined && leftKey === alignmentKey(right);
}

function exactObjectAnchors(before: unknown[], after: unknown[]): Anchor[] {
  const rows = before.length + 1;
  const columns = after.length + 1;
  const lengths = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (
    let beforeIndex = before.length - 1;
    beforeIndex >= 0;
    beforeIndex -= 1
  ) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      const current = lengths[beforeIndex];
      const next = lengths[beforeIndex + 1];
      if (current === undefined || next === undefined) continue;
      current[afterIndex] = valuesAlign(before[beforeIndex], after[afterIndex])
        ? (next[afterIndex + 1] ?? 0) + 1
        : Math.max(next[afterIndex] ?? 0, current[afterIndex + 1] ?? 0);
    }
  }
  const anchors: Anchor[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length && afterIndex < after.length) {
    if (valuesAlign(before[beforeIndex], after[afterIndex])) {
      anchors.push({ beforeIndex, afterIndex });
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }
    const skipBefore = lengths[beforeIndex + 1]?.[afterIndex] ?? 0;
    const skipAfter = lengths[beforeIndex]?.[afterIndex + 1] ?? 0;
    if (skipBefore > skipAfter) beforeIndex += 1;
    else afterIndex += 1;
  }
  return anchors;
}

function collectAlignedObjectArrayChanges(
  before: unknown[],
  after: unknown[],
  path: string,
  changes: ValueChange[],
): void {
  const anchors = exactObjectAnchors(before, after);
  let beforeStart = 0;
  let afterStart = 0;
  for (const anchor of [
    ...anchors,
    { beforeIndex: before.length, afterIndex: after.length },
  ]) {
    const beforeGap = anchor.beforeIndex - beforeStart;
    const afterGap = anchor.afterIndex - afterStart;
    const paired = Math.min(beforeGap, afterGap);
    for (let offset = 0; offset < paired; offset += 1) {
      collectValueChanges(
        before[beforeStart + offset],
        after[afterStart + offset],
        joinPath(path, afterStart + offset),
        changes,
      );
    }
    for (let offset = paired; offset < beforeGap; offset += 1) {
      changes.push(
        valueChange(
          before[beforeStart + offset],
          undefined,
          joinPath(path, beforeStart + offset),
        ),
      );
    }
    for (let offset = paired; offset < afterGap; offset += 1) {
      changes.push(
        valueChange(
          undefined,
          after[afterStart + offset],
          joinPath(path, afterStart + offset),
        ),
      );
    }
    if (
      anchor.beforeIndex < before.length &&
      anchor.afterIndex < after.length
    ) {
      collectValueChanges(
        before[anchor.beforeIndex],
        after[anchor.afterIndex],
        joinPath(path, anchor.afterIndex),
        changes,
      );
    }
    beforeStart = anchor.beforeIndex + 1;
    afterStart = anchor.afterIndex + 1;
  }
}

export function collectValueChanges(
  before: unknown,
  after: unknown,
  path: string,
  changes: ValueChange[],
): void {
  if (valuesEqual(before, after)) return;
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      collectValueChanges(
        before[key],
        after[key],
        joinPath(path, key),
        changes,
      );
    }
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const containsObjects = before.some(isRecord) || after.some(isRecord);
    if (containsObjects) {
      collectAlignedObjectArrayChanges(before, after, path, changes);
      return;
    }
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      collectValueChanges(
        before[index],
        after[index],
        joinPath(path, index),
        changes,
      );
    }
    return;
  }
  changes.push(valueChange(before, after, path));
}

export function similarity(left: unknown, right: unknown): number {
  if (valuesEqual(left, right)) return 1;
  const flatten = (
    value: unknown,
    prefix = '',
    result = new Map<string, string>(),
  ): Map<string, string> => {
    if (isRecord(value)) {
      for (const key of Object.keys(value).sort())
        flatten(value[key], joinPath(prefix, key), result);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) =>
        flatten(item, joinPath(prefix, index), result),
      );
    } else result.set(prefix, canonicalJson(value));
    return result;
  };
  const leftLeaves = flatten(left);
  const rightLeaves = flatten(right);
  const paths = new Set([...leftLeaves.keys(), ...rightLeaves.keys()]);
  if (paths.size === 0) return 1;
  let score = 0;
  for (const path of paths) {
    if (leftLeaves.get(path) === rightLeaves.get(path)) score += 1;
    else if (leftLeaves.has(path) && rightLeaves.has(path)) score += 0.5;
  }
  return score / paths.size;
}
