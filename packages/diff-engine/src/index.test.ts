import { writeFileSync } from 'node:fs';

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type {
  NormalizedNode,
  NormalizedWorkflow,
  RawN8nWorkflow,
  WorkflowDiff,
} from '@nodedelta/core';

import { getWorkflowFixture } from '../../test-fixtures/src/index.js';
import type { workflowFixtures } from '../../test-fixtures/src/index.js';
import aiPromptGolden from './goldens/ai-prompt.json' with { type: 'json' };
import codeGolden from './goldens/code.json' with { type: 'json' };
import connectionsGolden from './goldens/connections.json' with { type: 'json' };
import largeWorkflowGolden from './goldens/large-workflow.json' with { type: 'json' };
import nodeAddedGolden from './goldens/node-added.json' with { type: 'json' };
import nodeModifiedGolden from './goldens/node-modified.json' with { type: 'json' };
import nodeMovedGolden from './goldens/node-moved.json' with { type: 'json' };
import nodeRemovedGolden from './goldens/node-removed.json' with { type: 'json' };
import nodeRenamedGolden from './goldens/node-renamed.json' with { type: 'json' };
import simpleGolden from './goldens/simple.json' with { type: 'json' };
import sqlGolden from './goldens/sql.json' with { type: 'json' };
import {
  classifyTextParameter,
  classifyValueChange,
  diffWorkflows,
} from './index.js';

// Keep in sync with the corpus list asserted by the normalizer tests.
const FIXTURE_PAIR_NAMES = [
  'simple',
  'node-added',
  'node-removed',
  'node-modified',
  'node-renamed',
  'node-moved',
  'connections',
  'code',
  'sql',
  'ai-prompt',
  'large-workflow',
] as const;

type FixturePairName = (typeof FIXTURE_PAIR_NAMES)[number];

// Golden files are generated with UPDATE_GOLDENS=true pnpm test from the
// current engine output, reviewed, and committed; the test then guards
// against accidental behavioral drift.
function asGolden(value: unknown): WorkflowDiff {
  return value as WorkflowDiff;
}

const GOLDENS: Record<FixturePairName, WorkflowDiff> = {
  simple: asGolden(simpleGolden),
  'node-added': asGolden(nodeAddedGolden),
  'node-removed': asGolden(nodeRemovedGolden),
  'node-modified': asGolden(nodeModifiedGolden),
  'node-renamed': asGolden(nodeRenamedGolden),
  'node-moved': asGolden(nodeMovedGolden),
  connections: asGolden(connectionsGolden),
  code: asGolden(codeGolden),
  sql: asGolden(sqlGolden),
  'ai-prompt': asGolden(aiPromptGolden),
  'large-workflow': asGolden(largeWorkflowGolden),
};

function rawFixture(name: keyof typeof workflowFixtures): RawN8nWorkflow {
  return getWorkflowFixture(name) as RawN8nWorkflow;
}

function fixturePair(name: FixturePairName): {
  before: NormalizedWorkflow;
  after: NormalizedWorkflow;
} {
  // Fixtures are raw workflows; the diff engine consumes normalized ones, so
  // normalize here with a local copy of the contract-faithful shape.
  const normalize = (raw: RawN8nWorkflow): NormalizedWorkflow => ({
    schemaVersion: 1,
    name: raw.name,
    nodes: raw.nodes.map((node) => ({
      ...(node.id === undefined ? {} : { id: node.id }),
      name: node.name,
      type: node.type,
      ...(node.typeVersion === undefined
        ? {}
        : { typeVersion: node.typeVersion }),
      position: { x: node.position[0], y: node.position[1] },
      parameters: structuredClone(node.parameters),
      ...(node.disabled === undefined ? {} : { disabled: node.disabled }),
      ...(node.notes === undefined ? {} : { notes: node.notes }),
      ...(node.credentials === undefined
        ? {}
        : {
            credentials: Object.fromEntries(
              Object.entries(node.credentials).map(([key, value]) => [
                key,
                typeof value === 'object' && value !== null
                  ? {
                      ...('id' in value && typeof value.id === 'string'
                        ? { id: value.id }
                        : {}),
                      ...('name' in value && typeof value.name === 'string'
                        ? { name: value.name }
                        : {}),
                    }
                  : {},
              ]),
            ),
          }),
      ...('metadata' in node && node.metadata !== null
        ? { metadata: node.metadata as Record<string, unknown> }
        : {}),
    })),
    connections: flattenForTest(raw.connections),
    settings: raw.settings ?? {},
    ...(raw.id === undefined ? {} : { workflowId: raw.id }),
    ...(raw.active === undefined ? {} : { active: raw.active }),
  });

  return {
    before: normalize(rawFixture(`${name}-before`)),
    after: normalize(rawFixture(`${name}-after`)),
  };
}

