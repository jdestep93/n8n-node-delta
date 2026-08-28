import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const fixtureDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'fixtures',
);

const node = (id, name, type, position, parameters = {}) => ({
  id,
  name,
  type,
  typeVersion: 1,
  position,
  parameters,
});

const connection = (source, target) => ({
  [source]: {
    main: [[{ node: target, type: 'main', index: 0 }]],
  },
});

const workflow = (name, nodes, connections = {}, extra = {}) => ({
  id: `fixture-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`,
  name,
  nodes,
  connections,
  settings: { executionOrder: 'v1' },
  ...extra,
});

const trigger = node(
  'trigger-1',
  'When clicking Test workflow',
  'n8n-nodes-base.manualTrigger',
  [0, 0],
);
const request = node(
  'request-1',
  'Fetch customer',
  'n8n-nodes-base.httpRequest',
  [240, 0],
  { method: 'GET', url: 'https://example.invalid/customers/1' },
);

const fixtures = new Map();

fixtures.set(
  'simple-before.json',
  workflow(
    'Simple',
    [trigger, request],
    connection(trigger.name, request.name),
    {
      createdAt: '2025-01-01T00:00:00.000Z',
      versionId: 'version-before',
    },
  ),
);
fixtures.set(
  'simple-after.json',
  workflow(
    'Simple',
    [trigger, request],
    connection(trigger.name, request.name),
    {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
      versionId: 'version-after',
      sharedWithProjects: [{ id: 'project-after' }],
    },
  ),
);

const setNode = node('set-1', 'Prepare data', 'n8n-nodes-base.set', [480, 0], {
  assignments: { assignments: [{ id: 'field-1', name: 'ready', value: true }] },
});
fixtures.set(
  'node-added-before.json',
  workflow(
    'Node added',
    [trigger, request],
    connection(trigger.name, request.name),
  ),
);
fixtures.set(
  'node-added-after.json',
  workflow('Node added', [trigger, request, setNode], {
    ...connection(trigger.name, request.name),
    ...connection(request.name, setNode.name),
  }),
);
fixtures.set(
  'node-removed-before.json',
  workflow('Node removed', [trigger, request, setNode], {
    ...connection(trigger.name, request.name),
    ...connection(request.name, setNode.name),
  }),
);
fixtures.set(
  'node-removed-after.json',
  workflow(
    'Node removed',
    [trigger, request],
    connection(trigger.name, request.name),
  ),
);

fixtures.set(
  'node-modified-before.json',
  workflow('Node modified', [
    trigger,
    {
      ...request,
      parameters: {
        method: 'GET',
        enabled: false,
        retries: 0,
        label: '',
        expression: '={{ $json.customerId }}',
        values: ['first', { z: 3, a: 1 }],
      },
      credentials: {
        httpHeaderAuth: {
          id: 'credential-1',
          name: 'Production API',
          secret: 'must-not-be-preserved',
        },
      },
      communityField: { supported: true },
    },
  ]),
);
fixtures.set(
  'node-modified-after.json',
  workflow('Node modified', [
    trigger,
    {
      ...request,
      parameters: {
        method: 'POST',
        enabled: false,
        retries: 0,
        label: '',
        expression: '={{ $json.customerId }}',
        values: ['first', { a: 1, z: 3 }],
      },
      credentials: {
        httpHeaderAuth: {
          id: 'credential-2',
          name: 'Staging API',
          secret: 'must-not-be-preserved-either',
        },
      },
      communityField: { supported: true },
    },
  ]),
);

fixtures.set(
  'node-moved-before.json',
  workflow('Node moved', [trigger, request]),
);
fixtures.set(
  'node-moved-after.json',
  workflow('Node moved', [trigger, { ...request, position: [360, 180] }]),
);
fixtures.set(
  'node-renamed-before.json',
  workflow(
    'Node renamed',
    [trigger, request],
    connection(trigger.name, request.name),
  ),
);
fixtures.set(
  'node-renamed-after.json',
  workflow(
    'Node renamed',
    [trigger, { ...request, name: 'Load customer' }],
    connection(trigger.name, 'Load customer'),
  ),
);

