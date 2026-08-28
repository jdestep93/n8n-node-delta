// @vitest-environment jsdom

import type { WorkflowDiff } from '@nodedelta/core';
import { StrictMode, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { DiffReport } from './components/DiffReport.js';

const roots: Root[] = [];
const containers: HTMLDivElement[] = [];

function render(element: ReactElement): void {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  containers.push(container);
  root.render(<StrictMode>{element}</StrictMode>);
}

async function eventually(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

function typeQuery(input: HTMLInputElement, value: string): void {
  // React deduplicates change events when values are set through its own
  // tracked setter, so tests must use the native prototype setter.
  /* eslint-disable @typescript-eslint/unbound-method */
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  /* eslint-enable @typescript-eslint/unbound-method */
  if (setter === undefined) return;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function itemButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.nd-item'));
}

function codeChange(
  path: string,
  before: unknown,
  after: unknown,
): WorkflowDiff['nodeChanges'] {
  return [
    {
      kind: 'modified',
      before: {
        name: 'Transform records',
        type: 'n8n-nodes-base.code',
        position: { x: 240, y: 0 },
        parameters: { [path]: before },
      },
      after: {
        name: 'Transform records',
        type: 'n8n-nodes-base.code',
        position: { x: 240, y: 0 },
        parameters: { [path]: after },
      },
      changes: [
        { path: `parameters.${path}`, kind: 'modified', before, after },
      ],
    },
  ];
}

function multiChangeDiff(): WorkflowDiff {
  return {
    summary: {
      nodesAdded: 1,
      nodesRemoved: 0,
      nodesModified: 1,
      nodesMoved: 0,
      nodesRenamed: 1,
      connectionsAdded: 1,
      connectionsRemoved: 0,
      workflowChanges: 1,
    },
    nodeChanges: [
      {
        kind: 'renamed',
        before: {
          name: 'Fetch customer',
          type: 'n8n-nodes-base.httpRequest',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        after: {
          name: 'Load customer',
          type: 'n8n-nodes-base.httpRequest',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        changes: [
          {
            path: 'name',
            kind: 'modified',
            before: 'Fetch customer',
            after: 'Load customer',
          },
        ],
      },
      ...codeChange(
        'jsCode',
        'const a = 1;\nconst b = 2;\nreturn items;',
        'const a = 1;\nconst b = 99;\nreturn items;',
      ),
      {
        kind: 'added',
        after: {
          name: 'Prepare data',
          type: 'n8n-nodes-base.set',
          position: { x: 480, y: 0 },
          parameters: {},
        },
        changes: [],
      },
    ],
    connectionChanges: [
      {
        kind: 'added',
        connection: {
          sourceNode: 'Fetch customer',
          sourceOutputType: 'main',
          sourceOutputIndex: 0,
          targetNode: 'Prepare data',
          targetInputType: 'main',
          targetInputIndex: 0,
        },
      },
    ],
    workflowChanges: [
      {
        path: 'settings.executionOrder',
        kind: 'modified',
        before: 'v0',
        after: 'v1',
      },
    ],
    hasChanges: true,
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

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  for (const container of containers.splice(0)) container.remove();
});

// -- tests below --

describe('DiffReport', () => {
  it('shows an empty state when the diff has no changes', async () => {
    render(<DiffReport diff={noChanges} />);
    await eventually(() => {
      expect(document.querySelector('.nd-empty')?.textContent).toBe(
        'No changes detected.',
      );
      expect(document.querySelector('.nd-item')).toBeNull();
    });
  });

  it('summarizes counts and lists changes with selection state', async () => {
    render(<DiffReport diff={multiChangeDiff()} />);
    await eventually(() => {
      const chips = document.querySelector('.nd-chips')?.textContent ?? '';
      expect(chips).toContain('1 node added');
      expect(chips).toContain('node modified');
      expect(chips).toContain('connection added');
      expect(document.querySelectorAll('.nd-item')).toHaveLength(5);
      expect(itemButtons()[0]?.getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('renders a line diff with additions and removals for multiline code', async () => {
    render(<DiffReport diff={multiChangeDiff()} />);
    await eventually(() => expect(itemButtons()).toHaveLength(5));
    itemButtons()[1]?.click();
    await eventually(() => {
      const code = document.querySelector('.nd-code')?.textContent ?? '';
      expect(code).toContain('− const b = 2;');
      expect(code).toContain('+ const b = 99;');
      expect(document.querySelector('.nd-gap')).toBeNull();
      expect(document.querySelector('.nd-kind-javascript')?.textContent).toBe(
        'JavaScript',
      );
    });
  });

  it('renders a word diff and classification badge for expressions', async () => {
    render(
      <DiffReport
        diff={{
          ...noChanges,
          hasChanges: true,
          summary: { ...noChanges.summary, nodesModified: 1 },
          nodeChanges: codeChange(
            'message',
            '={{ $json.firstName }}',
            '={{ $json.fullName }}',
          ),
        }}
      />,
    );
    await eventually(() => {
      expect(document.querySelector('.nd-words')).not.toBeNull();
      expect(document.querySelector('.nd-mark-del')?.textContent).toBe(
        '$json.firstName',
      );
      expect(document.querySelector('.nd-mark-add')?.textContent).toBe(
        '$json.fullName',
      );
      expect(document.querySelector('.nd-path')?.textContent).toBe(
        'parameters.message',
      );
      expect(document.querySelector('.nd-kind-expression')?.textContent).toBe(
        'Expression',
      );
    });
  });

  it('uses custom labels for removed values', async () => {
    render(
      <DiffReport
        afterLabel="Current"
        beforeLabel="Snapshot"
        diff={{
          ...noChanges,
          hasChanges: true,
          summary: { ...noChanges.summary, workflowChanges: 1 },
          workflowChanges: [
            {
              path: 'settings.timezone',
              kind: 'removed',
              before: 'America/New_York',
            },
          ],
        }}
      />,
    );
    await eventually(() => {
      expect(document.querySelector('.nd-label')?.textContent).toBe(
        'Snapshot: ',
      );
      expect(document.querySelector('.nd-code')?.textContent).toContain(
        'America/New_York',
      );
    });
  });

  it('filters entries from the search box', async () => {
    render(<DiffReport diff={multiChangeDiff()} />);
    await eventually(() =>
      expect(document.querySelectorAll('.nd-item')).toHaveLength(5),
    );
    const input = document.querySelector<HTMLInputElement>('.nd-search');
    expect(input).not.toBeNull();
    typeQuery(input as HTMLInputElement, 'code');
    await eventually(() => {
      expect(itemButtons()).toHaveLength(1);
      expect(itemButtons()[0]?.textContent).toContain(
        'Modified node "Transform records"',
      );
    });
    typeQuery(input as HTMLInputElement, 'zzz');
    await eventually(() => {
      expect(itemButtons()).toHaveLength(0);
      expect(document.querySelector('.nd-count')?.textContent).toBe(
        'No matching changes',
      );
    });
  });

  it('switches the detail pane when another change is selected', async () => {
    render(<DiffReport diff={multiChangeDiff()} />);
    await eventually(() => expect(itemButtons()).toHaveLength(5));
    itemButtons()[2]?.click();
    await eventually(() => {
      expect(document.querySelector('.nd-node-type')?.textContent).toBe(
        'n8n-nodes-base.set',
      );
    });
    itemButtons()[4]?.click();
    await eventually(() => {
      expect(document.querySelector('.nd-path')?.textContent).toBe(
        'settings.executionOrder',
      );
      expect(document.querySelector('.nd-mark-del')?.textContent).toBe('v0');
      expect(document.querySelector('.nd-mark-add')?.textContent).toBe('v1');
    });
  });

  it('describes connection endpoints in the detail pane', async () => {
    render(<DiffReport diff={multiChangeDiff()} />);
    await eventually(() => expect(itemButtons()).toHaveLength(5));
    itemButtons()[3]?.click();
    await eventually(() => {
      expect(document.querySelector('.nd-connection')?.textContent).toBe(
        'Fetch customer → Prepare data',
      );
      expect(document.querySelector('.nd-connection-ports')?.textContent).toBe(
        'main[0] → main[0]',
      );
    });
  });
});
