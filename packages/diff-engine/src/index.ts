import type {
  ConnectionChange,
  DiffSummary,
  NodeChange,
  NodeChangeKind,
  NormalizedConnection,
  NormalizedNode,
  NormalizedWorkflow,
  ValueChange,
  WorkflowDiff,
  WorkflowDiffer,
} from '@flowdiff/core';

export type {
  ConnectionChange,
  DiffSummary,
  NodeChange,
  NormalizedConnection,
  NormalizedNode,
  NormalizedWorkflow,
  ValueChange,
  WorkflowDiff,
  WorkflowDiffer,
} from '@flowdiff/core';

/**
 * Primary-kind precedence when a node changed in several ways at once: any
 * non-name/non-position change classifies the node as `modified`; otherwise a
 * name change is `renamed`; otherwise a position change is `moved`. Every
 * individual change stays visible in `NodeChange.changes`.
 */
const nodeKindOrder: Record<NodeChangeKind, number> = {
  added: 0,
  removed: 1,
  modified: 2,
  renamed: 3,
  moved: 4,
};

// n8n treats omitted node fields as these defaults, so a field flip between
// "missing" and the default value is not a meaningful change.
const DEFAULT_TYPE_VERSION = 1;
const DEFAULT_DISABLED = false;
const DEFAULT_NOTES = '';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Structural equality. Object key order is not meaningful (the normalizer
 * canonicalizes it away), but array order is meaningful.
 */
function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
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

/**
 * Collects dotted-path value changes between two values. Record keys are
 * compared as a sorted union (order-insensitive); arrays are compared
 * element-wise by index so reordering is reported. Values are recorded with
 * `before`/`after` only when present, so added or removed keys are visible.
 */
function collectValueChanges(
  before: unknown,
  after: unknown,
  path: string,
  changes: ValueChange[],
): void {
  if (valuesEqual(before, after)) {
    return;
  }
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

  const change: ValueChange = { path };
  if (before !== undefined) {
    change.before = before;
  }
  if (after !== undefined) {
    change.after = after;
  }
  changes.push(change);
}

function isNameChange(change: ValueChange): boolean {
  return change.path === 'name';
}

function isMovementChange(change: ValueChange): boolean {
  return change.path === 'position.x' || change.path === 'position.y';
}

function isModificationChange(change: ValueChange): boolean {
  return !isNameChange(change) && !isMovementChange(change);
}

/**
 * Deterministic JSON with recursively sorted object keys and `undefined`
 * values dropped, so it is stable across key insertion order. Used for
 * rename fingerprints; array order remains significant.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value
      .filter((item) => item !== undefined)
      .map((item) => canonicalJson(item))
      .join(',')}]`;
  }
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * Content fingerprint for conservative fuzzy rename detection: everything
 * except the node name and position. Two unmatched nodes with identical
 * fingerprints are considered the same node that was renamed (and possibly
 * moved); any content difference means they are treated as separate nodes.
 */
function nodeFingerprint(node: NormalizedNode): string {
  return canonicalJson({
    credentials: node.credentials ?? {},
    disabled: node.disabled ?? DEFAULT_DISABLED,
    notes: node.notes ?? DEFAULT_NOTES,
    parameters: node.parameters ?? {},
    type: node.type,
    typeVersion: node.typeVersion ?? DEFAULT_TYPE_VERSION,
  });
}

/**
 * Compares two matched nodes field by field. Missing optional fields are
 * compared against their n8n defaults so absence is not reported as a change.
 */