type ConnectionTarget = { node: string; type: string; index: number };

function flattenForTest(
  raw: Record<string, unknown>,
): NormalizedWorkflow['connections'] {
  const connections: NormalizedWorkflow['connections'] = [];
  for (const [sourceNode, outputTypes] of Object.entries(raw)) {
    if (typeof outputTypes !== 'object' || outputTypes === null) continue;
    for (const [sourceOutputType, outputs] of Object.entries(outputTypes)) {
      if (!Array.isArray(outputs)) continue;
      outputs.forEach((targets: unknown, sourceOutputIndex) => {
        if (!Array.isArray(targets)) return;
        for (const target of targets as ConnectionTarget[]) {
          if (typeof target?.node !== 'string') continue;
          connections.push({
            sourceNode,
            sourceOutputType,
            sourceOutputIndex,
            targetNode: target.node,
            targetInputType: target.type,
            targetInputIndex: target.index,
          });
        }
      });
    }
  }
  return connections.sort((left, right) =>
    `${left.sourceNode}${left.sourceOutputType}${left.sourceOutputIndex}${left.targetNode}${left.targetInputType}${left.targetInputIndex}`.localeCompare(
      `${right.sourceNode}${right.sourceOutputType}${right.sourceOutputIndex}${right.targetNode}${right.targetInputType}${right.targetInputIndex}`,
    ),
  );
}

describe('fixture corpus diffs', () => {
  it('reports no changes for the metadata-only simple pair', () => {
    const { before, after } = fixturePair('simple');
    const diff = diffWorkflows(before, after);

    expect(diff.summary).toEqual({
      nodesAdded: 0,
      nodesRemoved: 0,
      nodesModified: 0,
      nodesRenamed: 0,
      nodesMoved: 0,
      connectionsAdded: 0,
      connectionsRemoved: 0,
      workflowChanges: 0,
    });
    expect(diff.nodeChanges).toEqual([]);
    expect(diff.connectionChanges).toEqual([]);
    expect(diff.workflowChanges).toEqual([]);
  });

  it('detects the added node and its new connection', () => {
    const { before, after } = fixturePair('node-added');
    const diff = diffWorkflows(before, after);

    expect(diff.summary.nodesAdded).toBe(1);
    expect(diff.summary.connectionsAdded).toBe(1);
    expect(diff.nodeChanges).toHaveLength(1);
    expect(diff.nodeChanges[0]?.kind).toBe('added');
    expect(diff.nodeChanges[0]?.after).toMatchObject({
      id: 'set-1',
      name: 'Prepare data',
    });
    expect(diff.connectionChanges[0]?.kind).toBe('added');
    expect(diff.connectionChanges[0]?.connection).toMatchObject({
      sourceNode: 'Fetch customer',
      targetNode: 'Prepare data',
    });
  });

  it('detects the removed node and its dropped connection', () => {
    const { before, after } = fixturePair('node-removed');
    const diff = diffWorkflows(before, after);

    expect(diff.summary.nodesRemoved).toBe(1);
    expect(diff.summary.connectionsRemoved).toBe(1);
    expect(diff.nodeChanges[0]?.kind).toBe('removed');
    expect(diff.nodeChanges[0]?.before).toMatchObject({
      id: 'set-1',
      name: 'Prepare data',
    });
    expect(diff.connectionChanges[0]?.connection).toMatchObject({
      sourceNode: 'Fetch customer',
      targetNode: 'Prepare data',
    });
  });
});

