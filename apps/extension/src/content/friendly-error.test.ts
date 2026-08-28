import {
  N8nAuthenticationError,
  N8nNetworkError,
  UnsupportedN8nResponseError,
  WorkflowNotFoundError,
} from '@nodedelta/core';
import { describe, expect, it } from 'vitest';

import { getFriendlyWorkflowError } from './friendly-error.js';

describe('workflow loading errors', () => {
  it.each([
    [
      new N8nAuthenticationError({ diagnostics: { status: 401 } }),
      'Your n8n session has expired. Sign in to n8n, then try again.',
    ],
    [
      new N8nAuthenticationError({ diagnostics: { status: 403 } }),
      "You don't have access to read this workflow in n8n.",
    ],
    [
      new WorkflowNotFoundError('missing'),
      'This workflow is not saved yet or is no longer available.',
    ],
    [
      new UnsupportedN8nResponseError(),
      'This n8n version returned a workflow format NodeDelta does not support yet.',
    ],
    [
      new N8nNetworkError(),
      'NodeDelta could not reach n8n. Check your connection and try again.',
    ],
    [
      new Error('secret internal detail'),
      'NodeDelta could not load this workflow.',
    ],
  ])(
    'maps adapter failures without exposing internal details',
    (error, message) => {
      expect(getFriendlyWorkflowError(error)).toBe(message);
    },
  );
});