const branch = node(
  'branch-1',
  'Route customer',
  'n8n-nodes-base.if',
  [480, 0],
  {
    conditions: { boolean: [{ value1: '={{ $json.active }}', value2: true }] },
  },
);
fixtures.set(
  'connections-before.json',
  workflow('Connections', [trigger, request, branch], {
    [trigger.name]: {
      main: [[{ node: request.name, type: 'main', index: 0 }]],
    },
    [request.name]: {
      main: [[{ node: branch.name, type: 'main', index: 0 }]],
      error: [[{ node: branch.name, type: 'error', index: 1 }]],
    },
  }),
);
fixtures.set(
  'connections-after.json',
  workflow('Connections', [trigger, request, branch], {
    [trigger.name]: {
      main: [[{ node: branch.name, type: 'main', index: 0 }]],
    },
    [branch.name]: {
      main: [[], [{ node: request.name, type: 'main', index: 0 }]],
    },
  }),
);

fixtures.set(
  'code-before.json',
  workflow('Code', [
    trigger,
    node('code-1', 'Transform records', 'n8n-nodes-base.code', [240, 0], {
      jsCode: 'return items;\n',
    }),
  ]),
);
fixtures.set(
  'code-after.json',
  workflow('Code', [
    trigger,
    node('code-1', 'Transform records', 'n8n-nodes-base.code', [240, 0], {
      jsCode: 'return items.filter((item) => item.json.active);\n',
    }),
  ]),
);
fixtures.set(
  'sql-before.json',
  workflow('SQL', [
    trigger,
    node('sql-1', 'Find customer', 'n8n-nodes-base.postgres', [240, 0], {
      query: 'SELECT id, name FROM customers WHERE id = $1;',
    }),
  ]),
);
fixtures.set(
  'sql-after.json',
  workflow('SQL', [
    trigger,
    node('sql-1', 'Find customer', 'n8n-nodes-base.postgres', [240, 0], {
      query: 'SELECT id, name, email FROM customers WHERE id = $1;',
    }),
  ]),
);
fixtures.set(
  'ai-prompt-before.json',
  workflow('AI prompt', [
    trigger,
    node('agent-1', 'Draft reply', '@n8n/n8n-nodes-langchain.agent', [240, 0], {
      promptType: 'define',
      text: 'Write a concise support reply for {{ $json.question }}.',
    }),
  ]),
);
fixtures.set(
  'ai-prompt-after.json',
  workflow('AI prompt', [
    trigger,
    node('agent-1', 'Draft reply', '@n8n/n8n-nodes-langchain.agent', [240, 0], {
      promptType: 'define',
      text: 'Write a warm, concise support reply for {{ $json.question }}.',
    }),
  ]),
);

const largeNodes = Array.from({ length: 300 }, (_, index) =>
  node(
    `large-${String(index + 1).padStart(3, '0')}`,
    `Large node ${String(index + 1).padStart(3, '0')}`,
    index === 0 ? 'n8n-nodes-base.manualTrigger' : 'n8n-nodes-base.set',
    [(index % 20) * 220, Math.floor(index / 20) * 140],
    index === 0
      ? {}
      : { value: index, expression: `={{ $json.values[${index}] }}` },
  ),
);
const largeConnections = Object.fromEntries(
  largeNodes.slice(0, -1).map((source, index) => [
    source.name,
    {
      main: [[{ node: largeNodes[index + 1].name, type: 'main', index: 0 }]],
    },
  ]),
);
fixtures.set(
  'large-workflow-before.json',
  workflow('Large workflow', largeNodes, largeConnections),
);
fixtures.set(
  'large-workflow-after.json',
  workflow(
    'Large workflow',
    largeNodes.map((item, index) =>
      index === 299
        ? {
            ...item,
            parameters: { value: 300, expression: '={{ $json.final }}' },
          }
        : item,
    ),
    largeConnections,
  ),
);

await mkdir(fixtureDirectory, { recursive: true });
await Promise.all(
  [...fixtures].map(async ([name, contents]) =>
    writeFile(
      join(fixtureDirectory, name),
      await format(JSON.stringify(contents), { parser: 'json' }),
    ),
  ),
);
