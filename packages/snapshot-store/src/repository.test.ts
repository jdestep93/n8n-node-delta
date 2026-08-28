import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import {
  StorageQuotaError,
  StorageUnavailableError,
  type NormalizedWorkflow,
  type WorkflowSnapshot,
} from '@nodedelta/core';
import { DexieSnapshotRepository, createInstanceId } from './repository.js';

const databases = new Set<string>();

function databaseName(): string {
  const name = `nodedelta-snapshot-test-${crypto.randomUUID()}`;
  databases.add(name);
  return name;
}

const workflow: NormalizedWorkflow = {
  schemaVersion: 1,
  workflowId: 'workflow-a',
  name: 'Example',
  nodes: [],
  connections: [],
  settings: {},
};

function snapshot(
  id: string,
  options: Partial<WorkflowSnapshot> = {},
): WorkflowSnapshot {
  return {
    id,
    schemaVersion: 1,
    instanceId: 'instance-a',
    workflowId: 'workflow-a',
    workflowName: 'Example',
    createdAt: new Date(
      Date.UTC(2026, 0, 1) + Number(id) * 1_000,
    ).toISOString(),
    normalizedWorkflow: workflow,
    workflowHash: `hash-${id}`,
    source: 'manual',
    ...options,
  };
}

afterEach(async () => {
  await Promise.all([...databases].map((name) => Dexie.delete(name)));
  databases.clear();
});

