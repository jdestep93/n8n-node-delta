import Dexie, { type DexieOptions, type EntityTable } from 'dexie';

import {
  NodeDeltaError,
  StorageQuotaError,
  StorageUnavailableError,
  sha256,
  type SnapshotRepository,
  type SnapshotRetention,
  type SnapshotSaveOptions,
  type SnapshotSaveResult,
  type WorkflowSnapshot,
} from '@nodedelta/core';

export interface DexieSnapshotRepositoryOptions {
  databaseName?: string;
  retention?: SnapshotRetention;
  indexedDB?: IDBFactory | null;
  IDBKeyRange?: typeof globalThis.IDBKeyRange;
}

class SnapshotDatabase extends Dexie {
  snapshots!: EntityTable<WorkflowSnapshot, 'id'>;

  constructor(databaseName: string, options?: DexieOptions) {
    super(databaseName, options);
    this.version(1).stores({
      snapshots: 'id, [instanceId+workflowId], createdAt, workflowHash',
    });
    this.version(2).stores({
      snapshots:
        'id, [instanceId+workflowId], [instanceId+workflowId+createdAt], [instanceId+workflowId+workflowHash], createdAt, workflowHash',
    });
  }
}

export class DexieSnapshotRepository implements SnapshotRepository {
  readonly #database?: SnapshotDatabase;
  readonly #retention: SnapshotRetention;

  constructor(options: DexieSnapshotRepositoryOptions = {}) {
    this.#retention = options.retention ?? 50;
    const indexedDB =
      options.indexedDB === undefined
        ? globalThis.indexedDB
        : options.indexedDB;
    const keyRange = options.IDBKeyRange ?? globalThis.IDBKeyRange;
    if (
      indexedDB !== null &&
      indexedDB !== undefined &&
      keyRange !== undefined
    ) {
      this.#database = new SnapshotDatabase(
        options.databaseName ?? 'nodedelta',
        {
          indexedDB,
          IDBKeyRange: keyRange,
        },
      );
    }
  }

  async save(
    snapshot: WorkflowSnapshot,
    options: SnapshotSaveOptions = {},
  ): Promise<SnapshotSaveResult> {
    return this.#run(async (database) => {
      const result = await database.transaction(
        'rw',
        database.snapshots,
        async () => {
          const latest = await this.#latest(
            database,
            snapshot.instanceId,
            snapshot.workflowId,
          );
          if (latest?.workflowHash === snapshot.workflowHash) {
            return { status: 'duplicate', snapshot: latest } as const;
          }

          await database.snapshots.add(snapshot);
          const retention = options.retention ?? this.#retention;
          if (retention !== 'all') {
            const expiredIds = await this.#workflowCollection(
              database,
              snapshot.instanceId,
              snapshot.workflowId,
            )
              .reverse()
              .offset(retention)
              .primaryKeys();
            await database.snapshots.bulkDelete(expiredIds);
          }
          return { status: 'saved', snapshot } as const;
        },
      );
      return result;
    });
  }

  async list(
    instanceId: string,
    workflowId: string,
  ): Promise<WorkflowSnapshot[]> {
    return this.#run(async (database) => {
      const snapshots = await this.#workflowCollection(
        database,
        instanceId,
        workflowId,
      )
        .reverse()
        .toArray();
      return snapshots.sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) ||
          right.id.localeCompare(left.id),
      );
    });
  }

  get(id: string): Promise<WorkflowSnapshot | undefined> {
    return this.#run((database) => database.snapshots.get(id));
  }

  findByHash(
    instanceId: string,
    workflowId: string,
    workflowHash: string,
  ): Promise<WorkflowSnapshot | undefined> {
    return this.#run(async (database) => {
      const matches = await database.snapshots
        .where('[instanceId+workflowId+workflowHash]')
        .equals([instanceId, workflowId, workflowHash])
        .toArray();
      return matches.sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) ||
          right.id.localeCompare(left.id),
      )[0];
    });
  }

  async rename(id: string, label: string): Promise<void> {
    await this.#run(async (database) => {
      await database.snapshots.update(id, { label });
    });
  }

  async delete(id: string): Promise<void> {
    await this.#run(async (database) => {
      await database.snapshots.delete(id);
    });
  }

  close(): void {
    this.#database?.close();
  }

  #workflowCollection(
    database: SnapshotDatabase,
    instanceId: string,
    workflowId: string,
  ) {
    return database.snapshots
      .where('[instanceId+workflowId+createdAt]')
      .between(
        [instanceId, workflowId, Dexie.minKey],
        [instanceId, workflowId, Dexie.maxKey],
        true,
        true,
      );
  }

  #latest(
    database: SnapshotDatabase,
    instanceId: string,
    workflowId: string,
  ): Promise<WorkflowSnapshot | undefined> {
    return this.#workflowCollection(database, instanceId, workflowId)
      .reverse()
      .first();
  }

  async #run<T>(
    operation: (database: SnapshotDatabase) => Promise<T>,
  ): Promise<T> {
    if (this.#database === undefined) throw new StorageUnavailableError();
    try {
      return await operation(this.#database);
    } catch (error) {
      if (error instanceof NodeDeltaError) throw error;
      if (hasErrorName(error, 'QuotaExceededError')) {
        throw new StorageQuotaError({ cause: error });
      }
      throw new StorageUnavailableError({ cause: error });
    }
  }
}

function hasErrorName(error: unknown, expectedName: string): boolean {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  while (pending.length > 0) {
    const current = pending.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    if (
      typeof current === 'object' &&
      current !== null &&
      (('name' in current && current.name === expectedName) ||
        ('message' in current &&
          typeof current.message === 'string' &&
          current.message.includes(expectedName)))
    ) {
      return true;
    }
    if (typeof current === 'object' && current !== null) {
      const errorRecord = current as Record<string, unknown>;
      for (const key of ['cause', 'inner', 'innerException'] as const) {
        if (key in errorRecord) pending.push(errorRecord[key]);
      }
    }
  }
  return false;
}

export function createInstanceId(origin: string, basePath: string): string {
  const normalizedOrigin = origin.replace(/\/+$/u, '');
  const normalizedBasePath =
    basePath === '' || basePath === '/'
      ? ''
      : `/${basePath.replace(/^\/+|\/+$/gu, '')}`;
  return sha256(`${normalizedOrigin}\n${normalizedBasePath}`);
}
