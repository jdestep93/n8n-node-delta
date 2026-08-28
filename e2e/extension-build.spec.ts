import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const extensionRoot = resolve(import.meta.dirname, '../dist/chrome');

interface ExtensionManifest {
  manifest_version: number;
  content_security_policy: { extension_pages: string };
  background: { service_worker: string };
  action: { default_popup: string };
  content_scripts: Array<{ js: string[] }>;
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
});
