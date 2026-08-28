import {
  canonicalJson,
  compareText,
  type NormalizedConnection,
  type NormalizedNode,
  type NormalizedWorkflow,
} from '@nodedelta/core';
import { similarity } from './value-diff.js';

export interface NodePair {
  before?: NormalizedNode;
  after?: NormalizedNode;
}

const RENAME_THRESHOLD = 0.84;
const AMBIGUITY_MARGIN = 0.03;

function levenshteinSimilarity(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return (
    1 -
    (previous[b.length] ?? Math.max(a.length, b.length)) /
      Math.max(a.length, b.length)
  );
}

function nodePayload(node: NormalizedNode): unknown {
  return {
    parameters: node.parameters,
    credentials: node.credentials ?? {},
    disabled: node.disabled ?? false,
    notes: node.notes ?? '',
    metadata: node.metadata ?? {},
    typeVersion: node.typeVersion ?? 1,
  };
}

function connectionSignature(
  node: NormalizedNode,
  connection: NormalizedConnection,
  nodeTypes: ReadonlyMap<string, string>,
): string | undefined {
  if (connection.sourceNode === node.name) {
    return canonicalJson({
      direction: 'out',
      adjacentType: nodeTypes.get(connection.targetNode) ?? 'unknown',
      outputType: connection.sourceOutputType,
      outputIndex: connection.sourceOutputIndex,
      inputType: connection.targetInputType,
      inputIndex: connection.targetInputIndex,
    });
  }
  if (connection.targetNode === node.name) {
    return canonicalJson({
      direction: 'in',
      adjacentType: nodeTypes.get(connection.sourceNode) ?? 'unknown',
      outputType: connection.sourceOutputType,
      outputIndex: connection.sourceOutputIndex,
      inputType: connection.targetInputType,
      inputIndex: connection.targetInputIndex,
    });
  }
  return undefined;
}

function neighborhoods(
  workflow: NormalizedWorkflow,
): Map<NormalizedNode, Set<string>> {
  const nodeTypes = new Map(
    workflow.nodes.map((item) => [item.name, item.type]),
  );
  return new Map(
    workflow.nodes.map((node) => [
      node,
      new Set(
        workflow.connections
          .map((connection) => connectionSignature(node, connection, nodeTypes))
          .filter((value): value is string => value !== undefined),
      ),
    ]),
  );
}

function setSimilarity(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number {
  if (left.size === 0 && right.size === 0) return 1;
  const union = new Set([...left, ...right]);
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / union.size;
}

function positionSimilarity(
  before: NormalizedNode,
  after: NormalizedNode,
): number {
  const distance = Math.hypot(
    before.position.x - after.position.x,
    before.position.y - after.position.y,
  );
  return Math.max(0, 1 - distance / 1000);
}

function renameScore(
  before: NormalizedNode,
  after: NormalizedNode,
  beforeNeighborhoods: ReadonlyMap<NormalizedNode, ReadonlySet<string>>,
  afterNeighborhoods: ReadonlyMap<NormalizedNode, ReadonlySet<string>>,
): number {
  if (before.type !== after.type) return 0;
  return (
    similarity(nodePayload(before), nodePayload(after)) * 0.45 +
    setSimilarity(
      beforeNeighborhoods.get(before) ?? new Set(),
      afterNeighborhoods.get(after) ?? new Set(),
    ) *
      0.25 +
    positionSimilarity(before, after) * 0.15 +
    levenshteinSimilarity(before.name, after.name) * 0.15
  );
}

function nodeOrder(left: NormalizedNode, right: NormalizedNode): number {
  return (
    compareText(left.name, right.name) ||
    compareText(left.id ?? '', right.id ?? '')
  );
}

function exactPass(
  before: Set<NormalizedNode>,
  after: Set<NormalizedNode>,
  key: (node: NormalizedNode) => string | undefined,
  pairs: NodePair[],
): void {
  const beforeGroups = new Map<string, NormalizedNode[]>();
  for (const node of before) {
    const value = key(node);
    if (value === undefined) continue;
    const group = beforeGroups.get(value) ?? [];
    group.push(node);
    beforeGroups.set(value, group);
  }
  for (const node of [...after].sort(nodeOrder)) {
    const value = key(node);
    if (value === undefined) continue;
    const candidates = beforeGroups
      .get(value)
      ?.filter((candidate) => before.has(candidate))
      .sort(nodeOrder);
    const match = candidates?.[0];
    if (match === undefined) continue;
    before.delete(match);
    after.delete(node);
    pairs.push({ before: match, after: node });
  }
}

interface Candidate {
  before: NormalizedNode;
  after: NormalizedNode;
  score: number;
}

function fuzzyPass(
  unmatchedBefore: Set<NormalizedNode>,
  unmatchedAfter: Set<NormalizedNode>,
  beforeWorkflow: NormalizedWorkflow,
  afterWorkflow: NormalizedWorkflow,
  pairs: NodePair[],
): void {
  const candidates: Candidate[] = [];
  const beforeNeighborhoods = neighborhoods(beforeWorkflow);
  const afterNeighborhoods = neighborhoods(afterWorkflow);
  for (const before of unmatchedBefore) {
    for (const after of unmatchedAfter) {
      const score = renameScore(
        before,
        after,
        beforeNeighborhoods,
        afterNeighborhoods,
      );
      if (score >= RENAME_THRESHOLD) candidates.push({ before, after, score });
    }
  }
  const byBefore = new Map<NormalizedNode, Candidate[]>();
  const byAfter = new Map<NormalizedNode, Candidate[]>();
  for (const candidate of candidates) {
    byBefore.set(candidate.before, [
      ...(byBefore.get(candidate.before) ?? []),
      candidate,
    ]);
    byAfter.set(candidate.after, [
      ...(byAfter.get(candidate.after) ?? []),
      candidate,
    ]);
  }
  const rank = (left: Candidate, right: Candidate): number =>
    right.score - left.score ||
    nodeOrder(left.before, right.before) ||
    nodeOrder(left.after, right.after);
  const unambiguousBest = (
    candidate: Candidate,
    group: Candidate[] | undefined,
  ): boolean => {
    const ranked = [...(group ?? [])].sort(rank);
    return (
      ranked[0] === candidate &&
      (ranked[1] === undefined ||
        candidate.score - ranked[1].score >= AMBIGUITY_MARGIN)
    );
  };
  for (const candidate of [...candidates].sort(rank)) {
    if (
      !unmatchedBefore.has(candidate.before) ||
      !unmatchedAfter.has(candidate.after)
    )
      continue;
    if (
      !unambiguousBest(candidate, byBefore.get(candidate.before)) ||
      !unambiguousBest(candidate, byAfter.get(candidate.after))
    )
      continue;
    unmatchedBefore.delete(candidate.before);
    unmatchedAfter.delete(candidate.after);
    pairs.push({ before: candidate.before, after: candidate.after });
  }
}

export function matchNodes(
  beforeWorkflow: NormalizedWorkflow,
  afterWorkflow: NormalizedWorkflow,
): NodePair[] {
  const before = new Set(beforeWorkflow.nodes);
  const after = new Set(afterWorkflow.nodes);
  const pairs: NodePair[] = [];
  exactPass(before, after, (node) => node.id, pairs);
  exactPass(before, after, (node) => `${node.type}\u0000${node.name}`, pairs);
  fuzzyPass(before, after, beforeWorkflow, afterWorkflow, pairs);
  for (const node of [...after].sort(nodeOrder)) pairs.push({ after: node });
  for (const node of [...before].sort(nodeOrder)) pairs.push({ before: node });
  return pairs;
}
