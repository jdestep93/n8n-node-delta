import { describe, expect, it } from 'vitest';

import type { NormalizedWorkflow, RawN8nWorkflow } from '@nodedelta/core';

import {
  NORMALIZATION_RULES,
  canonicalizeWorkflow,
  flattenConnections,
  hashWorkflow,
  normalizeN8nWorkflow,
} from './index.js';
import {
  getWorkflowFixture,
  workflowFixtures,
} from '../../test-fixtures/src/index.js';

function rawFixture(name: keyof typeof workflowFixtures): RawN8nWorkflow {
  return getWorkflowFixture(name) as RawN8nWorkflow;
}

describe('fixture corpus', () => {
  it('contains every required original synthetic pair', () => {
    expect(Object.keys(workflowFixtures).sort()).toEqual([
      'ai-prompt-after',
      'ai-prompt-before',
      'code-after',
      'code-before',
      'connections-after',
      'connections-before',
      'large-workflow-after',
      'large-workflow-before',
      'node-added-after',
      'node-added-before',
      'node-modified-after',
      'node-modified-before',
      'node-moved-after',
      'node-moved-before',
      'node-removed-after',
      'node-removed-before',
      'node-renamed-after',
      'node-renamed-before',
      'simple-after',
      'simple-before',
      'sql-after',
      'sql-before',
    ]);
  });

  it('provides a real 300-node before/after pair', () => {
    expect(rawFixture('large-workflow-before').nodes).toHaveLength(300);
    expect(rawFixture('large-workflow-after').nodes).toHaveLength(300);
  });

  it('normalizes every fixture without discarding its nodes', () => {
    for (const name of Object.keys(workflowFixtures) as Array<
      keyof typeof workflowFixtures
    >) {
      const raw = rawFixture(name);
      expect(normalizeN8nWorkflow(raw).nodes).toHaveLength(raw.nodes.length);
    }
  });
});

describe('normalizeN8nWorkflow', () => {
  it('uses explicit rules to remove only known volatile workflow fields', () => {
    expect(NORMALIZATION_RULES.workflow.excluded).toContain('updatedAt');
    expect(NORMALIZATION_RULES.workflow.excluded).toContain('versionId');

    const before = normalizeN8nWorkflow(rawFixture('simple-before'));
    const after = normalizeN8nWorkflow(rawFixture('simple-after'));

    expect(before).toEqual(after);
  });

  it('preserves expressions, array order, falsy values, and scalar types', () => {
    const normalized = normalizeN8nWorkflow(rawFixture('node-modified-before'));
    const parameters = normalized.nodes[1]?.parameters;

    expect(parameters).toEqual({
      enabled: false,
      expression: '={{ $json.customerId }}',
      label: '',
      method: 'GET',
      retries: 0,
      values: ['first', { a: 1, z: 3 }],
    });
    expect(typeof (parameters as { retries: unknown }).retries).toBe('number');
  });

  it('preserves safe unknown community-node fields as metadata', () => {
    const normalized = normalizeN8nWorkflow(rawFixture('node-modified-before'));

    expect(normalized.nodes[1]?.metadata).toEqual({
      communityField: { supported: true },
    });
  });

  it('preserves safe unknown workflow fields in normalized metadata and hashing', async () => {
    const raw: RawN8nWorkflow = {
      name: 'Forward compatible',
      nodes: [],
      connections: {},
      futureWorkflowProperty: { enabled: true, mode: 'safe' },
      updatedAt: 'volatile',
    };
    const normalized = normalizeN8nWorkflow(raw);

    expect(normalized.metadata).toEqual({
      futureWorkflowProperty: { enabled: true, mode: 'safe' },
    });
    expect(JSON.stringify(normalized)).not.toContain('volatile');

    const changed = structuredClone(normalized);
    changed.metadata = {
      futureWorkflowProperty: { enabled: false, mode: 'safe' },
    };
    await expect(hashWorkflow(changed)).resolves.not.toBe(
      await hashWorkflow(normalized),
    );
  });

  it('keeps only safe credential reference fields', () => {
    const normalized = normalizeN8nWorkflow(rawFixture('node-modified-before'));

    expect(normalized.nodes[1]?.credentials).toEqual({
      httpHeaderAuth: { id: 'credential-1', name: 'Production API' },
    });
    expect(JSON.stringify(normalized)).not.toContain('must-not-be-preserved');
  });

  it('normalizes missing and undefined object properties identically', async () => {
    const missing: RawN8nWorkflow = {
      name: 'Undefined',
      nodes: [],
      connections: {},
    };
    const withUndefined: RawN8nWorkflow = {
      ...missing,
      settings: { optional: undefined },
    };

    expect(normalizeN8nWorkflow(withUndefined)).toEqual(
      normalizeN8nWorkflow(missing),
    );
    await expect(
      hashWorkflow(normalizeN8nWorkflow(withUndefined)),
    ).resolves.toBe(await hashWorkflow(normalizeN8nWorkflow(missing)));
  });
});

