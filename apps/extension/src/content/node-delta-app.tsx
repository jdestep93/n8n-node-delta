import type {
  RawN8nWorkflow,
  SnapshotRetention,
  WorkflowSnapshot,
} from '@nodedelta/core';
import { DiffReport, type DiffFilter } from '@nodedelta/diff-ui';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';

import {
  createWorkspaceStore,
  type PreferenceRepository,
  type WorkspaceServices,
} from './workspace-store.js';

export interface WorkflowLoader {
  getWorkflow(workflowId: string): Promise<RawN8nWorkflow>;
}

export interface NodeDeltaAppProps {
  workflowId: string;
  services: WorkspaceServices;
  preferences: PreferenceRepository;
  openRequest: number;
}

function snapshotLabel(snapshot: WorkflowSnapshot): string {
  return (
    snapshot.label ??
    `Snapshot — ${new Date(snapshot.createdAt).toLocaleString()}`
  );
}

function EmptySnapshots({ onSave }: { onSave: () => void }): React.JSX.Element {
  return (
    <div className="empty-state">
      <h3>No snapshots yet</h3>
      <p>
        Save the current workflow as a snapshot, then compare future changes
        against it.
      </p>
      <button className="primary" onClick={onSave} type="button">
        Save Snapshot
      </button>
      <p className="privacy">Snapshots are stored locally in this browser.</p>
    </div>
  );
}

const FILTERS: ReadonlyArray<{ value: DiffFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'added', label: 'Added' },
  { value: 'removed', label: 'Removed' },
  { value: 'modified', label: 'Modified' },
  { value: 'moved', label: 'Moved' },
  { value: 'connections', label: 'Connections' },
];
const RETENTIONS: ReadonlyArray<{ value: SnapshotRetention; label: string }> = [
  { value: 'all', label: 'Keep all' },
  { value: 50, label: '50 per workflow' },
  { value: 25, label: '25 per workflow' },
  { value: 10, label: '10 per workflow' },
];