describe('fixture corpus change classification', () => {
  it('reports parameter and credential changes for the modified node', () => {
    const { before, after } = fixturePair('node-modified');
    const diff = diffWorkflows(before, after);

    expect(diff.summary.nodesModified).toBe(1);
    expect(diff.nodeChanges).toHaveLength(1);
    const change = diff.nodeChanges[0];
    expect(change?.kind).toBe('modified');
    expect(change?.before).toMatchObject({ id: 'request-1' });
    expect(change?.changes).toEqual([
      {
        path: 'parameters.method',
        before: 'GET',
        after: 'POST',
      },
      {
        path: 'credentials.httpHeaderAuth.id',
        before: 'credential-1',
        after: 'credential-2',
      },
      {
        path: 'credentials.httpHeaderAuth.name',
        before: 'Production API',
        after: 'Staging API',
      },
    ]);
  });

  it('classifies an id-stable rename as renamed without connection churn', () => {
    const { before, after } = fixturePair('node-renamed');
    const diff = diffWorkflows(before, after);

    expect(diff.summary.nodesRenamed).toBe(1);
    expect(diff.nodeChanges).toHaveLength(1);
    expect(diff.nodeChanges[0]?.kind).toBe('renamed');
    expect(diff.nodeChanges[0]?.changes).toEqual([
      {
        path: 'name',
        before: 'Fetch customer',
        after: 'Load customer',
      },
    ]);
    // Connection endpoints are remapped through the rename, so rewiring the
    // same topology under the new name is not reported as a connection change.
    expect(diff.summary.connectionsAdded).toBe(0);
    expect(diff.summary.connectionsRemoved).toBe(0);
    expect(diff.connectionChanges).toEqual([]);
  });

  it('reports movement as position changes without other field noise', () => {
    const { before, after } = fixturePair('node-moved');
    const diff = diffWorkflows(before, after);

    expect(diff.summary.nodesMoved).toBe(1);
    expect(diff.nodeChanges).toHaveLength(1);
    expect(diff.nodeChanges[0]?.kind).toBe('moved');
    expect(diff.nodeChanges[0]?.changes).toEqual([
      { path: 'position.x', before: 240, after: 360 },
      { path: 'position.y', before: 0, after: 180 },
    ]);
  });
});

