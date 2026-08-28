import {
  N8nAuthenticationError,
  N8nNetworkError,
  UnsupportedN8nResponseError,
  WorkflowNotFoundError,
} from '@nodedelta/core';

export function getFriendlyWorkflowError(error: unknown): string {
  if (error instanceof N8nAuthenticationError) {
    return error.diagnostics?.status === 403
      ? "You don't have access to read this workflow in n8n."
      : 'Your n8n session has expired. Sign in to n8n, then try again.';
  }
  if (error instanceof WorkflowNotFoundError) {
    return 'This workflow is not saved yet or is no longer available.';
  }
  if (error instanceof UnsupportedN8nResponseError) {
    return 'This n8n version returned a workflow format NodeDelta does not support yet.';
  }
  if (error instanceof N8nNetworkError) {
    return 'NodeDelta could not reach n8n. Check your connection and try again.';
  }
  return 'NodeDelta could not load this workflow.';
}
