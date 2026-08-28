import { describe, expectTypeOf, it } from 'vitest';

import type {
  N8nAdapter,
  NormalizedWorkflow,
  RawN8nWorkflow,
  SnapshotRepository,
  WorkflowDiff,
  WorkflowDiffer,
  WorkflowNormalizer,
  WorkflowProvider,
  WorkflowSnapshot,
} from './index.js';

describe('public domain contracts', () => {
  it('keeps adapters substitutable for workflow providers', () => {
    expectTypeOf<N8nAdapter>().toMatchTypeOf<WorkflowProvider>();
  });

  it('keeps normalization, persistence, and diffing browser-independent', () => {
    expectTypeOf<
      WorkflowNormalizer['normalize']
    >().returns.toEqualTypeOf<NormalizedWorkflow>();
    expectTypeOf<
      WorkflowDiffer['diff']
    >().returns.toEqualTypeOf<WorkflowDiff>();
    expectTypeOf<SnapshotRepository['save']>()
      .parameter(0)
      .toEqualTypeOf<WorkflowSnapshot>();
  });

  it('preserves unknown workflow and node properties', () => {
    const workflow: RawN8nWorkflow = {
      name: 'Community workflow',
      nodes: [
        {
          name: 'Community node',
          type: 'custom.node',
          typeVersion: 1,
          position: [0, 0],
          parameters: { futureSetting: true },
          futureNodeField: 'kept',
        },
      ],
      connections: {},
      futureWorkflowField: 'kept',
    };

    expectTypeOf(workflow.futureWorkflowField).toEqualTypeOf<unknown>();
    expectTypeOf(workflow.nodes[0]?.futureNodeField).toEqualTypeOf<unknown>();
  });
});
