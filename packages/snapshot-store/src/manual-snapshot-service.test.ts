import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  NormalizedWorkflow,
  RawN8nWorkflow,
  WorkflowNormalizer,
  WorkflowProvider,
} from '@nodedelta/core';
import { ManualSnapshotService } from './manual-snapshot-service.js';
import { DexieSnapshotRepository } from './repository.js';

const databases = new Set<string>();

afterEach(async () => {
  await Promise.all([...databases].map((name) => Dexie.delete(name)));
  databases.clear();
});

describe('ManualSnapshotService', () => {
  it('fetches, normalizes, hashes, and persists a manual snapshot', async () => {
    const rawWorkflow: RawN8nWorkflow = {
      id: 'workflow-a',
      name: 'Daily report',
      nodes: [],
      connections: {},
    };
    const normalizedWorkflow: NormalizedWorkflow = {
      schemaVersion: 1,
      workflowId: 'workflow-a',
      name: 'Daily report',
      nodes: [],
      connections: [],
      settings: {},
    };
    const events: string[] = [];
    const getWorkflow = vi.fn(() => {
      events.push('fetch');
      return Promise.resolve(rawWorkflow);
    });
    const provider: WorkflowProvider = {
      getWorkflow,
    };
    const normalize = vi.fn(() => {
      events.push('normalize');
      return normalizedWorkflow;
    });
    const normalizer: WorkflowNormalizer = {
      normalize,
    };
    const hashWorkflow = vi.fn(() => {
      events.push('hash');
      return Promise.resolve('stable-hash');
    });
    const name = `nodedelta-manual-test-${crypto.randomUUID()}`;
    databases.add(name);
    const repository = new DexieSnapshotRepository({ databaseName: name });
    const service = new ManualSnapshotService({
      workflowProvider: provider,
      workflowNormalizer: normalizer,
      hashWorkflow,
      snapshotRepository: repository,
      createId: () => 'snapshot-a',
      now: () => new Date('2026-08-28T14:30:00.000Z'),
    });

    await expect(
      service.save({
        instanceId: 'instance-a',
        workflowId: 'workflow-a',
        label: 'Before cleanup',
      }),
    ).resolves.toEqual({
      status: 'saved',
      snapshot: {
        id: 'snapshot-a',
        schemaVersion: 1,
        instanceId: 'instance-a',
        workflowId: 'workflow-a',
        workflowName: 'Daily report',
        label: 'Before cleanup',
        createdAt: '2026-08-28T14:30:00.000Z',
        normalizedWorkflow,
        workflowHash: 'stable-hash',
        source: 'manual',
      },
    });
    expect(getWorkflow).toHaveBeenCalledWith('workflow-a');
    expect(normalize).toHaveBeenCalledWith(rawWorkflow);
    expect(hashWorkflow).toHaveBeenCalledWith(normalizedWorkflow);
    expect(events).toEqual(['fetch', 'normalize', 'hash']);
    repository.close();
  });

  it('returns the latest snapshot when the current workflow is unchanged', async () => {
    const rawWorkflow: RawN8nWorkflow = {
      name: 'Example',
      nodes: [],
      connections: {},
    };
    const normalizedWorkflow: NormalizedWorkflow = {
      schemaVersion: 1,
      name: 'Example',
      nodes: [],
      connections: [],
      settings: {},
    };
    const name = `nodedelta-manual-test-${crypto.randomUUID()}`;
    databases.add(name);
    const repository = new DexieSnapshotRepository({ databaseName: name });
    let nextId = 0;
    const service = new ManualSnapshotService({
      workflowProvider: { getWorkflow: () => Promise.resolve(rawWorkflow) },
      workflowNormalizer: { normalize: () => normalizedWorkflow },
      hashWorkflow: () => Promise.resolve('unchanged'),
      snapshotRepository: repository,
      createId: () => `snapshot-${(nextId += 1)}`,
      now: () => new Date('2026-08-28T14:30:00.000Z'),
    });

    const first = await service.save({
      instanceId: 'instance-a',
      workflowId: 'workflow-a',
    });
    const duplicate = await service.save({
      instanceId: 'instance-a',
      workflowId: 'workflow-a',
    });

    expect(first.status).toBe('saved');
    expect(duplicate).toEqual({
      status: 'duplicate',
      snapshot: first.snapshot,
    });
    await expect(
      repository.list('instance-a', 'workflow-a'),
    ).resolves.toHaveLength(1);
    repository.close();
  });
});
