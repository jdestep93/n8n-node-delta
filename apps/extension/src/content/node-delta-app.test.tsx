// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */

import type {
  NormalizedWorkflow,
  WorkflowDiff,
  WorkflowSnapshot,
} from '@nodedelta/core';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NodeDeltaApp } from './node-delta-app.js';
import {
  defaultPreferences,
  type PreferenceRepository,
  type WorkspaceServices,
} from './workspace-store.js';

const roots: Root[] = [];

function workflow(name = 'Customer <img src=x>'): NormalizedWorkflow {
  return {
    schemaVersion: 1,
    workflowId: 'workflow-1',
    name,
    nodes: [],
    connections: [],
    settings: {},
  };
}

function snapshot(id: string, date: string): WorkflowSnapshot {
  return {
    id,
    schemaVersion: 1,
    instanceId: 'instance-1',
    workflowId: 'workflow-1',
    workflowName: 'Customer',
    createdAt: date,
    normalizedWorkflow: workflow(`Snapshot ${id}`),
    workflowHash: id,
    source: 'manual',
  };
}

const noChanges: WorkflowDiff = {
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

function harness(items: WorkflowSnapshot[] = []): {
  services: WorkspaceServices;
  preferences: PreferenceRepository;
} {
  let snapshots = items;
  return {
    services: {
      getInstanceId: () => Promise.resolve('instance-1'),
      loadCurrent: () => Promise.resolve(workflow()),
      listSnapshots: () => Promise.resolve(snapshots),
      saveSnapshot: () =>
        Promise.resolve(
          snapshots.length === 0
            ? {
                status: 'saved' as const,
                snapshot: snapshot('saved', '2026-08-28T15:00:00.000Z'),
              }
            : { status: 'duplicate' as const, snapshot: snapshots[0]! },
        ).then((result) => {
          if (result.status === 'saved') snapshots = [result.snapshot];
          return result;
        }),
      renameSnapshot: async (id, label) => {
        snapshots = snapshots.map((item) =>
          item.id === id ? { ...item, label } : item,
        );
      },
      deleteSnapshot: async (id) => {
        snapshots = snapshots.filter((item) => item.id !== id);
      },
      diff: () => noChanges,
    },
    preferences: {
      load: defaultPreferences,
      save: vi.fn(),
    },
  };
}

async function renderApp(
  services: WorkspaceServices,
  preferences: PreferenceRepository,
): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  root.render(
    <NodeDeltaApp
      openRequest={0}
      preferences={preferences}
      services={services}
      workflowId="workflow-1"
    />,
  );
  await eventually(() => expect(button('Diff')).toBeDefined());
  return container;
}

async function eventually(assertion: () => void): Promise<void> {
  let error: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      assertion();
      return;
    } catch (caught) {
      error = caught;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw error;
}

function button(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (element) => element.textContent?.trim() === text,
  );
}

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('NodeDelta workspace', () => {
  it('refreshes when opened and presents the save-first empty state with local privacy copy', async () => {
    const { services, preferences } = harness();
    await renderApp(services, preferences);
    button('Diff')?.click();

    await eventually(() => {
      expect(document.body.textContent).toContain('No snapshots yet');
      expect(document.body.textContent).toContain(
        'Snapshots are stored locally in this browser.',
      );
    });
    expect(document.querySelector('img')).toBeNull();
    button('Save Snapshot')?.click();
    await eventually(() =>
      expect(document.body.textContent).toContain('Snapshot saved.'),
    );
  });

  it('shows newest From, current/other To, refresh timestamp, filters, search, and comparison result', async () => {
    const newest = snapshot('newest', '2026-08-28T15:00:00.000Z');
    const older = snapshot('older', '2026-08-28T14:00:00.000Z');
    const { services, preferences } = harness([newest, older]);
    await renderApp(services, preferences);
    button('Diff')?.click();
    await eventually(() =>
      expect(document.querySelectorAll('select')).toHaveLength(2),
    );

    const selects = document.querySelectorAll<HTMLSelectElement>('select');
    expect(selects[0]?.value).toBe('newest');
    expect(selects[1]?.value).toBe('current');
    expect(selects[1]?.textContent).toContain('Snapshot —');
    expect(document.body.textContent).toContain('Current workflow loaded at');
    for (const label of [
      'All',
      'Added',
      'Removed',
      'Modified',
      'Moved',
      'Connections',
    ]) {
      expect(button(label)).toBeDefined();
    }
    expect(
      document.querySelector('[aria-label="Search changes"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain('No changes detected.');
  });

  it('manages snapshots with rename and confirmation-aware delete actions', async () => {
    const existing = snapshot('newest', '2026-08-28T15:00:00.000Z');
    const { services, preferences } = harness([existing]);
    vi.spyOn(window, 'prompt').mockReturnValue('Before AI changes');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderApp(services, preferences);
    button('Diff')?.click();
    await eventually(() => expect(button('Snapshots')).toBeDefined());
    button('Snapshots')?.click();
    await eventually(() => expect(button('Rename')).toBeDefined());

    button('Rename')?.click();
    await eventually(() =>
      expect(document.body.textContent).toContain('Before AI changes'),
    );
    button('Delete')?.click();
    await eventually(() =>
      expect(document.body.textContent).toContain('No snapshots yet'),
    );
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it('exposes auto/light/dark, all retention values, and delete confirmation settings', async () => {
    const { services, preferences } = harness([
      snapshot('newest', '2026-08-28T15:00:00.000Z'),
    ]);
    await renderApp(services, preferences);
    button('Diff')?.click();
    await eventually(() => expect(button('Settings')).toBeDefined());
    button('Settings')?.click();
    await eventually(() =>
      expect(document.querySelector('[aria-label="Theme"]')).not.toBeNull(),
    );
    expect(
      document.querySelector('[aria-label="Theme"]')?.textContent,
    ).toContain('Auto');
    expect(
      document.querySelector('[aria-label="Snapshot retention"]')?.textContent,
    ).toContain('Keep all');
    expect(document.body.textContent).toContain(
      'Confirm before deleting snapshot',
    );
  });
});