function nodeFieldChanges(
  before: NormalizedNode,
  after: NormalizedNode,
): ValueChange[] {
  const changes: ValueChange[] = [];

  if (before.name !== after.name) {
    changes.push({ path: 'name', before: before.name, after: after.name });
  }
  if (before.type !== after.type) {
    changes.push({ path: 'type', before: before.type, after: after.type });
  }
  if (
    (before.typeVersion ?? DEFAULT_TYPE_VERSION) !==
    (after.typeVersion ?? DEFAULT_TYPE_VERSION)
  ) {
    changes.push({
      path: 'typeVersion',
      ...(before.typeVersion === undefined
        ? {}
        : { before: before.typeVersion }),
      ...(after.typeVersion === undefined ? {} : { after: after.typeVersion }),
    });
  }
  if (before.position.x !== after.position.x) {
    changes.push({
      path: 'position.x',
      before: before.position.x,
      after: after.position.x,
    });
  }
  if (before.position.y !== after.position.y) {
    changes.push({
      path: 'position.y',
      before: before.position.y,
      after: after.position.y,
    });
  }
  collectValueChanges(
    before.parameters,
    after.parameters,
    'parameters',
    changes,
  );
  if (
    (before.disabled ?? DEFAULT_DISABLED) !==
    (after.disabled ?? DEFAULT_DISABLED)
  ) {
    changes.push({
      path: 'disabled',
      ...(before.disabled === undefined ? {} : { before: before.disabled }),
      ...(after.disabled === undefined ? {} : { after: after.disabled }),
    });
  }
  if ((before.notes ?? DEFAULT_NOTES) !== (after.notes ?? DEFAULT_NOTES)) {
    changes.push({
      path: 'notes',
      ...(before.notes === undefined ? {} : { before: before.notes }),
      ...(after.notes === undefined ? {} : { after: after.notes }),
    });
  }
  collectValueChanges(
    before.credentials ?? {},
    after.credentials ?? {},
    'credentials',
    changes,
  );
  collectValueChanges(
    before.metadata ?? {},
    after.metadata ?? {},
    'metadata',
    changes,
  );

  return changes;
}

interface NodePair {
  before?: NormalizedNode;
  after?: NormalizedNode;
}

/**
 * Nodes are matched in three conservative stages:
 *
 * 1. exact `id` match (n8n node ids are stable across saves);
 * 2. exact name match for nodes without an id on either side;
 * 3. conservative fuzzy rename: unmatched nodes with identical content
 *    fingerprints (everything except name and position), only when the
 *    fingerprint is unambiguous — exactly one unmatched candidate on each
 *    side. Any ambiguity leaves both nodes unmatched.
 *
 * Unmatched nodes become additions or removals. A rename is only detectable
 * through stages 1 and 3; stage 2 matches by identical name, so it can never
 * observe a rename.
 */
function matchNodes(
  before: NormalizedNode[],
  after: NormalizedNode[],
): NodePair[] {
  const beforeById = new Map<string, NormalizedNode>();
  const beforeByName = new Map<string, NormalizedNode>();
  for (const node of before) {
    if (node.id === undefined) {
      beforeByName.set(node.name, node);
    } else {
      beforeById.set(node.id, node);
    }
  }

  const pairs: NodePair[] = [];
  const unmatchedBefore = new Set<NormalizedNode>(before);
  const unmatchedAfter = new Set<NormalizedNode>();

  for (const node of after) {
    const match =
      node.id === undefined
        ? beforeByName.get(node.name)
        : beforeById.get(node.id);
    if (match === undefined || !unmatchedBefore.has(match)) {
      unmatchedAfter.add(node);
      continue;
    }
    unmatchedBefore.delete(match);
    pairs.push({ before: match, after: node });
  }

  // Conservative fuzzy rename pass over the leftovers.
  const beforeByFingerprint = new Map<string, NormalizedNode[]>();
  for (const node of unmatchedBefore) {
    const fingerprint = nodeFingerprint(node);
    const candidates = beforeByFingerprint.get(fingerprint);
    if (candidates === undefined) {
      beforeByFingerprint.set(fingerprint, [node]);
    } else {
      candidates.push(node);
    }
  }
  const afterFingerprints = new Map<string, number>();
  for (const node of unmatchedAfter) {
    const fingerprint = nodeFingerprint(node);
    afterFingerprints.set(
      fingerprint,
      (afterFingerprints.get(fingerprint) ?? 0) + 1,
    );
  }
  const fuzzyMatched = new Set<NormalizedNode>();
  for (const node of unmatchedAfter) {
    const fingerprint = nodeFingerprint(node);
    const candidates = beforeByFingerprint.get(fingerprint);
    if (
      candidates === undefined ||
      candidates.length !== 1 ||
      afterFingerprints.get(fingerprint) !== 1
    ) {
      continue;
    }
    const candidate = candidates[0];
    if (candidate === undefined || fuzzyMatched.has(candidate)) {
      continue;
    }
    fuzzyMatched.add(candidate);
    unmatchedBefore.delete(candidate);
    unmatchedAfter.delete(node);
    pairs.push({ before: candidate, after: node });
  }

  for (const node of unmatchedAfter) {
    pairs.push({ after: node });
  }
  for (const node of unmatchedBefore) {
    pairs.push({ before: node });
  }

  return pairs;
}

function displayNameOf(change: NodeChange): string {
  return change.after?.name ?? change.before?.name ?? '';
}

