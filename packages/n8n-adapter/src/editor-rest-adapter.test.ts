import {
  N8nAuthenticationError,
  N8nNetworkError,
  N8nNotDetectedError,
  UnsupportedN8nResponseError,
  WorkflowNotFoundError,
} from '@flowdiff/core';
import { describe, expect, it, vi } from 'vitest';

import {
  EditorRestN8nAdapter,
  type N8nAdapterEnvironment,
} from './editor-rest-adapter.js';

type Fetcher = N8nAdapterEnvironment['fetch'];

const workflow = {
  id: 'workflow-id',
  name: 'Customer Support',
  nodes: [
    {
      id: 'node-id',
      name: 'Agent',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 2,
      position: [10, 20],
      parameters: {
        futureNestedParameter: { mode: 'preserved', values: [1, 2, 3] },
      },
      futureNodeProperty: { addedBy: 'newer-n8n' },
    },
  ],
  connections: {},
  futureWorkflowProperty: { supported: true },
};

function environment(
  fetcher: Fetcher,
  options: {
    url?: string;
    scriptUrls?: readonly string[];
    restEndpointContent?: string;
  } = {},
): N8nAdapterEnvironment {
  return {
    currentUrl: () =>
      new URL(
        options.url ?? 'https://self.example/automation/workflow/workflow-id',
      ),
    basePathScriptUrls: () =>
      options.scriptUrls ?? [
        'https://self.example/automation/static/base-path.js',
      ],
    restEndpointContent: () => options.restEndpointContent,
    fetch: fetcher,
  };
}

describe('Editor REST n8n adapter', () => {
  it('detects the current instance and workflow from its environment', async () => {
    const adapter = new EditorRestN8nAdapter(environment(vi.fn<Fetcher>()));

    await expect(adapter.detect()).resolves.toEqual({
      origin: 'https://self.example',
      basePath: '/automation/',
      instanceId: 'https://self.example/automation/',
    });
    expect(adapter.getCurrentWorkflowId()).toBe('workflow-id');
  });

  it('rejects a page without n8n evidence', async () => {
    const adapter = new EditorRestN8nAdapter(
      environment(vi.fn<Fetcher>(), {
        url: 'https://example.com/account',
        scriptUrls: [],
      }),
    );

    await expect(adapter.detect()).rejects.toBeInstanceOf(N8nNotDetectedError);
  });

  it.each([
    ['direct', workflow],
    ['wrapped', { data: workflow }],
  ])('retrieves and validates a %s workflow response', async (_shape, body) => {
    const fetcher = vi.fn<Fetcher>(() =>
      Promise.resolve(
        Response.json(body, {
          headers: { 'x-n8n-version': '1.112.0' },
        }),
      ),
    );
    const adapter = new EditorRestN8nAdapter(environment(fetcher));

    const result = await adapter.getWorkflow('workflow-id');

    expect(result).toEqual(workflow);
    expect(result.nodes[0]?.parameters).toEqual(workflow.nodes[0]?.parameters);
    expect(result.nodes[0]?.futureNodeProperty).toEqual({
      addedBy: 'newer-n8n',
    });
    expect(result.futureWorkflowProperty).toEqual({ supported: true });
    expect(fetcher).toHaveBeenCalledWith(
      new URL('https://self.example/automation/rest/workflows/workflow-id'),
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('uses the configured REST segment and percent-encodes the workflow ID', async () => {
    const encodedWorkflow = { ...workflow, id: 'team/workflow' };
    const fetcher = vi.fn<Fetcher>(() =>
      Promise.resolve(Response.json({ data: encodedWorkflow })),
    );
    const adapter = new EditorRestN8nAdapter(
      environment(fetcher, { restEndpointContent: 'ZWRpdG9yLXJlc3Q=' }),
    );

    await adapter.getWorkflow('team/workflow');

    expect(fetcher).toHaveBeenCalledWith(
      new URL(
        'https://self.example/automation/editor-rest/workflows/team%2Fworkflow',
      ),
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it.each([
    [401, N8nAuthenticationError],
    [403, N8nAuthenticationError],
    [404, WorkflowNotFoundError],
    [500, N8nNetworkError],
  ])('maps HTTP %i to %s', async (status, ErrorType) => {
    const adapter = new EditorRestN8nAdapter(
      environment(
        vi.fn<Fetcher>(() => Promise.resolve(new Response(null, { status }))),
      ),
    );

    const operation = adapter.getWorkflow('workflow-id');

    await expect(operation).rejects.toBeInstanceOf(ErrorType);
    await expect(operation).rejects.toHaveProperty(
      'diagnostics.status',
      status,
    );
  });

  it.each([
    ['invalid JSON', new Response('<html>not JSON</html>')],
    ['unknown shape', Response.json({ data: { unexpected: true } })],
    [
      'mismatched workflow ID',
      Response.json({ ...workflow, id: 'different-id' }),
    ],
  ])(
    'rejects %s without inventing an empty workflow',
    async (_case, response) => {
      const adapter = new EditorRestN8nAdapter(
        environment(vi.fn<Fetcher>(() => Promise.resolve(response))),
      );

      await expect(adapter.getWorkflow('workflow-id')).rejects.toBeInstanceOf(
        UnsupportedN8nResponseError,
      );
    },
  );

  it('maps a fetch failure to a retryable typed network error', async () => {
    const cause = new TypeError('Failed to fetch');
    const adapter = new EditorRestN8nAdapter(
      environment(vi.fn<Fetcher>(() => Promise.reject(cause))),
    );

    await expect(adapter.getWorkflow('workflow-id')).rejects.toMatchObject({
      code: 'N8N_NETWORK',
      cause,
    });
  });

  it('reports workflow-fetch and detected-version capabilities after a healthy read', async () => {
    const adapter = new EditorRestN8nAdapter(
      environment(
        vi.fn<Fetcher>(() =>
          Promise.resolve(
            Response.json(
              { data: workflow },
              { headers: { 'x-n8n-version': '2.0.0-future' } },
            ),
          ),
        ),
      ),
    );

    await expect(adapter.healthCheck()).resolves.toEqual({
      reachable: true,
      authenticated: true,
      version: '2.0.0-future',
      capabilities: { workflowFetch: true, versionDetected: true },
    });
  });

  it('keeps workflow fetch available when the n8n version is unknown', async () => {
    const adapter = new EditorRestN8nAdapter(
      environment(
        vi.fn<Fetcher>(() => Promise.resolve(Response.json(workflow))),
      ),
    );

    await expect(adapter.healthCheck()).resolves.toEqual({
      reachable: true,
      authenticated: true,
      capabilities: { workflowFetch: true, versionDetected: false },
    });
  });

  it.each([
    [401, false],
    [403, true],
    [404, true],
  ])(
    'reports a reachable but unavailable workflow capability for HTTP %i',
    async (status, authenticated) => {
      const adapter = new EditorRestN8nAdapter(
        environment(
          vi.fn<Fetcher>(() => Promise.resolve(new Response(null, { status }))),
        ),
      );

      await expect(adapter.healthCheck()).resolves.toEqual({
        reachable: true,
        authenticated,
        capabilities: { workflowFetch: false, versionDetected: false },
      });
    },
  );

  it('reports an unreachable instance after a network failure', async () => {
    const adapter = new EditorRestN8nAdapter(
      environment(
        vi.fn<Fetcher>(() => Promise.reject(new TypeError('offline'))),
      ),
    );

    await expect(adapter.healthCheck()).resolves.toEqual({
      reachable: false,
      authenticated: false,
      capabilities: { workflowFetch: false, versionDetected: false },
    });
  });
});
