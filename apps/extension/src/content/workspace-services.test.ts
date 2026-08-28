/* eslint-disable @typescript-eslint/unbound-method */
import type {
  N8nAdapter,
  NormalizedWorkflow,
  RawN8nWorkflow,
  SnapshotRepository,
  WorkflowSnapshot,
} from '@nodedelta/core';
import { describe, expect, it, vi } from 'vitest';

import {
  createLocalStoragePreferenceRepository,
  createWorkspaceServices,
} from './workspace-services.js';

const raw: RawN8nWorkflow = {
  id: 'workflow-1',
  name: 'Example',
  nodes: [],
  connections: {},
};
const normalized: NormalizedWorkflow = {
  schemaVersion: 1,
  workflowId: 'workflow-1',
  name: 'Example',
  nodes: [],
  connections: [],
  settings: {},
};

describe('workspace service composition', () => {
  it('fetches then normalizes current workflow and delegates repository actions', async () => {
    const adapter = {
      detect: vi.fn(() =>
        Promise.resolve({
          origin: 'https://n8n.example',
          basePath: '/',
          instanceId: 'instance-1',
        }),
      ),
      getWorkflow: vi.fn(() => Promise.resolve(raw)),
    } as unknown as N8nAdapter;
    const repository = {
      list: vi.fn(() => Promise.resolve([])),
      rename: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    } as unknown as SnapshotRepository;
    const manualSnapshotService = {
      save: vi.fn(() =>
        Promise.resolve({
          status: 'saved' as const,
          snapshot: {} as WorkflowSnapshot,
        }),
      ),
    };
    const diff = vi.fn(() => ({
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
    }));
    const services = createWorkspaceServices({
      adapter,
      normalizer: { normalize: vi.fn(() => normalized) },
      repository,
      manualSnapshotService,
      differ: { diff },
    });

    await expect(services.getInstanceId()).resolves.toBe('instance-1');
    await expect(services.loadCurrent('workflow-1')).resolves.toBe(normalized);
    await services.listSnapshots('instance-1', 'workflow-1');
    await services.saveSnapshot('instance-1', 'workflow-1', 10);
    await services.renameSnapshot('snapshot-1', 'Label');
    await services.deleteSnapshot('snapshot-1');

    expect(adapter.getWorkflow).toHaveBeenCalledWith('workflow-1');
    expect(manualSnapshotService.save).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workflowId: 'workflow-1',
      retention: 10,
    });
    expect(repository.rename).toHaveBeenCalledWith('snapshot-1', 'Label');
    expect(repository.delete).toHaveBeenCalledWith('snapshot-1');
  });

  it('uses safe defaults for malformed preferences and persists valid values', () => {
    const values = new Map<string, string>([
      ['nodedelta:preferences', '{"theme":"neon","retention":999}'],
    ]);
    const storage: Storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
      clear: () => values.clear(),
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    };
    const repository = createLocalStoragePreferenceRepository(storage);
    expect(repository.load()).toEqual({
      theme: 'auto',
      retention: 50,
      confirmDelete: true,
    });
    repository.save({ theme: 'light', retention: 'all', confirmDelete: false });
    expect(JSON.parse(values.get('nodedelta:preferences') ?? '')).toEqual({
      theme: 'light',
      retention: 'all',
      confirmDelete: false,
    });
  });
});
