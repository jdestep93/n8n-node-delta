/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/prefer-promise-reject-errors, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import type {
  NormalizedWorkflow,
  SnapshotRetention,
  SnapshotSaveResult,
  WorkflowDiff,
  WorkflowSnapshot,
} from '@nodedelta/core';
import { StorageUnavailableError } from '@nodedelta/core';
import { describe, expect, it, vi } from 'vitest';

import {
  createWorkspaceStore,
  defaultPreferences,
  type PreferenceRepository,
  type WorkspaceServices,
} from './workspace-store.js';

function normalized(name: string, parameter = 'before'): NormalizedWorkflow {
  return {
    schemaVersion: 1,
    workflowId: 'workflow-1',
    name,
    nodes: [
      {
        id: 'node-1',
        name: 'Code',
        type: 'n8n-nodes-base.code',
        position: { x: 0, y: 0 },
        parameters: { jsCode: parameter },
      },
    ],
    connections: [],
    settings: {},
  };
}

function snapshot(id: string, createdAt: string, value = id): WorkflowSnapshot {
  return {
    id,
    schemaVersion: 1,
    instanceId: 'instance-1',
    workflowId: 'workflow-1',
    workflowName: 'Example',
    createdAt,
    normalizedWorkflow: normalized('Example', value),
    workflowHash: `hash-${value}`,
    source: 'manual',
  };
}

const emptyDiff: WorkflowDiff = {
  summary: {
    nodesAdded: 0,
    nodesRemoved: 0,
    nodesModified: 0,
    nodesMoved: 0,
    nodesRenamed: 0,
    connectionsAdded: 0,
    connectionsRemoved: 0,
    workflowChanges: 0,
  },
  nodeChanges: [],
  connectionChanges: [],
  workflowChanges: [],
  hasChanges: false,
};

function harness(
  options: {
    snapshots?: WorkflowSnapshot[];
    saveResult?: SnapshotSaveResult;
    listError?: unknown;
    preferences?: Partial<ReturnType<typeof defaultPreferences>>;
  } = {},
): {
  services: WorkspaceServices;
  preferences: PreferenceRepository;
  writes: Array<ReturnType<typeof defaultPreferences>>;
} {
  let items = options.snapshots ?? [];
  const writes: Array<ReturnType<typeof defaultPreferences>> = [];
  const services: WorkspaceServices = {
    getInstanceId: vi.fn(() => Promise.resolve('instance-1')),
    loadCurrent: vi.fn(() => Promise.resolve(normalized('Example', 'current'))),
    listSnapshots: vi.fn(() =>
      options.listError === undefined
        ? Promise.resolve(items)
        : Promise.reject(options.listError),
    ),
    saveSnapshot: vi.fn((): Promise<SnapshotSaveResult> =>
      Promise.resolve(
        options.saveResult ?? {
          status: 'saved',
          snapshot: snapshot('saved', '2026-08-28T15:00:00.000Z'),
        },
      ),
    ),
    renameSnapshot: vi.fn(async (id, label) => {
      items = items.map((item) => (item.id === id ? { ...item, label } : item));
    }),
    deleteSnapshot: vi.fn(async (id) => {
      items = items.filter((item) => item.id !== id);
    }),
    diff: vi.fn(() => emptyDiff),
  };
  const preferences: PreferenceRepository = {
    load: () => ({ ...defaultPreferences(), ...options.preferences }),
    save: (value) => writes.push(value),
  };
  return { services, preferences, writes };
}

