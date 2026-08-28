import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const extensionRoot = resolve(import.meta.dirname, '../dist/chrome');

interface ExtensionManifest {
  manifest_version: number;
  content_security_policy: { extension_pages: string };
  background: { service_worker: string };
  action: { default_popup: string };
  content_scripts: Array<{ js: string[]; matches: string[] }>;
  host_permissions?: string[];
  optional_host_permissions?: string[];
  permissions: string[];
}

test('builds a loadable local-only Manifest V3 extension shell', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(extensionRoot, 'manifest.json'), 'utf8'),
  ) as ExtensionManifest;

  expect(manifest.manifest_version).toBe(3);
  expect(manifest.content_security_policy.extension_pages).toBe(
    "script-src 'self'; object-src 'self'",
  );
  expect(manifest.content_security_policy.extension_pages).not.toContain(
    'unsafe-eval',
  );
  expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage']);
  expect(manifest.host_permissions).not.toContain('<all_urls>');
  expect(manifest.optional_host_permissions).toHaveLength(2);
  expect(manifest.optional_host_permissions).toEqual(
    expect.arrayContaining(['https://*/*', 'http://*/*']),
  );
  expect(manifest.content_scripts.at(0)?.matches).toEqual([
    'https://*.app.n8n.cloud/*',
  ]);
  const contentScript = manifest.content_scripts.at(0)?.js.at(0);
  expect(contentScript).toBeDefined();
  if (contentScript === undefined)
    throw new Error('Content script is missing.');

  await expect(
    stat(resolve(extensionRoot, manifest.background.service_worker)),
  ).resolves.toBeDefined();
  await expect(
    stat(resolve(extensionRoot, manifest.action.default_popup)),
  ).resolves.toBeDefined();
  await expect(
    stat(resolve(extensionRoot, contentScript)),
  ).resolves.toBeDefined();

  const contentSource = await readFile(
    resolve(extensionRoot, contentScript),
    'utf8',
  );
  expect(contentSource).not.toMatch(/^\s*import\s/mu);
  expect(contentSource).not.toContain('eval(');
  expect(contentSource).not.toContain('new Function(');
  expect(contentSource).not.toContain('process.env');
});

for (const scenario of [
  {
    name: 'n8n Cloud root',
    pageUrl: 'https://company.app.n8n.cloud/workflow/cloud-id',
    basePath: '/',
    workflowId: 'cloud-id',
  },
  {
    name: 'custom root',
    pageUrl: 'https://n8n.example.test/workflow/root-id',
    basePath: '/',
    workflowId: 'root-id',
  },
  {
    name: 'self-hosted path prefix',
    pageUrl: 'http://localhost:5678/automation/workflow/prefix-id',
    basePath: '/automation/',
    workflowId: 'prefix-id',
  },
]) {
  test(`runs the built content script on ${scenario.name}`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, 'chrome', {
        configurable: true,
        value: {
          runtime: { onMessage: { addListener: () => undefined } },
        },
      });
    });
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (route.request().resourceType() === 'document') {
        await route.fulfill({
          contentType: 'text/html',
          headers: {
            'content-security-policy': "script-src 'self'; object-src 'none'",
          },
          body: `<!doctype html><html><head><style>button { background: red !important; }</style><script src="${scenario.basePath}static/base-path.js"></script></head><body><button id="n8n-button">n8n</button><script src="/assets/content.js"></script></body></html>`,
        });
        return;
      }
      if (requestUrl.pathname === '/assets/content.js') {
        await route.fulfill({
          contentType: 'text/javascript',
          path: resolve(extensionRoot, 'assets/content.js'),
        });
        return;
      }
      if (requestUrl.pathname.endsWith('/static/base-path.js')) {
        await route.fulfill({ contentType: 'text/javascript', body: '' });
        return;
      }
      if (
        requestUrl.pathname.endsWith(`/rest/workflows/${scenario.workflowId}`)
      ) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: scenario.workflowId,
              name: `${scenario.name} workflow`,
              nodes: [],
              connections: {},
            },
          }),
        });
        return;
      }
      await route.abort();
    });
    await page.goto(scenario.pageUrl);
    expect(pageErrors).toEqual([]);

    const host = page.locator('#nodedelta-extension-shell');
    await expect(host.locator('button')).toHaveText('Diff');
    await expect(host.locator('button')).toHaveCSS(
      'background-color',
      'rgb(23, 23, 23)',
    );
    await expect(page.locator('#n8n-button')).toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    );
    await host.locator('button').click();
    await expect(host.locator('[role="dialog"]')).toContainText(
      `${scenario.name} workflow`,
    );

    await page.evaluate(() => history.pushState({}, '', '/home/workflows'));
    await expect(host).toHaveCount(0);
  });
}
