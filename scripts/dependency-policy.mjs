const allowedWorkspaceDependencies = new Map([
  ['@nodedelta/core', new Set()],
  ['@nodedelta/n8n-adapter', new Set(['@nodedelta/core'])],
  ['@nodedelta/n8n-normalizer', new Set(['@nodedelta/core'])],
  ['@nodedelta/diff-engine', new Set(['@nodedelta/core'])],
  ['@nodedelta/snapshot-store', new Set(['@nodedelta/core'])],
  [
    '@nodedelta/diff-ui',
    new Set(['@nodedelta/core', '@nodedelta/diff-engine']),
  ],
  ['@nodedelta/test-fixtures', new Set(['@nodedelta/core'])],
  [
    '@nodedelta/extension',
    new Set([
      '@nodedelta/core',
      '@nodedelta/n8n-adapter',
      '@nodedelta/n8n-normalizer',
      '@nodedelta/diff-engine',
      '@nodedelta/snapshot-store',
      '@nodedelta/diff-ui',
    ]),
  ],
]);

export function validateWorkspaceDependencies(packages) {
  const errors = [];

  for (const workspacePackage of packages) {
    const allowed = allowedWorkspaceDependencies.get(workspacePackage.name);
    if (allowed === undefined) {
      errors.push(`Unknown workspace package ${workspacePackage.name}`);
      continue;
    }

    for (const dependency of workspacePackage.dependencies) {
      if (dependency.startsWith('@nodedelta/') && !allowed.has(dependency)) {
        errors.push(
          `${workspacePackage.name} must not depend on ${dependency}`,
        );
      }
    }
  }

  return errors;
}
