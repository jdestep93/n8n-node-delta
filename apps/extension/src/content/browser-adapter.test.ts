// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserWorkflowLoader } from './browser-adapter.js';

describe('same-session browser adapter bridge', () => {
  afterEach(() => {
    document.head.replaceChildren();
    window.history.replaceState({}, '', '/');
  });

  it('derives a path-prefixed REST endpoint and uses same-origin credentials', async () => {
    window.history.replaceState({}, '', '/automation/workflow/abc');
    const script = document.createElement('script');
    script.src = '/automation/static/base-path.js';
    document.head.append(script);
    const endpoint = document.createElement('meta');
    endpoint.name = 'n8n:config:rest-endpoint';
    endpoint.content = btoa('editor-api');
    document.head.append(endpoint);
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: 'abc', name: 'Prefixed', nodes: [], connections: {} },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const loader = createBrowserWorkflowLoader(window, fetch);
    await expect(loader.getWorkflow('abc')).resolves.toMatchObject({
      id: 'abc',
      name: 'Prefixed',
    });
    expect(fetch).toHaveBeenCalledWith(
      new URL('http://localhost:3000/automation/editor-api/workflows/abc'),
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });
});