describe('connection rewiring and parameter pairs', () => {
  it('reports the rewired connections fixture as exact added/removed sets', () => {
    const { before, after } = fixturePair('connections');
    const diff = diffWorkflows(before, after);

    expect(diff.summary.nodesAdded).toBe(0);
    expect(diff.summary.nodesRemoved).toBe(0);
    expect(diff.summary.connectionsAdded).toBe(2);
    expect(diff.summary.connectionsRemoved).toBe(3);

    const added = diff.connectionChanges
      .filter((change) => change.kind === 'added')
      .map((change) => change.connection);
    expect(added).toContainEqual({
      sourceNode: 'Route customer',
      sourceOutputType: 'main',
      sourceOutputIndex: 1,
      targetNode: 'Fetch customer',
      targetInputType: 'main',
      targetInputIndex: 0,
    });
    expect(added).toContainEqual({
      sourceNode: 'When clicking Test workflow',
      sourceOutputType: 'main',
      sourceOutputIndex: 0,
      targetNode: 'Route customer',
      targetInputType: 'main',
      targetInputIndex: 0,
    });

    const removed = diff.connectionChanges
      .filter((change) => change.kind === 'removed')
      .map((change) => change.connection);
    expect(removed).toContainEqual({
      sourceNode: 'When clicking Test workflow',
      sourceOutputType: 'main',
      sourceOutputIndex: 0,
      targetNode: 'Fetch customer',
      targetInputType: 'main',
      targetInputIndex: 0,
    });
    expect(removed).toContainEqual({
      sourceNode: 'Fetch customer',
      sourceOutputType: 'main',
      sourceOutputIndex: 0,
      targetNode: 'Route customer',
      targetInputType: 'main',
      targetInputIndex: 0,
    });
    expect(removed).toContainEqual({
      sourceNode: 'Fetch customer',
      sourceOutputType: 'error',
      sourceOutputIndex: 0,
      targetNode: 'Route customer',
      targetInputType: 'error',
      targetInputIndex: 1,
    });
  });

  it.each([
    ['code', 'Transform records', 'parameters.jsCode'],
    ['sql', 'Find customer', 'parameters.query'],
    ['ai-prompt', 'Draft reply', 'parameters.text'],
  ] as const)(
    'detects the %s parameter change on %s',
    (pairName, nodeName, path) => {
      const { before, after } = fixturePair(pairName);
      const diff = diffWorkflows(before, after);

      expect(diff.summary.nodesModified).toBe(1);
      expect(diff.nodeChanges).toHaveLength(1);
      expect(diff.nodeChanges[0]?.kind).toBe('modified');
      expect(diff.nodeChanges[0]?.before).toMatchObject({ name: nodeName });
      expect(diff.nodeChanges[0]?.changes).toHaveLength(1);
      expect(diff.nodeChanges[0]?.changes[0]?.path).toBe(path);
      expect(diff.nodeChanges[0]?.changes[0]?.before).toBeDefined();
      expect(diff.nodeChanges[0]?.changes[0]?.after).toBeDefined();
    },
  );

  it('finds the single changed node inside the 300-node large pair', () => {
    const { before, after } = fixturePair('large-workflow');
    expect(before.nodes).toHaveLength(300);
    expect(after.nodes).toHaveLength(300);

    const diff = diffWorkflows(before, after);

    expect(diff.nodeChanges).toHaveLength(1);
    expect(diff.nodeChanges[0]?.kind).toBe('modified');
    expect(diff.nodeChanges[0]?.after).toMatchObject({
      name: 'Large node 300',
    });
    expect(diff.nodeChanges[0]?.changes).toEqual([
      {
        path: 'parameters.expression',
        before: '={{ $json.values[299] }}',
        after: '={{ $json.final }}',
      },
      { path: 'parameters.value', before: 299, after: 300 },
    ]);
    expect(diff.summary).toMatchObject({
      nodesAdded: 0,
      nodesRemoved: 0,
      nodesModified: 1,
      connectionsAdded: 0,
      connectionsRemoved: 0,
      workflowChanges: 0,
    });
  });
});

