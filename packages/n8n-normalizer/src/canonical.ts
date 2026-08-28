import {
  canonicalizeValue,
  compareText,
  sha256,
  type NormalizedNode,
  type NormalizedWorkflow,
} from '@nodedelta/core';
import { compareConnections } from './connections.js';

function compareNodes(left: NormalizedNode, right: NormalizedNode): number {
  return (
    compareText(left.id ?? '', right.id ?? '') ||
    compareText(left.name, right.name) ||
    compareText(left.type, right.type) ||
    left.position.x - right.position.x ||
    left.position.y - right.position.y ||
    compareText(
      JSON.stringify(canonicalizeValue(left)),
      JSON.stringify(canonicalizeValue(right)),
    )
  );
}

export function canonicalizeWorkflow(
  workflow: NormalizedWorkflow,
): NormalizedWorkflow {
  const canonical: NormalizedWorkflow = {
    ...workflow,
    nodes: workflow.nodes
      .map((node) => canonicalizeValue(node) as NormalizedNode)
      .sort(compareNodes),
    connections: workflow.connections
      .map(
        (connection) =>
          canonicalizeValue(
            connection,
          ) as NormalizedWorkflow['connections'][number],
      )
      .sort(compareConnections),
    settings: canonicalizeValue(workflow.settings) as Record<string, unknown>,
    ...(workflow.metadata === undefined
      ? {}
      : {
          metadata: canonicalizeValue(workflow.metadata) as Record<
            string,
            unknown
          >,
        }),
  };
  return canonicalizeValue(canonical) as NormalizedWorkflow;
}

export function hashWorkflow(workflow: NormalizedWorkflow): Promise<string> {
  return Promise.resolve(
    sha256(JSON.stringify(canonicalizeWorkflow(workflow))),
  );
}
