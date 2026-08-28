import type { WorkflowDiff } from '@nodedelta/core';
import { describe, expect, it } from 'vitest';

import { createChangeEntries } from './changes-model.js';

function diffFixture(): WorkflowDiff {
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
      {
        kind: 'modified',
        before: {
          name: 'Transform records',
          type: 'n8n-nodes-base.code',
          position: { x: 240, y: 0 },
          parameters: { jsCode: 'return items;' },
        },
        after: {
          name: 'Transform records',
          type: 'n8n-nodes-base.code',
          position: { x: 240, y: 0 },
          parameters: {
            jsCode: 'return items.filter((item) => item.json.active);',
          },
        },
        changes: [
          {
            path: 'parameters.jsCode',
            kind: 'modified',
            before: 'return items;',
            after: 'return items.filter((item) => item.json.active);',
          },
        ],
      },
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

describe('change entries', () => {
  it('flattens node, connection, and workflow changes in a stable order', () => {
    const entries = createChangeEntries(diffFixture());
    expect(entries.map((entry) => entry.id)).toEqual([
      'node-0',
      'node-1',
      'node-2',
      'connection-0',
      'workflow-0',
    ]);
    expect(entries.map((entry) => entry.category)).toEqual([
      'node',
      'node',
      'node',
      'connection',
      'workflow',
    ]);
    expect(entries[0]?.title).toBe(
      'Renamed node "Fetch customer" → "Load customer"',
    );
    expect(entries[1]?.title).toBe('Modified node "Transform records"');
    expect(entries[2]?.title).toBe('Added node "Prepare data"');
    expect(entries[3]?.title).toBe(
      'Connected "Fetch customer" → "Prepare data"',
    );
    expect(entries[4]?.title).toBe('Changed settings.executionOrder');
  });

  it('builds lowercase search text covering names, types, and paths', () => {
    const entries = createChangeEntries(diffFixture());
    expect(entries[1]?.searchText).toContain('n8n-nodes-base.code');
    expect(entries[1]?.searchText).toContain('parameters.jscode');
    expect(entries[3]?.searchText).toContain('fetch customer');
  });

  it('describes movement with coordinates', () => {
    const diff = diffFixture();
    diff.nodeChanges = [
      {
        kind: 'moved',
        before: {
          name: 'Fetch customer',
          type: 'n8n-nodes-base.httpRequest',
          position: { x: 240, y: 0 },
          parameters: {},
        },
        after: {
          name: 'Fetch customer',
          type: 'n8n-nodes-base.httpRequest',
          position: { x: 360, y: 180 },
          parameters: {},
        },
        changes: [
          { path: 'position.x', kind: 'modified', before: 240, after: 360 },
          { path: 'position.y', kind: 'modified', before: 0, after: 180 },
        ],
      },
    ];
    const [entry] = createChangeEntries(diff);
    expect(entry?.title).toBe('Moved node "Fetch customer"');
    expect(entry?.detail).toBe('(240, 0) → (360, 180)');
    expect(entry?.searchText).toContain('position.x');
  });

  it('labels removed connections as disconnections', () => {
    const diff = diffFixture();
    diff.connectionChanges = [
      {
        kind: 'removed',
        connection: {
          sourceNode: 'Fetch customer',
          sourceOutputType: 'main',
          sourceOutputIndex: 0,
          targetNode: 'Prepare data',
          targetInputType: 'main',
          targetInputIndex: 0,
        },
      },
    ];
    const entries = createChangeEntries(diff);
    expect(entries[3]?.title).toBe(
      'Disconnected "Fetch customer" → "Prepare data"',
    );
  });
});