describe('workspace store', () => {
  it('loads current workflow and newest snapshot by default, then compares to current', async () => {
    const older = snapshot('older', '2026-08-28T13:00:00.000Z');
    const newest = snapshot('newest', '2026-08-28T14:00:00.000Z');
    const { services, preferences } = harness({ snapshots: [newest, older] });
    const store = createWorkspaceStore({
      workflowId: 'workflow-1',
      services,
      preferences,
      now: () => new Date('2026-08-28T15:42:03.000Z'),
    });

    await store.getState().open();

    expect(store.getState().workflow.status).toBe('ready');
    expect(store.getState().workflow.loadedAt).toBe('2026-08-28T15:42:03.000Z');
    expect(store.getState().comparison.fromSnapshotId).toBe('newest');
    expect(store.getState().comparison.to).toBe('current');
    expect(services.diff).toHaveBeenCalledWith(
      newest.normalizedWorkflow,
      normalized('Example', 'current'),
    );
  });

  it('supports snapshot-to-snapshot comparison and resets selected node when endpoints change', async () => {
    const newest = snapshot('newest', '2026-08-28T14:00:00.000Z');
    const older = snapshot('older', '2026-08-28T13:00:00.000Z');
    const { services, preferences } = harness({ snapshots: [newest, older] });
    const store = createWorkspaceStore({
      workflowId: 'workflow-1',
      services,
      preferences,
    });
    await store.getState().open();
    store.getState().selectNode('node-1');

    store.getState().setTo('older');

    expect(store.getState().comparison.to).toBe('older');
    expect(store.getState().ui.selectedNodeId).toBeUndefined();
    expect(services.diff).toHaveBeenLastCalledWith(
      newest.normalizedWorkflow,
      older.normalizedWorkflow,
    );
  });

  it('reports duplicate saves without creating another row and passes retention', async () => {
    const existing = snapshot('newest', '2026-08-28T14:00:00.000Z');
    const { services, preferences } = harness({
      snapshots: [existing],
      saveResult: { status: 'duplicate', snapshot: existing },
      preferences: { retention: 25 },
    });
    const store = createWorkspaceStore({
      workflowId: 'workflow-1',
      services,
      preferences,
    });
    await store.getState().open();

    await store.getState().saveSnapshot();

    expect(services.saveSnapshot).toHaveBeenCalledWith(
      'instance-1',
      'workflow-1',
      25,
    );
    expect(store.getState().snapshots.notice).toBe(
      'No snapshot saved — the workflow has not changed.',
    );
    expect(store.getState().snapshots.items).toHaveLength(1);
  });

  it('renames and deletes snapshots, respecting confirmation preference', async () => {
    const existing = snapshot('newest', '2026-08-28T14:00:00.000Z');
    const confirmDelete = vi.fn(() => false);
    const { services, preferences } = harness({ snapshots: [existing] });
    const store = createWorkspaceStore({
      workflowId: 'workflow-1',
      services,
      preferences,
      confirmDelete,
    });
    await store.getState().open();
    await store.getState().renameSnapshot('newest', 'Before AI changes');
    await store.getState().deleteSnapshot('newest');
    expect(store.getState().snapshots.items[0]?.label).toBe(
      'Before AI changes',
    );
    expect(services.deleteSnapshot).not.toHaveBeenCalled();

    store.getState().setConfirmDelete(false);
    await store.getState().deleteSnapshot('newest');
    expect(services.deleteSnapshot).toHaveBeenCalledWith('newest');
    expect(store.getState().snapshots.items).toEqual([]);
  });

  it('refreshes and safely separates current-workflow and storage failures', async () => {
    const { services, preferences } = harness({
      listError: new StorageUnavailableError({
        cause: new Error('private database detail'),
      }),
    });
    const store = createWorkspaceStore({
      workflowId: 'workflow-1',
      services,
      preferences,
      now: () => new Date('2026-08-28T15:42:03.000Z'),
    });
    await store.getState().open();

    expect(store.getState().workflow.status).toBe('ready');
    expect(store.getState().snapshots.status).toBe('error');
    expect(store.getState().snapshots.error).toBe(
      "Local snapshot storage isn't available. You can still inspect the current workflow, but snapshots can't be saved.",
    );
    expect(JSON.stringify(store.getState())).not.toContain('private database');

    await store.getState().refresh();
    expect(services.loadCurrent).toHaveBeenCalledTimes(2);
  });

  it.each<SnapshotRetention>(['all', 50, 25, 10])(
    'persists supported retention %s with theme and confirmation settings',
    (retention) => {
      const { services, preferences, writes } = harness();
      const store = createWorkspaceStore({
        workflowId: 'workflow-1',
        services,
        preferences,
      });
      store.getState().setTheme('dark');
      store.getState().setRetention(retention);
      store.getState().setConfirmDelete(false);
      expect(writes.at(-1)).toEqual({
        theme: 'dark',
        retention,
        confirmDelete: false,
      });
    },
  );
});