function displayIdOf(change: NodeChange): string {
  return change.after?.id ?? change.before?.id ?? '';
}

function compareNodeChanges(left: NodeChange, right: NodeChange): number {
  return (
    nodeKindOrder[left.kind] - nodeKindOrder[right.kind] ||
    compareText(displayNameOf(left), displayNameOf(right)) ||
    compareText(displayIdOf(left), displayIdOf(right))
  );
}

function buildNodeChanges(pairs: NodePair[]): NodeChange[] {
  const changes: NodeChange[] = [];

  for (const pair of pairs) {
    if (pair.before === undefined) {
      if (pair.after !== undefined) {
        changes.push({ kind: 'added', after: pair.after, changes: [] });
      }
      continue;
    }
    if (pair.after === undefined) {
      changes.push({ kind: 'removed', before: pair.before, changes: [] });
      continue;
    }

    const fieldChanges = nodeFieldChanges(pair.before, pair.after);
    if (fieldChanges.length === 0) {
      continue;
    }

    // Primary kind: any content change wins, then rename, then movement.
    // Independent per-aspect counting happens in the summary.
    const kind: NodeChangeKind = fieldChanges.some(isModificationChange)
      ? 'modified'
      : fieldChanges.some(isNameChange)
        ? 'renamed'
        : 'moved';

    changes.push({
      kind,
      before: pair.before,
      after: pair.after,
      changes: fieldChanges,
    });
  }

  return changes.sort(compareNodeChanges);
}

/**
 * Old-name → new-name map for matched nodes that were renamed. Used to remap
 * connection endpoints so that renaming a node does not masquerade as
 * connection churn.
 */
function buildRenameMap(pairs: NodePair[]): Map<string, string> {
  const renames = new Map<string, string>();
  for (const pair of pairs) {
    if (
      pair.before !== undefined &&
      pair.after !== undefined &&
      pair.before.name !== pair.after.name
    ) {
      renames.set(pair.before.name, pair.after.name);
    }
  }
  return renames;
}

function remapConnectionNames(
  connection: NormalizedConnection,
  renames: Map<string, string>,
): NormalizedConnection {
  if (renames.size === 0) {
    return connection;
  }
  return {
    ...connection,
    sourceNode: renames.get(connection.sourceNode) ?? connection.sourceNode,
    targetNode: renames.get(connection.targetNode) ?? connection.targetNode,
  };
}

function connectionKey(connection: NormalizedConnection): string {
  return [
    connection.sourceNode,
    connection.sourceOutputType,
    connection.sourceOutputIndex,
    connection.targetNode,
    connection.targetInputType,
    connection.targetInputIndex,
  ].join('\u0000');
}

function compareConnections(
  left: NormalizedConnection,
  right: NormalizedConnection,
): number {
  return (
    compareText(left.sourceNode, right.sourceNode) ||
    compareText(left.sourceOutputType, right.sourceOutputType) ||
    left.sourceOutputIndex - right.sourceOutputIndex ||
    compareText(left.targetNode, right.targetNode) ||
    compareText(left.targetInputType, right.targetInputType) ||
    left.targetInputIndex - right.targetInputIndex
  );
}

function buildConnectionChanges(
  before: NormalizedConnection[],
  after: NormalizedConnection[],
  renames: Map<string, string>,
): ConnectionChange[] {
  // Before-side endpoints are remapped through detected renames so a pure
  // node rename does not appear as connection removal + addition. Rewiring
  // changes still surface because the remapped key then differs.
  const beforeKeys = new Set(
    before.map((connection) =>
      connectionKey(remapConnectionNames(connection, renames)),
    ),
  );
  const afterKeys = new Set(after.map(connectionKey));

  const added = after
    .filter((connection) => !beforeKeys.has(connectionKey(connection)))
    .map((connection): ConnectionChange => ({ kind: 'added', connection }));
  const removed = before
    .filter(
      (connection) =>
        !afterKeys.has(
          connectionKey(remapConnectionNames(connection, renames)),
        ),
    )
    .map((connection): ConnectionChange => ({ kind: 'removed', connection }));

  return [...added, ...removed].sort(
    (left, right) =>
      nodeKindOrder[left.kind] - nodeKindOrder[right.kind] ||
      compareConnections(left.connection, right.connection),
  );
}

