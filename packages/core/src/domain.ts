export interface RawN8nNode {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  disabled?: boolean;
  notes?: string;
  credentials?: Record<string, unknown>;
  [key: string]: unknown;
}

export type RawConnections = Record<string, unknown>;

export interface RawN8nWorkflow {
  id?: string;
  name: string;
  nodes: RawN8nNode[];
  connections: RawConnections;
  settings?: Record<string, unknown>;
  staticData?: unknown;
  tags?: unknown[];
  active?: boolean;
  versionId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface NormalizedCredentialReference {
  id?: string;
  name?: string;
}

export interface NormalizedPosition {
  x: number;
  y: number;
}

export interface NormalizedNode {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: NormalizedPosition;
  parameters: unknown;
  disabled?: boolean;
  notes?: string;
  credentials?: Record<string, NormalizedCredentialReference>;
  metadata?: Record<string, unknown>;
}

export interface NormalizedConnection {
  sourceNode: string;
  sourceOutputType: string;
  sourceOutputIndex: number;
  targetNode: string;
  targetInputType: string;
  targetInputIndex: number;
}

export interface NormalizedWorkflow {
  schemaVersion: 1;
  workflowId?: string;
  name: string;
  nodes: NormalizedNode[];
  connections: NormalizedConnection[];
  settings: Record<string, unknown>;
  active?: boolean;
}

export type SnapshotSource = 'manual' | 'future-auto' | 'imported';

export interface WorkflowSnapshot {
  id: string;
  schemaVersion: 1;
  instanceId: string;
  workflowId: string;
  workflowName: string;
  label?: string;
  createdAt: string;
  normalizedWorkflow: NormalizedWorkflow;
  workflowHash: string;
  source: SnapshotSource;
}

export type NodeChangeKind =
  'added' | 'removed' | 'modified' | 'moved' | 'renamed';

export interface ValueChange {
  path: string;
  before?: unknown;
  after?: unknown;
}

export interface NodeChange {
  kind: NodeChangeKind;
  before?: NormalizedNode;
  after?: NormalizedNode;
  changes: ValueChange[];
}

export interface ConnectionChange {
  kind: 'added' | 'removed';
  connection: NormalizedConnection;
}

export interface DiffSummary {
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  nodesMoved: number;
  nodesRenamed: number;
  connectionsAdded: number;
  connectionsRemoved: number;
  workflowChanges: number;
}

export interface WorkflowDiff {
  summary: DiffSummary;
  nodeChanges: NodeChange[];
  connectionChanges: ConnectionChange[];
  workflowChanges: ValueChange[];
}
