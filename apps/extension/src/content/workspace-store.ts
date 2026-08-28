import type {
  NormalizedWorkflow,
  SnapshotRetention,
  SnapshotSaveResult,
  WorkflowDiff,
  WorkflowSnapshot,
} from '@nodedelta/core';
import { StorageQuotaError, StorageUnavailableError } from '@nodedelta/core';
import type { DiffFilter } from '@nodedelta/diff-ui';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { getFriendlyWorkflowError } from './friendly-error.js';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ComparisonTarget = string;

export interface WorkspacePreferences {
  theme: ThemePreference;
  retention: SnapshotRetention;
  confirmDelete: boolean;
}

export interface PreferenceRepository {
  load(): WorkspacePreferences;
  save(preferences: WorkspacePreferences): void;
}

export interface WorkspaceServices {
  getInstanceId(): Promise<string>;
  loadCurrent(workflowId: string): Promise<NormalizedWorkflow>;
  listSnapshots(
    instanceId: string,
    workflowId: string,
  ): Promise<WorkflowSnapshot[]>;
  saveSnapshot(
    instanceId: string,
    workflowId: string,
    retention: SnapshotRetention,
  ): Promise<SnapshotSaveResult>;
  renameSnapshot(id: string, label: string): Promise<void>;
  deleteSnapshot(id: string): Promise<void>;
  diff(before: NormalizedWorkflow, after: NormalizedWorkflow): WorkflowDiff;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface WorkflowSlice {
  workflowId: string;
  instanceId?: string | undefined;
  status: LoadStatus;
  current?: NormalizedWorkflow | undefined;
  loadedAt?: string | undefined;
  error?: string | undefined;
}

interface SnapshotSlice {
  status: LoadStatus;
  items: WorkflowSnapshot[];
  notice?: string | undefined;
  error?: string | undefined;
}

interface ComparisonSlice {
  fromSnapshotId?: string | undefined;
  to: ComparisonTarget;
  diff?: WorkflowDiff | undefined;
}

interface UiSlice {
  filter: DiffFilter;
  search: string;
  selectedNodeId?: string | undefined;
  view: 'compare' | 'snapshots' | 'settings';
}

export interface WorkspaceState {
  workflow: WorkflowSlice;
  snapshots: SnapshotSlice;
  comparison: ComparisonSlice;
  ui: UiSlice;
  settings: WorkspacePreferences;
  open(): Promise<void>;
  refresh(): Promise<void>;
  saveSnapshot(): Promise<void>;
  renameSnapshot(id: string, label: string): Promise<void>;
  deleteSnapshot(id: string): Promise<void>;
  setFrom(id: string): void;
  setTo(target: ComparisonTarget): void;
  setFilter(filter: DiffFilter): void;
  setSearch(search: string): void;
  selectNode(nodeId: string | undefined): void;
  setView(view: UiSlice['view']): void;
  setTheme(theme: ThemePreference): void;
  setRetention(retention: SnapshotRetention): void;
  setConfirmDelete(confirmDelete: boolean): void;
}

export interface CreateWorkspaceStoreOptions {
  workflowId: string;
  services: WorkspaceServices;
  preferences: PreferenceRepository;
  now?: () => Date;
  confirmDelete?: (snapshot: WorkflowSnapshot) => boolean;
}

export function defaultPreferences(): WorkspacePreferences {
  return { theme: 'auto', retention: 50, confirmDelete: true };
}

function storageError(error: unknown): string {
  if (error instanceof StorageQuotaError) {
    return 'Local snapshot storage is full. Delete older snapshots and try again.';
  }
  if (error instanceof StorageUnavailableError) {
    return "Local snapshot storage isn't available. You can still inspect the current workflow, but snapshots can't be saved.";
  }
  return 'NodeDelta could not access local snapshots.';
}

export function createWorkspaceStore({
  workflowId,
  services,
  preferences,
  now = () => new Date(),
  confirmDelete = (snapshot) =>
    globalThis.confirm?.(
      `Delete ${snapshot.label ?? `snapshot from ${snapshot.createdAt}`}?`,
    ) ?? false,
}: CreateWorkspaceStoreOptions): StoreApi<WorkspaceState> {
  const initialSettings = preferences.load();

  return createStore<WorkspaceState>((set, get) => {
    const persist = (next: Partial<WorkspacePreferences>): void => {
      const settings = { ...get().settings, ...next };
      set({ settings });
      preferences.save(settings);
    };

    const recompute = (): void => {
      const state = get();
      const from = state.snapshots.items.find(
        (item) => item.id === state.comparison.fromSnapshotId,
      );
      const after =
        state.comparison.to === 'current'
          ? state.workflow.current
          : state.snapshots.items.find(
              (item) => item.id === state.comparison.to,
            )?.normalizedWorkflow;
      set({
        comparison: {
          ...state.comparison,
          ...(from === undefined || after === undefined
            ? { diff: undefined }
            : { diff: services.diff(from.normalizedWorkflow, after) }),
        },
      });
    };

    const loadSnapshots = async (
      instanceId: string,
    ): Promise<WorkflowSnapshot[] | undefined> => {
      set((state) => ({
        snapshots: { ...state.snapshots, status: 'loading', error: undefined },
      }));
      try {
        const items = await services.listSnapshots(instanceId, workflowId);
        set((state) => {
          const ids = new Set(items.map((item) => item.id));
          const fromSnapshotId =
            state.comparison.fromSnapshotId !== undefined &&
            ids.has(state.comparison.fromSnapshotId)
              ? state.comparison.fromSnapshotId
              : items[0]?.id;
          const to =
            state.comparison.to === 'current' || ids.has(state.comparison.to)
              ? state.comparison.to
              : 'current';
          return {
            snapshots: {
              ...state.snapshots,
              status: 'ready',
              items,
              error: undefined,
            },
            comparison: { ...state.comparison, fromSnapshotId, to },
          };
        });
        recompute();
        return items;
      } catch (error) {
        set((state) => ({
          snapshots: {
            ...state.snapshots,
            status: 'error',
            items: [],
            error: storageError(error),
          },
        }));
        recompute();
        return undefined;
      }
    };

    const refresh = async (): Promise<void> => {
      set((state) => ({
        workflow: { ...state.workflow, status: 'loading', error: undefined },
      }));
      try {
        const current = await services.loadCurrent(workflowId);
        set((state) => ({
          workflow: {
            ...state.workflow,
            status: 'ready',
            current,
            loadedAt: now().toISOString(),
            error: undefined,
          },
        }));
        recompute();
      } catch (error) {
        set((state) => ({
          workflow: {
            ...state.workflow,
            status: 'error',
            current: undefined,
            loadedAt: undefined,
            error: getFriendlyWorkflowError(error),
          },
          comparison: { ...state.comparison, diff: undefined },
        }));
      }
    };

    return {
      workflow: { workflowId, status: 'idle' },
      snapshots: { status: 'idle', items: [] },
      comparison: { to: 'current' },
      ui: {
        filter: 'all',
        search: '',
        view: 'compare',
      },
      settings: initialSettings,
      open: async () => {
        const instancePromise = services.getInstanceId();
        const currentPromise = refresh();
        try {
          const instanceId = await instancePromise;
          set((state) => ({
            workflow: { ...state.workflow, instanceId },
          }));
          await loadSnapshots(instanceId);
        } catch (error) {
          set((state) => ({
            snapshots: {
              ...state.snapshots,
              status: 'error',
              error: storageError(error),
            },
          }));
        }
        await currentPromise;
        recompute();
      },
      refresh,
      saveSnapshot: async () => {
        const state = get();
        const instanceId = state.workflow.instanceId;
        if (instanceId === undefined) return;
        set((current) => ({
          snapshots: {
            ...current.snapshots,
            status: 'loading',
            notice: undefined,
            error: undefined,
          },
        }));
        try {
          const result = await services.saveSnapshot(
            instanceId,
            workflowId,
            state.settings.retention,
          );
          await loadSnapshots(instanceId);
          set((current) => ({
            snapshots: {
              ...current.snapshots,
              notice:
                result.status === 'duplicate'
                  ? 'No snapshot saved — the workflow has not changed.'
                  : 'Snapshot saved.',
            },
          }));
        } catch (error) {
          set((current) => ({
            snapshots: {
              ...current.snapshots,
              status: 'error',
              error: storageError(error),
            },
          }));
        }
      },
      renameSnapshot: async (id, label) => {
        const instanceId = get().workflow.instanceId;
        if (instanceId === undefined || label.trim() === '') return;
        try {
          await services.renameSnapshot(id, label.trim());
          await loadSnapshots(instanceId);
        } catch (error) {
          set((state) => ({
            snapshots: { ...state.snapshots, error: storageError(error) },
          }));
        }
      },
      deleteSnapshot: async (id) => {
        const state = get();
        const snapshot = state.snapshots.items.find((item) => item.id === id);
        const instanceId = state.workflow.instanceId;
        if (snapshot === undefined || instanceId === undefined) return;
        if (state.settings.confirmDelete && !confirmDelete(snapshot)) return;
        try {
          await services.deleteSnapshot(id);
          await loadSnapshots(instanceId);
        } catch (error) {
          set((current) => ({
            snapshots: { ...current.snapshots, error: storageError(error) },
          }));
        }
      },
      setFrom: (id) => {
        set((state) => ({
          comparison: {
            ...state.comparison,
            fromSnapshotId: id,
            to: state.comparison.to === id ? 'current' : state.comparison.to,
          },
          ui: { ...state.ui, selectedNodeId: undefined },
        }));
        recompute();
      },
      setTo: (to) => {
        set((state) => ({
          comparison: { ...state.comparison, to },
          ui: { ...state.ui, selectedNodeId: undefined },
        }));
        recompute();
      },
      setFilter: (filter) => set((state) => ({ ui: { ...state.ui, filter } })),
      setSearch: (search) => set((state) => ({ ui: { ...state.ui, search } })),
      selectNode: (selectedNodeId) =>
        set((state) => ({ ui: { ...state.ui, selectedNodeId } })),
      setView: (view) => set((state) => ({ ui: { ...state.ui, view } })),
      setTheme: (theme) => persist({ theme }),
      setRetention: (retention) => persist({ retention }),
      setConfirmDelete: (confirmDeleteValue) =>
        persist({ confirmDelete: confirmDeleteValue }),
    };
  });
}