describe('matching and workflow-level semantics', () => {
  const workflowWith = (
    name: string,
    nodes: NormalizedWorkflow['nodes'],
    overrides: Partial<NormalizedWorkflow> = {},
  ): NormalizedWorkflow => ({
    schemaVersion: 1,
    name,
    nodes,
    connections: [],
    settings: {},
    ...overrides,
  });

  const nodeWith = (
    name: string,
    overrides: Partial<NormalizedNode> = {},
  ): NormalizedNode => ({
    name,
    type: 'test',
    position: { x: 0, y: 0 },
    parameters: {},
    ...overrides,
  });

  it('reports workflow name, active, and settings changes', () => {
    const diff = diffWorkflows(
      workflowWith('Report', [], {
        settings: { executionOrder: 'v1', timezone: 'UTC' },
      }),
      workflowWith('Report renamed', [], {
        settings: { executionOrder: 'v1' },
        active: true,
      }),
    );

    expect(diff.workflowChanges).toEqual([
      { path: 'active', after: true },
      { path: 'name', before: 'Report', after: 'Report renamed' },
      { path: 'settings.timezone', before: 'UTC' },
    ]);
    expect(diff.summary.workflowChanges).toBe(3);
  });

  it('matches nodes by name when neither side has an id', () => {
    const diff = diffWorkflows(
      workflowWith('W', [nodeWith('A', { parameters: { p: 1 } })]),
      workflowWith('W', [nodeWith('A', { parameters: { p: 2 } })]),
    );

    expect(diff.summary.nodesModified).toBe(1);
    expect(diff.nodeChanges[0]?.kind).toBe('modified');
    expect(diff.nodeChanges[0]?.changes).toEqual([
      { path: 'parameters.p', before: 1, after: 2 },
    ]);
  });

  it('detects an id-less content-identical rename conservatively', () => {
    const before = workflowWith('W', [nodeWith('A')]);
    const after = workflowWith('W', [nodeWith('B')]);
    const diff = diffWorkflows(before, after);

    // Fuzzy rename: the two unmatched nodes have identical content
    // fingerprints and the match is unambiguous.
    expect(diff.summary.nodesRenamed).toBe(1);
    expect(diff.summary.nodesAdded).toBe(0);
    expect(diff.summary.nodesRemoved).toBe(0);
    expect(diff.nodeChanges[0]?.kind).toBe('renamed');
    expect(diff.nodeChanges[0]?.changes).toEqual([
      { path: 'name', before: 'A', after: 'B' },
    ]);
  });

  it('treats id-less nodes with different content as removal plus addition', () => {
    const diff = diffWorkflows(
      workflowWith('W', [nodeWith('A', { parameters: { p: 1 } })]),
      workflowWith('W', [nodeWith('B', { parameters: { p: 2 } })]),
    );

    expect(diff.summary.nodesAdded).toBe(1);
    expect(diff.summary.nodesRemoved).toBe(1);
    expect(diff.summary.nodesRenamed).toBe(0);
  });

  it('refuses fuzzy renames when the fingerprint match is ambiguous', () => {
    const diff = diffWorkflows(
      workflowWith('W', [nodeWith('A'), nodeWith('B')]),
      workflowWith('W', [nodeWith('C')]),
    );

    // Two identical-content before nodes could both be "C renamed" — the
    // conservative choice is one removal plus one removal and one addition.
    expect(diff.summary.nodesAdded).toBe(1);
    expect(diff.summary.nodesRemoved).toBe(2);
    expect(diff.summary.nodesRenamed).toBe(0);
  });

  it('does not report missing-optional versus default-value flips', () => {
    const diff = diffWorkflows(
      workflowWith('W', [nodeWith('A')]),
      workflowWith('W', [
        nodeWith('A', {
          typeVersion: 1,
          disabled: false,
          notes: '',
        }),
      ]),
    );

    expect(diff.nodeChanges).toEqual([]);
    expect(diff.summary).toMatchObject({
      nodesModified: 0,
      nodesMoved: 0,
    });
  });

  it('reverses additions and removals when diffing in the opposite direction', () => {
    const { before, after } = fixturePair('node-added');
    const forward = diffWorkflows(before, after);
    const backward = diffWorkflows(after, before);

    expect(backward.summary.nodesRemoved).toBe(forward.summary.nodesAdded);
    expect(backward.summary.nodesAdded).toBe(forward.summary.nodesRemoved);
    expect(backward.summary.connectionsRemoved).toBe(
      forward.summary.connectionsAdded,
    );
    expect(backward.nodeChanges[0]?.kind).toBe('removed');
    expect(backward.nodeChanges[0]?.before).toMatchObject({
      name: 'Prepare data',
    });
  });

  it('reports every node and connection as added when starting from empty', () => {
    const { after } = fixturePair('node-added');
    const diff = diffWorkflows(
      workflowWith('Empty', [], { settings: {} }),
      after,
    );

    expect(diff.summary.nodesAdded).toBe(3);
    expect(diff.summary.connectionsAdded).toBe(2);
  });

  it('counts moved, renamed, and modified aspects independently', () => {
    const diff = diffWorkflows(
      workflowWith('W', [
        nodeWith('A', { parameters: { p: 1 }, position: { x: 0, y: 0 } }),
      ]),
      workflowWith('W', [
        nodeWith('A', { parameters: { p: 2 }, position: { x: 100, y: 0 } }),
      ]),
    );

    expect(diff.nodeChanges).toHaveLength(1);
    expect(diff.nodeChanges[0]?.kind).toBe('modified');
    expect(diff.summary.nodesModified).toBe(1);
    expect(diff.summary.nodesMoved).toBe(1);
    expect(diff.summary.nodesRenamed).toBe(0);
  });

  it('counts a rename and a move independently for the same node', () => {
    const diff = diffWorkflows(
      workflowWith('W', [nodeWith('A', { position: { x: 0, y: 0 } })]),
      workflowWith('W', [nodeWith('B', { position: { x: 0, y: 50 } })]),
    );

    expect(diff.nodeChanges).toHaveLength(1);
    expect(diff.nodeChanges[0]?.kind).toBe('renamed');
    expect(diff.summary.nodesRenamed).toBe(1);
    expect(diff.summary.nodesMoved).toBe(1);
    expect(diff.summary.nodesModified).toBe(0);
  });

  it('treats n8n expressions as inert text and never evaluates them', () => {
    const expression = '={{ { "nested": $json.value } }}';
    const unchanged = diffWorkflows(
      workflowWith('W', [nodeWith('A', { parameters: { url: expression } })]),
      workflowWith('W', [nodeWith('A', { parameters: { url: expression } })]),
    );
    expect(unchanged.nodeChanges).toEqual([]);

    const changed = diffWorkflows(
      workflowWith('W', [nodeWith('A', { parameters: { url: expression } })]),
      workflowWith('W', [
        nodeWith('A', { parameters: { url: '={{ $json.other }}' } }),
      ]),
    );
    expect(changed.nodeChanges[0]?.changes).toEqual([
      {
        path: 'parameters.url',
        before: expression,
        after: '={{ $json.other }}',
      },
    ]);
  });

  it('is deterministic across runs and reports array reordering by index', () => {
    const before = workflowWith('W', [
      nodeWith('A', { parameters: { list: [1, 2, 3] } }),
    ]);
    const after = workflowWith('W', [
      nodeWith('A', { parameters: { list: [3, 2, 1] } }),
    ]);

    expect(diffWorkflows(before, after)).toEqual(diffWorkflows(before, after));
    expect(diffWorkflows(before, after).nodeChanges[0]?.changes).toEqual([
      { path: 'parameters.list.0', before: 1, after: 3 },
      { path: 'parameters.list.2', before: 3, after: 1 },
    ]);
  });

  it('diffs the 300-node pair within the documented performance budget', () => {
    const { before, after } = fixturePair('large-workflow');

    const startedAt = performance.now();
    const diff = diffWorkflows(before, after);
    const elapsedMs = performance.now() - startedAt;

    expect(diff.nodeChanges).toHaveLength(1);
    // CI variance guardrail; the budget and measured timings are documented
    // in docs/architecture.md.
    expect(elapsedMs).toBeLessThan(500);
  });
});

