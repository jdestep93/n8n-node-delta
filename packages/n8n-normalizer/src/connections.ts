import {
  compareText,
  isRecord,
  type NormalizedConnection,
  type RawConnections,
} from '@nodedelta/core';

interface RawConnectionTarget {
  node: string;
  type: string;
  index: number;
}

function isConnectionTarget(value: unknown): value is RawConnectionTarget {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.type === 'string' &&
    typeof value.index === 'number' &&
    Number.isInteger(value.index) &&
    value.index >= 0
  );
}

export function compareConnections(
  left: NormalizedConnection,
  right: NormalizedConnection,
): number {
  return (
    compareText(left.sourceNode, right.sourceNode) ||
    compareText(left.sourceOutputType, right.sourceOutputType) ||
    left.sourceOutputIndex - right.sourceOutputIndex ||
    compareText(left.targetNode, right.targetNode) ||
    compareText(left.targetInputType, right.targetInputType) ||
    left.targetInputIndex - right.targetInputIndex
  );
}

export function flattenConnections(
  raw: RawConnections,
): NormalizedConnection[] {
  const connections: NormalizedConnection[] = [];
  for (const sourceNode of Object.keys(raw)) {
    const outputTypes = raw[sourceNode];
    if (!isRecord(outputTypes)) continue;
    for (const sourceOutputType of Object.keys(outputTypes)) {
      const outputs = outputTypes[sourceOutputType];
      if (!Array.isArray(outputs)) continue;
      outputs.forEach((targets: unknown, sourceOutputIndex) => {
        if (!Array.isArray(targets)) return;
        for (const target of targets) {
          if (!isConnectionTarget(target)) continue;
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
  return connections.sort(compareConnections);
}