function buildWorkflowChanges(
  before: NormalizedWorkflow,
  after: NormalizedWorkflow,
): ValueChange[] {
  const changes: ValueChange[] = [];

  if (before.workflowId !== after.workflowId) {
    changes.push({
      path: 'workflowId',
      ...(before.workflowId === undefined ? {} : { before: before.workflowId }),
      ...(after.workflowId === undefined ? {} : { after: after.workflowId }),
    });
  }
  if (before.name !== after.name) {
    changes.push({ path: 'name', before: before.name, after: after.name });
  }
  if ((before.active ?? false) !== (after.active ?? false)) {
    changes.push({
      path: 'active',
      ...(before.active === undefined ? {} : { before: before.active }),
      ...(after.active === undefined ? {} : { after: after.active }),
    });
  }
  collectValueChanges(before.settings, after.settings, 'settings', changes);

  return changes.sort((left, right) => compareText(left.path, right.path));
}

/**
 * Browser-independent semantic workflow comparison. Works on normalized
 * workflows (see `@flowdiff/n8n-normalizer`); input object key order is not
 * significant, while parameter array order is treated as meaningful.
 *
 * Semantics:
 * - `NodeChange.kind` is the primary classification (modified > renamed >
 *   moved); every individual change stays visible in `changes`.
 * - Summary counters are independent per aspect: a node that moved and was
 *   modified increments both `nodesMoved` and `nodesModified`, so movement is
 *   never hidden by other changes.
 * - Connection endpoints are remapped through detected renames (exact and
 *   conservative fuzzy), so renaming a node alone produces no connection
 *   churn, while genuine rewiring still does.
 */
export class SemanticWorkflowDiffer implements WorkflowDiffer {
  diff(before: NormalizedWorkflow, after: NormalizedWorkflow): WorkflowDiff {
    const pairs = matchNodes(before.nodes, after.nodes);
    const renames = buildRenameMap(pairs);
    const nodeChanges = buildNodeChanges(pairs);
    const connectionChanges = buildConnectionChanges(
      before.connections,
      after.connections,
      renames,
    );
    const workflowChanges = buildWorkflowChanges(before, after);

    const summary: DiffSummary = {
      nodesAdded: nodeChanges.filter((change) => change.kind === 'added')
        .length,
      nodesRemoved: nodeChanges.filter((change) => change.kind === 'removed')
        .length,
      nodesModified: nodeChanges.filter((change) =>
        change.changes.some(isModificationChange),
      ).length,
      nodesRenamed: nodeChanges.filter((change) =>
        change.changes.some(isNameChange),
      ).length,
      nodesMoved: nodeChanges.filter((change) =>
        change.changes.some(isMovementChange),
      ).length,
      connectionsAdded: connectionChanges.filter(
        (change) => change.kind === 'added',
      ).length,
      connectionsRemoved: connectionChanges.filter(
        (change) => change.kind === 'removed',
      ).length,
      workflowChanges: workflowChanges.length,
    };

    return { summary, nodeChanges, connectionChanges, workflowChanges };
  }
}

export function diffWorkflows(
  before: NormalizedWorkflow,
  after: NormalizedWorkflow,
): WorkflowDiff {
  return new SemanticWorkflowDiffer().diff(before, after);
}

/** Specialized read-only rendering kinds for changed text values (T09 seam). */
export type SpecializedTextKind =
  'expression' | 'javascript' | 'json' | 'python' | 'sql' | 'text';

const TEXT_PARAMETER_PATTERNS: ReadonlyArray<[RegExp, SpecializedTextKind]> = [
  [/(^|\.)jsCode$/i, 'javascript'],
  [/(^|\.)pythonCode$/i, 'python'],
  [/(^|\.)query$/i, 'sql'],
];

/**
 * Classifies a changed value for specialized text rendering. Known n8n
 * parameter names win; otherwise the value shape decides: n8n expressions
 * (`={{ ... }}`) are inert strings rendered as expressions, and balanced
 * JSON documents are rendered as JSON. Everything else is plain text.
 */
export function classifyTextParameter(
  path: string,
  value: unknown,
): SpecializedTextKind {
  if (typeof value !== 'string') {
    return 'text';
  }
  for (const [pattern, kind] of TEXT_PARAMETER_PATTERNS) {
    if (pattern.test(path)) {
      return kind;
    }
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('={{')) {
    return 'expression';
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      return 'text';
    }
  }
  return 'text';
}

export function classifyValueChange(change: ValueChange): SpecializedTextKind {
  return classifyTextParameter(change.path, change.after ?? change.before);
}
