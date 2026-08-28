// @vitest-environment jsdom

import type { WorkflowDiff } from '@nodedelta/core';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiffReport } from './components/DiffReport.js';

const roots: Root[] = [];

async function render(element: React.JSX.Element): Promise<void> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  root.render(element);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (container.querySelector('.nd-item') !== null) return;
  }
}

const mixedDiff: WorkflowDiff = {
  summary: {
    nodesAdded: 0,
    nodesRemoved: 0,
    nodesModified: 1,
    nodesMoved: 1,
    nodesRenamed: 0,
    connectionsAdded: 1,
    connectionsRemoved: 0,
    workflowChanges: 0,
  },
  nodeChanges: [
    {
      kind: 'modified',
      before: {
        id: 'node-1',
        name: 'Code',
        type: 'n8n-nodes-base.code',
        position: { x: 0, y: 0 },
        parameters: { mode: 'a' },
      },
      after: {
        id: 'node-1',
        name: 'Code',
        type: 'n8n-nodes-base.code',
        position: { x: 100, y: 0 },
        parameters: { mode: 'b' },
      },
      changes: [
        { path: 'position.x', kind: 'modified', before: 0, after: 100 },
        {
          path: 'parameters.mode',
          kind: 'modified',
          before: 'a',
          after: 'b',
        },
      ],
    },
  ],
  connectionChanges: [
    {
      kind: 'added',
      connection: {
        sourceNode: 'Code',
        sourceOutputType: 'main',
        sourceOutputIndex: 0,
        targetNode: 'Send',
        targetInputType: 'main',
        targetInputIndex: 0,
      },
    },
  ],
  workflowChanges: [],
  hasChanges: true,
};

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.replaceChildren();
});

describe('DiffReport filters and graph-selection seam', () => {
  it('classifies a mixed node under Modified and Moved and labels connections completely', async () => {
    await render(<DiffReport diff={mixedDiff} filter="moved" />);
    expect(document.querySelectorAll('.nd-item')).toHaveLength(1);
    expect(document.querySelector('.nd-badge')?.textContent).toBe('Modified');

    roots.pop()?.unmount();
    document.body.replaceChildren();
    await render(<DiffReport diff={mixedDiff} filter="connections" />);
    expect(document.querySelector('.nd-badge')?.textContent).toBe(
      'Connection added',
    );
  });

  it('synchronizes controlled node selection with the future graph seam', async () => {
    const onSelectedNodeIdChange = vi.fn();
    await render(
      <DiffReport
        diff={mixedDiff}
        onSelectedNodeIdChange={onSelectedNodeIdChange}
        selectedNodeId="node-1"
      />,
    );
    const selected = document.querySelector<HTMLButtonElement>('.nd-item');
    expect(selected?.getAttribute('aria-pressed')).toBe('true');
    selected?.click();
    expect(onSelectedNodeIdChange).toHaveBeenCalledWith('node-1');
  });

  it('shows only relevant inspector sections', async () => {
    await render(<DiffReport diff={mixedDiff} />);
    const headings = Array.from(
      document.querySelectorAll('.nd-inspector-heading'),
      (element) => element.textContent,
    );
    expect(headings).toEqual(['Overview', 'Parameters', 'Position']);
    expect(document.body.textContent).not.toContain('Code / Text');
  });
});
