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
  save(snapshot: WorkflowSnapshot): Promise<void>;
  list(instanceId: string, workflowId: string): Promise<WorkflowSnapshot[]>;
  get(id: string): Promise<WorkflowSnapshot | undefined>;
  rename(id: string, label: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface WorkflowDiffer {
  diff(before: NormalizedWorkflow, after: NormalizedWorkflow): WorkflowDiff;
}
