import {
  compareText,
  type ConnectionChange,
  type DiffSummary,
  type NodeChange,
  type NodeChangeKind,
  type NormalizedConnection,
  type NormalizedNode,
  type NormalizedWorkflow,
  type ValueChange,
  type WorkflowDiff,
  type WorkflowDiffer,
} from '@nodedelta/core';
import { matchNodes, type NodePair } from './node-matcher.js';
import { collectValueChanges } from './value-diff.js';

const nodeKindOrder: Record<NodeChangeKind, number> = {
  added: 0,
  removed: 1,
  modified: 2,
  renamed: 3,
  moved: 4,
};
const DEFAULT_TYPE_VERSION = 1;
const DEFAULT_DISABLED = false;
const DEFAULT_NOTES = '';

const isNameChange = (change: ValueChange): boolean => change.path === 'name';
const isMovementChange = (change: ValueChange): boolean =>
  change.path === 'position.x' || change.path === 'position.y';
const isModificationChange = (change: ValueChange): boolean =>
  !isNameChange(change) && !isMovementChange(change);

function directChange(
  path: string,
  before: unknown,
  after: unknown,
): ValueChange {
  if (before === undefined) return { path, kind: 'added', after };
  if (after === undefined) return { path, kind: 'removed', before };
  return { path, kind: 'modified', before, after };
}

function nodeFieldChanges(
  before: NormalizedNode,
  after: NormalizedNode,
): ValueChange[] {
  const changes: ValueChange[] = [];
  if (before.name !== after.name)
    changes.push(directChange('name', before.name, after.name));
  if (before.type !== after.type)
    changes.push(directChange('type', before.type, after.type));
  if (
    (before.typeVersion ?? DEFAULT_TYPE_VERSION) !==
    (after.typeVersion ?? DEFAULT_TYPE_VERSION)
  ) {
    changes.push(
      directChange('typeVersion', before.typeVersion, after.typeVersion),
    );
  }
  if (before.position.x !== after.position.x)
    changes.push(
      directChange('position.x', before.position.x, after.position.x),
    );
  if (before.position.y !== after.position.y)
    changes.push(
      directChange('position.y', before.position.y, after.position.y),
    );
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
    changes.push(directChange('disabled', before.disabled, after.disabled));
  }
  if ((before.notes ?? DEFAULT_NOTES) !== (after.notes ?? DEFAULT_NOTES)) {
    changes.push(directChange('notes', before.notes, after.notes));
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

function compareNodeChanges(left: NodeChange, right: NodeChange): number {
  return (
    nodeKindOrder[left.kind] - nodeKindOrder[right.kind] ||
    compareText(
      left.after?.name ?? left.before?.name ?? '',
      right.after?.name ?? right.before?.name ?? '',
    ) ||
    compareText(
      left.after?.id ?? left.before?.id ?? '',
      right.after?.id ?? right.before?.id ?? '',
    )
  );
}

function buildNodeChanges(pairs: NodePair[]): NodeChange[] {
  const result: NodeChange[] = [];
  for (const pair of pairs) {
    if (pair.before === undefined) {
      if (pair.after !== undefined)
        result.push({ kind: 'added', after: pair.after, changes: [] });
      continue;
    }
    if (pair.after === undefined) {
      result.push({ kind: 'removed', before: pair.before, changes: [] });
      continue;
    }
    const changes = nodeFieldChanges(pair.before, pair.after);
    if (changes.length === 0) continue;
    const kind: NodeChangeKind = changes.some(isModificationChange)
      ? 'modified'
      : changes.some(isNameChange)
        ? 'renamed'
        : 'moved';
    result.push({ kind, before: pair.before, after: pair.after, changes });
  }
  return result.sort(compareNodeChanges);
}

function renameMap(pairs: NodePair[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const pair of pairs) {
    if (
      pair.before !== undefined &&
      pair.after !== undefined &&
      pair.before.name !== pair.after.name
    ) {
      result.set(pair.before.name, pair.after.name);
    }
  }
  return result;
}

function remap(
  connection: NormalizedConnection,
  renames: ReadonlyMap<string, string>,
): NormalizedConnection {
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
  renames: ReadonlyMap<string, string>,
): ConnectionChange[] {
  const beforeKeys = new Set(
    before.map((connection) => connectionKey(remap(connection, renames))),
  );
  const afterKeys = new Set(after.map(connectionKey));
  const added = after
    .filter((connection) => !beforeKeys.has(connectionKey(connection)))
    .map((connection): ConnectionChange => ({ kind: 'added', connection }));
  const removed = before
    .filter(
      (connection) => !afterKeys.has(connectionKey(remap(connection, renames))),
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
  if (before.workflowId !== after.workflowId)
    changes.push(
      directChange('workflowId', before.workflowId, after.workflowId),
    );
  if (before.name !== after.name)
    changes.push(directChange('name', before.name, after.name));
  if ((before.active ?? false) !== (after.active ?? false))
    changes.push(directChange('active', before.active, after.active));
  collectValueChanges(before.settings, after.settings, 'settings', changes);
  collectValueChanges(
    before.metadata ?? {},
    after.metadata ?? {},
    'metadata',
    changes,
  );
  return changes.sort((left, right) => compareText(left.path, right.path));
}

export class SemanticWorkflowDiffer implements WorkflowDiffer {
  diff(before: NormalizedWorkflow, after: NormalizedWorkflow): WorkflowDiff {
    const pairs = matchNodes(before, after);
    const nodeChanges = buildNodeChanges(pairs);
    const connectionChanges = buildConnectionChanges(
      before.connections,
      after.connections,
      renameMap(pairs),
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
    const hasChanges =
      nodeChanges.length > 0 ||
      connectionChanges.length > 0 ||
      workflowChanges.length > 0;
    return {
      summary,
      nodeChanges,
      connectionChanges,
      workflowChanges,
      hasChanges,
    };
  }
}

export function diffWorkflows(
  before: NormalizedWorkflow,
  after: NormalizedWorkflow,
): WorkflowDiff {
  return new SemanticWorkflowDiffer().diff(before, after);
}
