import { describe, expect, it } from 'vitest';

import {
  NodeDeltaError,
  N8nAuthenticationError,
  N8nNetworkError,
  N8nNotDetectedError,
  PermissionRequiredError,
  StorageQuotaError,
  StorageUnavailableError,
  UnsupportedN8nResponseError,
  WorkflowNotFoundError,
} from './index.js';

describe('NodeDelta errors', () => {
  it.each([
    [new N8nNotDetectedError(), 'N8N_NOT_DETECTED'],
    [new WorkflowNotFoundError('abc'), 'WORKFLOW_NOT_FOUND'],
    [new N8nAuthenticationError(), 'N8N_AUTHENTICATION'],
    [new UnsupportedN8nResponseError(), 'UNSUPPORTED_N8N_RESPONSE'],
    [new N8nNetworkError(), 'N8N_NETWORK'],
    [
      new PermissionRequiredError('https://n8n.example.com'),
      'PERMISSION_REQUIRED',
    ],
    [new StorageUnavailableError(), 'STORAGE_UNAVAILABLE'],
    [new StorageQuotaError(), 'STORAGE_QUOTA'],
  ] as const)('exposes a stable code for %s', (error, expectedCode) => {
    expect(error).toBeInstanceOf(NodeDeltaError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(expectedCode);
    expect(error.name).toBe(error.constructor.name);
  });

  it('retains a diagnostic cause without exposing it in the user message', () => {
    const cause = new TypeError('socket details');
    const error = new N8nNetworkError({ cause });

    expect(error.cause).toBe(cause);
    expect(error.message).not.toContain('socket details');
  });
});