describe('DexieSnapshotRepository', () => {
  it('saves, retrieves, and lists snapshots newest first after reopening', async () => {
    const name = databaseName();
    const first = new DexieSnapshotRepository({ databaseName: name });

    await expect(first.save(snapshot('1'))).resolves.toMatchObject({
      status: 'saved',
    });
    await first.save(snapshot('2'));
    first.close();

    const reopened = new DexieSnapshotRepository({ databaseName: name });
    await expect(reopened.get('1')).resolves.toEqual(snapshot('1'));
    await expect(reopened.list('instance-a', 'workflow-a')).resolves.toEqual([
      snapshot('2'),
      snapshot('1'),
    ]);
    reopened.close();
  });

  it('renames, finds by hash, and deletes snapshots through the repository', async () => {
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
    });
    await repository.save(snapshot('1'));

    await expect(
      repository.findByHash('instance-a', 'workflow-a', 'hash-1'),
    ).resolves.toEqual(snapshot('1'));
    await repository.rename('1', 'Before cleanup');
    await expect(repository.get('1')).resolves.toMatchObject({
      label: 'Before cleanup',
    });
    await repository.delete('1');
    await expect(repository.get('1')).resolves.toBeUndefined();
    repository.close();
  });

  it('suppresses only a duplicate of the latest workflow snapshot', async () => {
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
    });
    await repository.save(snapshot('1', { workflowHash: 'same' }));

    await expect(
      repository.save(snapshot('2', { workflowHash: 'same' })),
    ).resolves.toEqual({
      status: 'duplicate',
      snapshot: snapshot('1', { workflowHash: 'same' }),
    });
    await expect(
      repository.list('instance-a', 'workflow-a'),
    ).resolves.toHaveLength(1);

    await repository.save(snapshot('2', { workflowHash: 'different' }));
    await expect(
      repository.save(snapshot('3', { workflowHash: 'same' })),
    ).resolves.toMatchObject({ status: 'saved' });
    repository.close();
  });

  it('isolates duplicate detection and lists by instance and workflow', async () => {
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
    });
    await repository.save(snapshot('1', { workflowHash: 'same' }));
    await expect(
      repository.save(
        snapshot('2', {
          instanceId: 'instance-b',
          workflowHash: 'same',
        }),
      ),
    ).resolves.toMatchObject({ status: 'saved' });
    await expect(
      repository.save(
        snapshot('3', {
          workflowId: 'workflow-b',
          workflowHash: 'same',
        }),
      ),
    ).resolves.toMatchObject({ status: 'saved' });

    await expect(repository.list('instance-a', 'workflow-a')).resolves.toEqual([
      snapshot('1', { workflowHash: 'same' }),
    ]);
    repository.close();
  });

  it('keeps the newest 50 snapshots by default', async () => {
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
    });
    for (let index = 1; index <= 52; index += 1) {
      await repository.save(snapshot(String(index)));
    }

    const saved = await repository.list('instance-a', 'workflow-a');
    expect(saved).toHaveLength(50);
    expect(saved.at(0)?.id).toBe('52');
    expect(saved.at(-1)?.id).toBe('3');
    repository.close();
  });

  it.each([10, 25] as const)(
    'supports a %s snapshot retention limit',
    async (limit) => {
      const repository = new DexieSnapshotRepository({
        databaseName: databaseName(),
        retention: limit,
      });
      for (let index = 1; index <= limit + 2; index += 1) {
        await repository.save(snapshot(String(index)));
      }

      const saved = await repository.list('instance-a', 'workflow-a');
      expect(saved).toHaveLength(limit);
      expect(saved.at(-1)?.id).toBe('3');
      repository.close();
    },
  );

  it('keeps every snapshot when retention is all', async () => {
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
      retention: 'all',
    });
    for (let index = 1; index <= 52; index += 1) {
      await repository.save(snapshot(String(index)));
    }

    await expect(
      repository.list('instance-a', 'workflow-a'),
    ).resolves.toHaveLength(52);
    repository.close();
  });

  it('allows a per-save retention override', async () => {
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
      retention: 'all',
    });
    for (let index = 1; index <= 12; index += 1) {
      await repository.save(snapshot(String(index)), { retention: 10 });
    }
    await expect(
      repository.list('instance-a', 'workflow-a'),
    ).resolves.toHaveLength(10);
    repository.close();
  });

  it('migrates a v1 database without losing snapshots', async () => {
    const name = databaseName();
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      snapshots: 'id, [instanceId+workflowId], createdAt, workflowHash',
    });
    await legacy.table<WorkflowSnapshot>('snapshots').add(snapshot('1'));
    legacy.close();

    const repository = new DexieSnapshotRepository({ databaseName: name });
    await expect(repository.list('instance-a', 'workflow-a')).resolves.toEqual([
      snapshot('1'),
    ]);
    await expect(
      repository.findByHash('instance-a', 'workflow-a', 'hash-1'),
    ).resolves.toEqual(snapshot('1'));
    repository.close();
  });

  it('rolls back a failed save without overwriting or pruning snapshots', async () => {
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
      retention: 10,
    });
    await repository.save(snapshot('1'));

    await expect(
      repository.save(
        snapshot('1', {
          workflowId: 'workflow-b',
          workflowHash: 'other',
        }),
      ),
    ).rejects.toBeInstanceOf(StorageUnavailableError);
    await expect(repository.get('1')).resolves.toEqual(snapshot('1'));
    await expect(repository.list('instance-a', 'workflow-b')).resolves.toEqual(
      [],
    );
    repository.close();
  });

  it('maps missing IndexedDB to a typed safe storage error', async () => {
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
      indexedDB: null,
    });

    await expect(repository.list('instance-a', 'workflow-a')).rejects.toEqual(
      expect.objectContaining({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Local snapshot storage is unavailable in this browser.',
      }),
    );
  });

  it('maps a quota-style IndexedDB failure to a typed safe error', async () => {
    const quotaFactory = {
      open: () => {
        throw new DOMException('private detail', 'QuotaExceededError');
      },
      deleteDatabase: indexedDB.deleteDatabase.bind(indexedDB),
      cmp: indexedDB.cmp.bind(indexedDB),
      databases: indexedDB.databases.bind(indexedDB),
    } as IDBFactory;
    const repository = new DexieSnapshotRepository({
      databaseName: databaseName(),
      indexedDB: quotaFactory,
      IDBKeyRange,
    });

    await expect(repository.save(snapshot('1'))).rejects.toBeInstanceOf(
      StorageQuotaError,
    );
  });
});

describe('createInstanceId', () => {
  it('returns a stable opaque namespace for origin and base path', () => {
    const root = createInstanceId('https://example.com', '');
    expect(root).toMatch(/^[a-f0-9]{64}$/u);
    expect(root).toBe(createInstanceId('https://example.com/', '/'));
    expect(root).not.toContain('example.com');
    expect(root).not.toBe(createInstanceId('https://example.com', '/n8n'));
    expect(root).not.toBe(createInstanceId('https://other.example.com', ''));
  });
});
