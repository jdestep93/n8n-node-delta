import type {
  NormalizedWorkflow,
  RawN8nWorkflow,
  WorkflowDiff,
  WorkflowSnapshot,
} from './domain.js';

export interface N8nInstanceInfo {
  origin: string;
  basePath: string;
  instanceId: string;
  version?: string;
}

export interface N8nAdapterHealth {
  reachable: boolean;
  authenticated: boolean;
  version?: string;
  capabilities: N8nAdapterCapabilities;
}

export interface N8nAdapterCapabilities {
  workflowFetch: boolean;
  versionDetected: boolean;
}

export interface WorkflowProvider {
  getWorkflow(workflowId: string): Promise<RawN8nWorkflow>;
}

export interface N8nAdapter extends WorkflowProvider {
  detect(): Promise<N8nInstanceInfo>;
  getCurrentWorkflowId(): string | undefined;
  healthCheck(): Promise<N8nAdapterHealth>;
}

export interface WorkflowNormalizer {
  normalize(workflow: RawN8nWorkflow): NormalizedWorkflow;
}

export interface SnapshotRepository {
  save(
    snapshot: WorkflowSnapshot,
    options?: SnapshotSaveOptions,
  ): Promise<SnapshotSaveResult>;
  list(instanceId: string, workflowId: string): Promise<WorkflowSnapshot[]>;
  get(id: string): Promise<WorkflowSnapshot | undefined>;
  findByHash(
    instanceId: string,
    workflowId: string,
    workflowHash: string,
  ): Promise<WorkflowSnapshot | undefined>;
  rename(id: string, label: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export type SnapshotRetention = 'all' | 50 | 25 | 10;

export interface SnapshotSaveOptions {
  retention?: SnapshotRetention;
}

export type SnapshotSaveResult =
  | { status: 'saved'; snapshot: WorkflowSnapshot }
  | { status: 'duplicate'; snapshot: WorkflowSnapshot };

export interface WorkflowDiffer {
  diff(before: NormalizedWorkflow, after: NormalizedWorkflow): WorkflowDiff;
}
