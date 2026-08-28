import {
  canonicalizeValue,
  isRecord,
  type NormalizedCredentialReference,
  type NormalizedNode,
  type NormalizedWorkflow,
  type RawN8nNode,
  type RawN8nWorkflow,
  type WorkflowNormalizer,
} from '@nodedelta/core';
import { flattenConnections } from './connections.js';
import { NORMALIZATION_RULES } from './rules.js';

const knownNodeFields = new Set<string>(NORMALIZATION_RULES.node.included);
const excludedNodeFields = new Set<string>(NORMALIZATION_RULES.node.excluded);
const knownWorkflowFields = new Set<string>(
  NORMALIZATION_RULES.workflow.included,
);
const excludedWorkflowFields = new Set<string>(
  NORMALIZATION_RULES.workflow.excluded,
);

function normalizeMetadata(
  source: Record<string, unknown>,
  known: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (known.has(key) || excluded.has(key) || source[key] === undefined)
      continue;
    metadata[key] = canonicalizeValue(source[key]);
  }
  return Object.keys(metadata).length === 0 ? undefined : metadata;
}

function normalizeCredentials(
  credentials: Record<string, unknown> | undefined,
): Record<string, NormalizedCredentialReference> | undefined {
  if (credentials === undefined) return undefined;
  const normalized: Record<string, NormalizedCredentialReference> = {};
  for (const credentialType of Object.keys(credentials).sort()) {
    const raw = credentials[credentialType];
    if (typeof raw === 'string') {
      normalized[credentialType] = { id: raw };
      continue;
    }
    if (!isRecord(raw)) continue;
    const reference: NormalizedCredentialReference = {};
    if (typeof raw.id === 'string') reference.id = raw.id;
    if (typeof raw.name === 'string') reference.name = raw.name;
    if (reference.id !== undefined || reference.name !== undefined) {
      normalized[credentialType] = reference;
    }
  }
  return Object.keys(normalized).length === 0 ? undefined : normalized;
}

function normalizeNode(raw: RawN8nNode): NormalizedNode {
  const credentials = normalizeCredentials(raw.credentials);
  const metadata = normalizeMetadata(raw, knownNodeFields, excludedNodeFields);
  return {
    name: raw.name,
    type: raw.type,
    position: { x: raw.position[0], y: raw.position[1] },
    parameters: canonicalizeValue(raw.parameters),
    ...(raw.id === undefined ? {} : { id: raw.id }),
    ...(raw.typeVersion === undefined ? {} : { typeVersion: raw.typeVersion }),
    ...(raw.disabled === undefined ? {} : { disabled: raw.disabled }),
    ...(raw.notes === undefined ? {} : { notes: raw.notes }),
    ...(credentials === undefined ? {} : { credentials }),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

export function normalizeN8nWorkflow(raw: RawN8nWorkflow): NormalizedWorkflow {
  const metadata = normalizeMetadata(
    raw,
    knownWorkflowFields,
    excludedWorkflowFields,
  );
  return {
    schemaVersion: 1,
    name: raw.name,
    nodes: raw.nodes.map(normalizeNode),
    connections: flattenConnections(raw.connections),
    settings: canonicalizeValue(raw.settings ?? {}) as Record<string, unknown>,
    ...(raw.id === undefined ? {} : { workflowId: raw.id }),
    ...(raw.active === undefined ? {} : { active: raw.active }),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

export class N8nWorkflowNormalizer implements WorkflowNormalizer {
  normalize(workflow: RawN8nWorkflow): NormalizedWorkflow {
    return normalizeN8nWorkflow(workflow);
  }
}
