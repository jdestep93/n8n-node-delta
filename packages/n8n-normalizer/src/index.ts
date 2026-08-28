import type {
  NormalizedConnection,
  NormalizedCredentialReference,
  NormalizedNode,
  NormalizedWorkflow,
  RawConnections,
  RawN8nNode,
  RawN8nWorkflow,
  WorkflowNormalizer,
} from '@flowdiff/core';

export type {
  NormalizedConnection,
  NormalizedCredentialReference,
  NormalizedNode,
  NormalizedWorkflow,
  WorkflowNormalizer,
} from '@flowdiff/core';

export const NORMALIZATION_RULES = {
  workflow: {
    included: ['id', 'name', 'nodes', 'connections', 'settings', 'active'],
    excluded: [
      'createdAt',
      'updatedAt',
      'versionId',
      'activeVersionId',
      'staticData',
      'tags',
      'shared',
      'sharedWithProjects',
      'permissions',
      'scopes',
      'homeProject',
    ],
  },
  node: {
    included: [
      'id',
      'name',
      'type',
      'typeVersion',
      'position',
      'parameters',
      'disabled',
      'notes',
      'credentials',
    ],
    excluded: ['createdAt', 'updatedAt'],
    preserveUnknownAsMetadata: true,
  },
  credentialReference: {
    included: ['id', 'name'],
  },
} as const;

const knownNodeFields = new Set<string>(NORMALIZATION_RULES.node.included);
const excludedNodeFields = new Set<string>(NORMALIZATION_RULES.node.excluded);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : canonicalizeValue(item),
    );
  }

  if (!isRecord(value)) {
    return value;
  }

  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    if (child !== undefined) {
      canonical[key] = canonicalizeValue(child);
    }
  }
  return canonical;
}

function normalizeCredentials(
  credentials: Record<string, unknown> | undefined,
): Record<string, NormalizedCredentialReference> | undefined {
  if (credentials === undefined) {
    return undefined;
  }

  const normalized: Record<string, NormalizedCredentialReference> = {};
  for (const credentialType of Object.keys(credentials).sort()) {
    const rawReference = credentials[credentialType];
    if (typeof rawReference === 'string') {
      normalized[credentialType] = { id: rawReference };
      continue;
    }
    if (!isRecord(rawReference)) {
      continue;
    }

    const reference: NormalizedCredentialReference = {};
    if (typeof rawReference.id === 'string') {
      reference.id = rawReference.id;
    }
    if (typeof rawReference.name === 'string') {
      reference.name = rawReference.name;
    }
    if (reference.id !== undefined || reference.name !== undefined) {
      normalized[credentialType] = reference;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeNode(rawNode: RawN8nNode): NormalizedNode {
  const metadata: Record<string, unknown> = {};
  for (const key of Object.keys(rawNode).sort()) {
    if (knownNodeFields.has(key) || excludedNodeFields.has(key)) {
      continue;
    }
    const value = rawNode[key];
    if (value !== undefined) {
      metadata[key] = canonicalizeValue(value);
    }
  }

  const credentials = normalizeCredentials(rawNode.credentials);
  return {
    name: rawNode.name,
    type: rawNode.type,
    position: { x: rawNode.position[0], y: rawNode.position[1] },
    parameters: canonicalizeValue(rawNode.parameters),
    ...(rawNode.id === undefined ? {} : { id: rawNode.id }),
    ...(rawNode.typeVersion === undefined
      ? {}
      : { typeVersion: rawNode.typeVersion }),
    ...(rawNode.disabled === undefined ? {} : { disabled: rawNode.disabled }),
    ...(rawNode.notes === undefined ? {} : { notes: rawNode.notes }),
    ...(credentials === undefined ? {} : { credentials }),
    ...(Object.keys(metadata).length === 0 ? {} : { metadata }),
  };
}

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

function compareConnections(
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
  rawConnections: RawConnections,
): NormalizedConnection[] {
  const connections: NormalizedConnection[] = [];

  for (const sourceNode of Object.keys(rawConnections)) {
    const outputTypes = rawConnections[sourceNode];
    if (!isRecord(outputTypes)) {
      continue;
    }

    for (const sourceOutputType of Object.keys(outputTypes)) {
      const outputs = outputTypes[sourceOutputType];
      if (!Array.isArray(outputs)) {
        continue;
      }

      outputs.forEach((targets: unknown, sourceOutputIndex) => {
        if (!Array.isArray(targets)) {
          return;
        }
        for (const target of targets) {
          if (!isConnectionTarget(target)) {
            continue;
          }
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

export function normalizeN8nWorkflow(
  rawWorkflow: RawN8nWorkflow,
): NormalizedWorkflow {
  return {
    schemaVersion: 1,
    name: rawWorkflow.name,
    nodes: rawWorkflow.nodes.map(normalizeNode),
    connections: flattenConnections(rawWorkflow.connections),
    settings: canonicalizeValue(rawWorkflow.settings ?? {}) as Record<
      string,
      unknown
    >,
    ...(rawWorkflow.id === undefined ? {} : { workflowId: rawWorkflow.id }),
    ...(rawWorkflow.active === undefined ? {} : { active: rawWorkflow.active }),
  };
}

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
        (connection) => canonicalizeValue(connection) as NormalizedConnection,
      )
      .sort(compareConnections),
    settings: canonicalizeValue(workflow.settings) as Record<string, unknown>,
  };

  return canonicalizeValue(canonical) as NormalizedWorkflow;
}

export async function hashWorkflow(
  workflow: NormalizedWorkflow,
): Promise<string> {
  if (globalThis.crypto?.subtle === undefined) {
    throw new Error('Web Crypto SHA-256 is unavailable in this environment.');
  }

  const serialized = JSON.stringify(canonicalizeWorkflow(workflow));
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialized),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export class N8nWorkflowNormalizer implements WorkflowNormalizer {
  normalize(workflow: RawN8nWorkflow): NormalizedWorkflow {
    return normalizeN8nWorkflow(workflow);
  }
}
