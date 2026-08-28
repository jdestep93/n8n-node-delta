import type {
  ConnectionChange,
  DiffSummary,
  NodeChange,
  NormalizedPosition,
  ValueChange,
  WorkflowDiff,
} from '@nodedelta/core';

export type ChangeCategory = 'node' | 'connection' | 'workflow';
export type DiffFilter =
  'all' | 'added' | 'removed' | 'modified' | 'moved' | 'connections';

export const DIFF_FILTER_OPTIONS: ReadonlyArray<{
  value: DiffFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'added', label: 'Added' },
  { value: 'removed', label: 'Removed' },
  { value: 'modified', label: 'Modified' },
  { value: 'moved', label: 'Moved' },
  { value: 'connections', label: 'Connections' },
];

export interface ChangeEntry {
  id: string;
  category: ChangeCategory;
  kind: string;
  title: string;
  detail?: string;
  searchText: string;
  filterKinds: readonly DiffFilter[];
  nodeId?: string | undefined;
  nodeChange?: NodeChange;
  connectionChange?: ConnectionChange;
  valueChange?: ValueChange;
}

export const SUMMARY_CHIP_LABELS: ReadonlyArray<{
  key: keyof DiffSummary;
  one: string;
  many: string;
}> = [
  { key: 'nodesAdded', one: 'node added', many: 'nodes added' },
  { key: 'nodesRemoved', one: 'node removed', many: 'nodes removed' },
  { key: 'nodesModified', one: 'node modified', many: 'nodes modified' },
  { key: 'nodesRenamed', one: 'node renamed', many: 'nodes renamed' },
  { key: 'nodesMoved', one: 'node moved', many: 'nodes moved' },
  {
    key: 'connectionsAdded',
    one: 'connection added',
    many: 'connections added',
  },
  {
    key: 'connectionsRemoved',
    one: 'connection removed',
    many: 'connections removed',
  },
  { key: 'workflowChanges', one: 'setting changed', many: 'settings changed' },
];

function formatPosition(
  position: NormalizedPosition | undefined,
): string | undefined {
  return position === undefined ? undefined : `${position.x}, ${position.y}`;
}

function nodeEntry(change: NodeChange, index: number): ChangeEntry {
  const beforeName = change.before?.name;
  const afterName = change.after?.name;
  let title: string;
  let detail: string | undefined;
  switch (change.kind) {
    case 'added':
      title = `Added node "${afterName ?? ''}"`;
      break;
    case 'removed':
      title = `Removed node "${beforeName ?? ''}"`;
      break;
    case 'renamed':
      title = `Renamed node "${beforeName ?? ''}" → "${afterName ?? ''}"`;
      break;
    case 'moved': {
      title = `Moved node "${afterName ?? beforeName ?? ''}"`;
      const before = formatPosition(change.before?.position);
      const after = formatPosition(change.after?.position);
      if (before !== undefined && after !== undefined) {
        detail = `(${before}) → (${after})`;
      }
      break;
    }
    case 'modified':
      title = `Modified node "${afterName ?? beforeName ?? ''}"`;
      break;
  }
  const type = change.after?.type ?? change.before?.type;
  const hasMovement = change.changes.some(
    (valueChange) =>
      valueChange.path === 'position.x' || valueChange.path === 'position.y',
  );
  const hasModification = change.changes.some(
    (valueChange) =>
      valueChange.path !== 'name' &&
      valueChange.path !== 'position.x' &&
      valueChange.path !== 'position.y',
  );
  const filterKinds: DiffFilter[] = [
    change.kind === 'renamed' ? 'modified' : change.kind,
  ];
  if (hasMovement && !filterKinds.includes('moved')) filterKinds.push('moved');
  if (hasModification && !filterKinds.includes('modified')) {
    filterKinds.push('modified');
  }
  const searchText = [
    title,
    detail,
    type,
    ...change.changes.map((valueChange) => valueChange.path),
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(' ')
    .toLowerCase();
  return {
    id: `node-${index}`,
    category: 'node',
    kind: change.kind,
    filterKinds,
    nodeId:
      change.after?.id ??
      change.before?.id ??
      change.after?.name ??
      change.before?.name,
    ...(detail === undefined ? {} : { detail }),
    title,
    searchText,
    nodeChange: change,
  };
}

function connectionEntry(change: ConnectionChange, index: number): ChangeEntry {
  const connection = change.connection;
  const arrow = `"${connection.sourceNode}" → "${connection.targetNode}"`;
  const title =
    change.kind === 'added' ? `Connected ${arrow}` : `Disconnected ${arrow}`;
  const detail = `${connection.sourceOutputType}[${connection.sourceOutputIndex}] → ${connection.targetInputType}[${connection.targetInputIndex}]`;
  const searchText = [title, detail].join(' ').toLowerCase();
  return {
    id: `connection-${index}`,
    category: 'connection',
    kind: change.kind,
    filterKinds: ['connections'],
    title,
    detail,
    searchText,
    connectionChange: change,
  };
}

function workflowEntry(change: ValueChange, index: number): ChangeEntry {
  const title = `Changed ${change.path}`;
  return {
    id: `workflow-${index}`,
    category: 'workflow',
    kind: change.kind,
    filterKinds: ['modified'],
    title,
    searchText: title.toLowerCase(),
    valueChange: change,
  };
}

export function matchesChangeFilter(
  entry: ChangeEntry,
  filter: DiffFilter,
): boolean {
  return filter === 'all' || entry.filterKinds.includes(filter);
}

export function createChangeEntries(diff: WorkflowDiff): ChangeEntry[] {
  return [
    ...diff.nodeChanges.map(nodeEntry),
    ...diff.connectionChanges.map(connectionEntry),
    ...diff.workflowChanges.map(workflowEntry),
  ];
}
