import { describe, expect, it } from 'vitest';

import { detectN8nContext } from './context.js';

describe('n8n context detection', () => {
  it.each([
    ['https://cloud.example/workflow/root-id', '/', 'root-id'],
    [
      'https://self.example/automation/workflow/team%20flow/executions/7',
      '/automation/',
      'team flow',
    ],
    [
      'https://self.example/automation/workflow/flow/history/12',
      '/automation/',
      'flow',
    ],
    [
      'https://self.example/automation/workflow/flow/evaluation',
      '/automation/',
      'flow',
    ],
    [
      'https://self.example/automation/workflow/flow/debug/execution-id',
      '/automation/',
      'flow',
    ],
  ])(
    'detects workflow route %s with a stable prefix-aware identity',
    (url, basePath, workflowId) => {
      const context = detectN8nContext({
        url: new URL(url),
        basePathScriptUrls: [
          new URL('static/base-path.js', `${new URL(url).origin}${basePath}`)
            .href,
        ],
      });

      expect(context).toEqual({
        detected: true,
        origin: new URL(url).origin,
        basePath,
        restEndpoint: 'rest',
        instanceId:
          url === 'https://cloud.example/workflow/root-id'
            ? '4af8222ba3c7bb96e0175e9ad16de36cc0e62bc2f33b8962674763f9377cad6d'
            : '43fc98786e82f2a782de1765979feb4f7ecfaa143f3037299d655ebc24314a45',
        workflowId,
        routeType: 'workflow',
      });
    },
  );

  it('uses a stable SHA-256 namespace without exposing the origin or base path', () => {
    const context = detectN8nContext({
      url: new URL('https://self.example/automation/workflow/abc'),
      basePathScriptUrls: [
        'https://self.example/automation/static/base-path.js',
      ],
    });

    expect(context.instanceId).toMatch(/^[a-f0-9]{64}$/);
    expect(context.instanceId).not.toContain('self.example');
    expect(context.instanceId).not.toContain('automation');
  });

  it('uses the URL workflow prefix when the base-path marker is unavailable', () => {
    expect(
      detectN8nContext({
        url: new URL('https://self.example/team/n8n/workflow/abc'),
        basePathScriptUrls: [],
      }),
    ).toMatchObject({
      detected: true,
      basePath: '/team/n8n/',
      workflowId: 'abc',
    });
  });

  it.each([
    'https://self.example/automation/workflow/new',
    'https://self.example/automation/workflow/generated-id?new=true',
  ])('classifies %s as an unsaved workflow', (url) => {
    expect(
      detectN8nContext({
        url: new URL(url),
        basePathScriptUrls: [
          'https://self.example/automation/static/base-path.js',
        ],
      }),
    ).toMatchObject({
      detected: true,
      workflowId: undefined,
      routeType: 'new-workflow',
    });
  });

  it('reads a safe base64-encoded custom REST endpoint', () => {
    expect(
      detectN8nContext({
        url: new URL('https://self.example/automation/workflow/abc'),
        basePathScriptUrls: [
          'https://self.example/automation/static/base-path.js?v=1',
        ],
        restEndpointContent: 'Y3VzdG9tLXJlc3Q=',
      }),
    ).toMatchObject({
      basePath: '/automation/',
      restEndpoint: 'custom-rest',
    });
  });

  it.each(['not base64!', 'Li4vY3JlZGVudGlhbHM='])(
    'falls back for unsafe REST endpoint %s',
    (content) => {
      expect(
        detectN8nContext({
          url: new URL('https://self.example/workflow/abc'),
          basePathScriptUrls: ['https://self.example/static/base-path.js'],
          restEndpointContent: content,
        }).restEndpoint,
      ).toBe('rest');
    },
  );

  it('does not trust a cross-origin base-path script marker', () => {
    expect(
      detectN8nContext({
        url: new URL('https://self.example/prefix/workflow/abc'),
        basePathScriptUrls: [
          'https://attacker.example/other/static/base-path.js',
        ],
      }).basePath,
    ).toBe('/prefix/');
  });

  it('identifies an n8n non-workflow page from the base-path marker', () => {
    expect(
      detectN8nContext({
        url: new URL('https://self.example/automation/executions'),
        basePathScriptUrls: [
          'https://self.example/automation/static/base-path.js',
        ],
      }),
    ).toMatchObject({
      detected: true,
      basePath: '/automation/',
      workflowId: undefined,
      routeType: 'other',
    });
  });

  it('declines a page without an n8n route or marker', () => {
    expect(
      detectN8nContext({
        url: new URL('https://example.com/account'),
        basePathScriptUrls: [],
      }),
    ).toMatchObject({ detected: false, routeType: 'other' });
  });
});
