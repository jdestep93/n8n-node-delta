import type {
  N8nAdapter,
  SnapshotRepository,
  SnapshotRetention,
  SnapshotSaveResult,
  WorkflowDiffer,
  WorkflowNormalizer,
} from '@nodedelta/core';
import {
  DexieSnapshotRepository,
  ManualSnapshotService,
} from '@nodedelta/snapshot-store';
import { hashWorkflow, N8nWorkflowNormalizer } from '@nodedelta/n8n-normalizer';
import { SemanticWorkflowDiffer } from '@nodedelta/diff-engine';

import { createBrowserWorkflowLoader } from './browser-adapter.js';
import {
  defaultPreferences,
  type PreferenceRepository,
  type WorkspacePreferences,
  type WorkspaceServices,
} from './workspace-store.js';

interface ManualSnapshotSaver {
  save(input: {
    instanceId: string;
    workflowId: string;
    retention?: SnapshotRetention;
  }): Promise<SnapshotSaveResult>;
}

export interface WorkspaceServiceDependencies {
  adapter: N8nAdapter;
  normalizer: WorkflowNormalizer;
  repository: SnapshotRepository;
  manualSnapshotService: ManualSnapshotSaver;
  differ: WorkflowDiffer;
}

export function createWorkspaceServices({
  adapter,
  normalizer,
  repository,
  manualSnapshotService,
  differ,
}: WorkspaceServiceDependencies): WorkspaceServices {
  return {
    getInstanceId: async () => (await adapter.detect()).instanceId,
    loadCurrent: async (workflowId) =>
      normalizer.normalize(await adapter.getWorkflow(workflowId)),
    listSnapshots: (instanceId, workflowId) =>
      repository.list(instanceId, workflowId),
    saveSnapshot: (instanceId, workflowId, retention) =>
      manualSnapshotService.save({ instanceId, workflowId, retention }),
    renameSnapshot: (id, label) => repository.rename(id, label),
    deleteSnapshot: (id) => repository.delete(id),
    diff: (before, after) => differ.diff(before, after),
  };
}

export function createBrowserWorkspaceServices(
  targetWindow: Window,
): WorkspaceServices {
  const adapter = createBrowserWorkflowLoader(targetWindow);
  const normalizer = new N8nWorkflowNormalizer();
  const repository = new DexieSnapshotRepository();
  const manualSnapshotService = new ManualSnapshotService({
    workflowProvider: adapter,
    workflowNormalizer: normalizer,
    hashWorkflow,
    snapshotRepository: repository,
  });
  return createWorkspaceServices({
    adapter,
    normalizer,
    repository,
    manualSnapshotService,
    differ: new SemanticWorkflowDiffer(),
  });
}

const PREFERENCE_KEY = 'nodedelta:preferences';

function isPreferences(value: unknown): value is WorkspacePreferences {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<WorkspacePreferences>;
  return (
    (candidate.theme === 'auto' ||
      candidate.theme === 'light' ||
      candidate.theme === 'dark') &&
    (candidate.retention === 'all' ||
      candidate.retention === 50 ||
      candidate.retention === 25 ||
      candidate.retention === 10) &&
    typeof candidate.confirmDelete === 'boolean'
  );
}

export function createLocalStoragePreferenceRepository(
  storage: Storage,
): PreferenceRepository {
  return {
    load: () => {
      try {
        const raw = storage.getItem(PREFERENCE_KEY);
        if (raw === null) return defaultPreferences();
        const parsed: unknown = JSON.parse(raw);
        return isPreferences(parsed) ? parsed : defaultPreferences();
      } catch {
        return defaultPreferences();
      }
    },
    save: (preferences) => {
      try {
        storage.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
      } catch {
        // A preference write must never prevent workflow inspection.
      }
    },
  };
}