export function NodeDeltaApp({
  workflowId,
  services,
  preferences,
  openRequest,
}: NodeDeltaAppProps): React.JSX.Element {
  const [store] = useState(() =>
    createWorkspaceStore({ workflowId, services, preferences }),
  );
  const state = useStore(store);
  const [openState, setOpenState] = useState({
    manual: false,
    dismissedRequest: 0,
  });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const open = openState.manual || openRequest > openState.dismissedRequest;

  useEffect(() => {
    if (open && !wasOpen.current) void store.getState().open();
    wasOpen.current = open;
  }, [open, store]);

  const close = (): void => {
    setOpenState({ manual: false, dismissedRequest: openRequest });
    queueMicrotask(() => launcherRef.current?.focus());
  };
  const launcherLabel =
    open && state.workflow.status === 'loading'
      ? 'Loading…'
      : state.workflow.status === 'error'
        ? 'Unavailable'
        : 'Diff';

  return (
    <div
      className={`nodedelta theme-${state.settings.theme}`}
      data-theme={state.settings.theme}
    >
      {open ? (
        <section
          aria-label="NodeDelta workflow comparison"
          aria-modal="true"
          className="panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
          role="dialog"
        >
          <header className="panel-header">
            <div>
              <h2>NodeDelta for n8n</h2>
              {state.workflow.current === undefined ? null : (
                <p className="workflow-name">{state.workflow.current.name}</p>
              )}
            </div>
            <button
              aria-label="Close NodeDelta"
              className="close"
              onClick={close}
              type="button"
            >
              Close
            </button>
          </header>
          <nav aria-label="NodeDelta views" className="tabs">
            {(['compare', 'snapshots', 'settings'] as const).map((view) => (
              <button
                aria-current={state.ui.view === view ? 'page' : undefined}
                key={view}
                onClick={() => state.setView(view)}
                type="button"
              >
                {view[0]?.toUpperCase()}
                {view.slice(1)}
              </button>
            ))}
          </nav>
          <div className="panel-body">
            {state.workflow.status === 'loading' ? (
              <p role="status">Loading current workflow…</p>
            ) : null}
            {state.workflow.error === undefined ? null : (
              <p role="alert">{state.workflow.error}</p>
            )}
            {state.snapshots.error === undefined ? null : (
              <p role="alert">{state.snapshots.error}</p>
            )}
            {state.snapshots.notice === undefined ? null : (
              <p className="notice" role="status">
                {state.snapshots.notice}
              </p>
            )}

            {state.ui.view === 'compare' &&
            state.workflow.status === 'ready' &&
            state.snapshots.status !== 'loading' ? (
              state.snapshots.items.length === 0 ? (
                <EmptySnapshots onSave={() => void state.saveSnapshot()} />
              ) : (
                <div className="compare-view">
                  <div className="selectors">
                    <label>
                      From
                      <select
                        aria-label="From snapshot"
                        onChange={(event) => state.setFrom(event.target.value)}
                        value={state.comparison.fromSnapshotId}
                      >
                        {state.snapshots.items.map((snapshot) => (
                          <option key={snapshot.id} value={snapshot.id}>
                            {snapshotLabel(snapshot)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      To
                      <select
                        aria-label="To workflow or snapshot"
                        onChange={(event) => state.setTo(event.target.value)}
                        value={state.comparison.to}
                      >
                        <option value="current">Current Workflow</option>
                        {state.snapshots.items
                          .filter(
                            (snapshot) =>
                              snapshot.id !== state.comparison.fromSnapshotId,
                          )
                          .map((snapshot) => (
                            <option key={snapshot.id} value={snapshot.id}>
                              {snapshotLabel(snapshot)}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="refresh-row">
                    <span>
                      {state.workflow.loadedAt === undefined
                        ? 'Current workflow not loaded'
                        : `Current workflow loaded at ${new Date(state.workflow.loadedAt).toLocaleTimeString()}`}
                    </span>
                    <button onClick={() => void state.refresh()} type="button">
                      Refresh
                    </button>
                    <button
                      onClick={() => void state.saveSnapshot()}
                      type="button"
                    >
                      Save Snapshot
                    </button>
                  </div>
                  <div aria-label="Change filters" className="filters">
                    {FILTERS.map(({ value, label }) => (
                      <button
                        aria-pressed={state.ui.filter === value}
                        key={value}
                        onClick={() => state.setFilter(value)}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {state.comparison.diff === undefined ? (
                    <p>Select two versions to compare.</p>
                  ) : (
                    <DiffReport
                      afterLabel={
                        state.comparison.to === 'current'
                          ? 'Current'
                          : 'To snapshot'
                      }
                      beforeLabel="From snapshot"
                      diff={state.comparison.diff}
                      filter={state.ui.filter}
                      onQueryChange={(query) => state.setSearch(query)}
                      onSelectedNodeIdChange={(nodeId) =>
                        state.selectNode(nodeId)
                      }
                      query={state.ui.search}
                      selectedNodeId={state.ui.selectedNodeId}
                    />
                  )}
                </div>
              )
            ) : null}

            {state.ui.view === 'snapshots' ? (
              state.snapshots.items.length === 0 ? (
                <EmptySnapshots onSave={() => void state.saveSnapshot()} />
              ) : (
                <ul className="snapshot-list">
                  {state.snapshots.items.map((snapshot) => (
                    <li key={snapshot.id}>
                      <div>
                        <strong>{snapshotLabel(snapshot)}</strong>
                        <span>
                          {new Date(snapshot.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="snapshot-actions">
                        <button
                          onClick={() => {
                            state.setFrom(snapshot.id);
                            state.setView('compare');
                          }}
                          type="button"
                        >
                          Compare
                        </button>
                        <button
                          onClick={() => {
                            const label = window.prompt(
                              'Snapshot name',
                              snapshot.label ?? '',
                            );
                            if (label !== null)
                              void state.renameSnapshot(snapshot.id, label);
                          }}
                          type="button"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => void state.deleteSnapshot(snapshot.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {state.ui.view === 'settings' ? (
              <div className="settings-view">
                <label>
                  Theme
                  <select
                    aria-label="Theme"
                    onChange={(event) =>
                      state.setTheme(
                        event.target.value as 'auto' | 'light' | 'dark',
                      )
                    }
                    value={state.settings.theme}
                  >
                    <option value="auto">Auto</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label>
                  Snapshot retention
                  <select
                    aria-label="Snapshot retention"
                    onChange={(event) => {
                      const value = event.target.value;
                      state.setRetention(
                        value === 'all'
                          ? 'all'
                          : (Number(value) as 50 | 25 | 10),
                      );
                    }}
                    value={state.settings.retention}
                  >
                    {RETENTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    checked={state.settings.confirmDelete}
                    onChange={(event) =>
                      state.setConfirmDelete(event.target.checked)
                    }
                    type="checkbox"
                  />
                  Confirm before deleting snapshot
                </label>
                <p className="privacy">
                  Workflow data and snapshots stay in this browser. NodeDelta
                  does not send workflow content to an external service.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      <button
        aria-label={`Open NodeDelta for workflow ${workflowId}`}
        className="launcher"
        onClick={() =>
          open
            ? close()
            : setOpenState((current) => ({ ...current, manual: true }))
        }
        ref={launcherRef}
        type="button"
      >
        {launcherLabel}
      </button>
    </div>
  );
}
