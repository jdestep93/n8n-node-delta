export type {
  NormalizedConnection,
  NormalizedCredentialReference,
  NormalizedNode,
  NormalizedWorkflow,
  WorkflowNormalizer,
} from '@nodedelta/core';
export { canonicalizeWorkflow, hashWorkflow } from './canonical.js';
export { flattenConnections } from './connections.js';
export { N8nWorkflowNormalizer, normalizeN8nWorkflow } from './normalize.js';
export { NORMALIZATION_RULES } from './rules.js';
