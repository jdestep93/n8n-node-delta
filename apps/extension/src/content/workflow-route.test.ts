import { describe, expect, it } from 'vitest';

import { getWorkflowId } from './workflow-route.js';

describe('workflow route detection shell', () => {
  it.each([
    ['https://example.app.n8n.cloud/workflow/abc123', 'abc123'],
    [
      'https://n8n.example.com/n8n/workflow/team%20flow/executions/7',
      'team flow',
    ],
  ])('extracts a workflow ID from %s', (url, expected) => {
    expect(getWorkflowId(new URL(url))).toBe(expected);
  });

  it.each([
    'https://example.app.n8n.cloud/home/workflows',
    'https://n8n.example.com/n8n/executions/7',
  ])('does not identify non-workflow route %s', (url) => {
    expect(getWorkflowId(new URL(url))).toBeUndefined();
  });
});