describe('flattenConnections', () => {
  it('flattens all source output and target input indexes and types', () => {
    expect(
      flattenConnections(rawFixture('connections-before').connections),
    ).toEqual([
      {
        sourceNode: 'Fetch customer',
        sourceOutputIndex: 0,
        sourceOutputType: 'error',
        targetInputIndex: 1,
        targetInputType: 'error',
        targetNode: 'Route customer',
      },
      {
        sourceNode: 'Fetch customer',
        sourceOutputIndex: 0,
        sourceOutputType: 'main',
        targetInputIndex: 0,
        targetInputType: 'main',
        targetNode: 'Route customer',
      },
      {
        sourceNode: 'When clicking Test workflow',
        sourceOutputIndex: 0,
        sourceOutputType: 'main',
        targetInputIndex: 0,
        targetInputType: 'main',
        targetNode: 'Fetch customer',
      },
    ]);
  });

  it('ignores malformed connection fragments without throwing', () => {
    expect(
      flattenConnections({
        Source: {
          main: [
            null,
            [{ nope: true }, { node: 'Target', type: 'main', index: 2 }],
          ],
        },
        Broken: 'not-an-object',
      }),
    ).toEqual([
      {
        sourceNode: 'Source',
        sourceOutputIndex: 1,
        sourceOutputType: 'main',
        targetInputIndex: 2,
        targetInputType: 'main',
        targetNode: 'Target',
      },
    ]);
  });
});

describe('canonicalization and hashing', () => {
  const unordered: NormalizedWorkflow = {
    schemaVersion: 1,
    workflowId: 'workflow-1',
    name: 'Canonical',
    nodes: [
      {
        id: 'second',
        name: 'Second',
        type: 'test',
        position: { x: 1, y: 2 },
        parameters: { z: 2, a: { y: true, x: false } },
      },
      {
        id: 'first',
        name: 'First',
        type: 'test',
        position: { x: 0, y: 0 },
        parameters: { list: [3, 1, 2] },
      },
    ],
    connections: [],
    settings: { z: 2, a: 1 },
  };

  it('sorts object keys and unordered workflow collections but preserves parameter arrays', () => {
    const canonical = canonicalizeWorkflow(unordered);

    expect(Object.keys(canonical.settings)).toEqual(['a', 'z']);
    expect(canonical.nodes.map((item) => item.id)).toEqual(['first', 'second']);
    expect(canonical.nodes[0]?.parameters).toEqual({ list: [3, 1, 2] });
    expect(Object.keys(canonical.nodes[1]?.parameters as object)).toEqual([
      'a',
      'z',
    ]);
  });

  it('returns a lowercase SHA-256 digest and is stable across key and node order', async () => {
    const reordered: NormalizedWorkflow = {
      settings: { a: 1, z: 2 },
      connections: [],
      nodes: [...unordered.nodes].reverse(),
      name: 'Canonical',
      workflowId: 'workflow-1',
      schemaVersion: 1,
    };

    const hash = await hashWorkflow(unordered);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    await expect(hashWorkflow(reordered)).resolves.toBe(hash);
  });

  it('uses the standard SHA-256 digest', async () => {
    await expect(
      hashWorkflow({
        schemaVersion: 1,
        name: 'Empty',
        nodes: [],
        connections: [],
        settings: {},
      }),
    ).resolves.toBe(
      'fafa3f3e2bbe6852341d423a966e22d596dd9cd89dd7fe4f0d18ce02a259bed8',
    );
  });

  it('changes the hash for meaningful values while metadata-only fixture changes stay stable', async () => {
    const metadataBefore = normalizeN8nWorkflow(rawFixture('simple-before'));
    const metadataAfter = normalizeN8nWorkflow(rawFixture('simple-after'));
    const meaningfulBefore = normalizeN8nWorkflow(
      rawFixture('node-modified-before'),
    );
    const meaningfulAfter = normalizeN8nWorkflow(
      rawFixture('node-modified-after'),
    );

    await expect(hashWorkflow(metadataAfter)).resolves.toBe(
      await hashWorkflow(metadataBefore),
    );
    await expect(hashWorkflow(meaningfulAfter)).resolves.not.toBe(
      await hashWorkflow(meaningfulBefore),
    );
  });
});
