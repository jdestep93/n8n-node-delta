import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { validateWorkspaceDependencies } from './dependency-policy.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..');
const workspaceDirectories = ['packages', 'apps'];
const packages = [];

for (const workspaceDirectory of workspaceDirectories) {
  const parent = resolve(workspaceRoot, workspaceDirectory);
  const entries = await readdir(parent, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const packageJson = JSON.parse(
      await readFile(resolve(parent, entry.name, 'package.json'), 'utf8'),
    );
    packages.push({
      name: packageJson.name,
      dependencies: Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
      }),
    });
  }
}

const errors = validateWorkspaceDependencies(packages);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Dependency direction valid for ${packages.length} packages.`);
}