describe('golden diffs (T05 acceptance)', () => {
  it.each(FIXTURE_PAIR_NAMES)('matches the %s golden', (pairName) => {
    const { before, after } = fixturePair(pairName);
    const diff = diffWorkflows(before, after);

    if (process.env.UPDATE_GOLDENS === 'true') {
      writeFileSync(
        fileURLToPath(new URL(`./goldens/${pairName}.json`, import.meta.url)),
        `${JSON.stringify(diff, null, 2)}\n`,
      );
    }

    expect(diff).toEqual(GOLDENS[pairName]);
  });
});

describe('text classification (T09 seam)', () => {
  it('classifies known n8n parameter paths and value shapes', () => {
    expect(classifyTextParameter('parameters.jsCode', 'return items;')).toBe(
      'javascript',
    );
    expect(classifyTextParameter('parameters.pythonCode', 'print(1)')).toBe(
      'python',
    );
    expect(classifyTextParameter('parameters.opts.query', 'SELECT 1;')).toBe(
      'sql',
    );
    expect(classifyTextParameter('parameters.url', '={{ $json.target }}')).toBe(
      'expression',
    );
    expect(classifyTextParameter('parameters.body', '{"a": 1}')).toBe('json');
    expect(classifyTextParameter('parameters.body', '[1, 2]')).toBe('json');
    expect(classifyTextParameter('parameters.body', '{not json')).toBe('text');
    expect(classifyTextParameter('parameters.note', 'hello')).toBe('text');
    expect(classifyTextParameter('parameters.count', 5)).toBe('text');
  });

  it('classifies value changes from the after value, else the before value', () => {
    expect(classifyValueChange({ path: 'parameters.jsCode', after: 'x' })).toBe(
      'javascript',
    );
    expect(
      classifyValueChange({ path: 'parameters.name', before: 'Old' }),
    ).toBe('text');
  });
});
