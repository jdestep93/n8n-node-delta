const allowedWorkspaceDependencies = new Map([
  ['@flowdiff/core', new Set()],
  ['@flowdiff/n8n-adapter', new Set(['@flowdiff/core'])],
  ['@flowdiff/n8n-normalizer', new Set(['@flowdiff/core'])],
  ['@flowdiff/diff-engine', new Set(['@flowdiff/core'])],
  ['@flowdiff/snapshot-store', new Set(['@flowdiff/core'])],
  ['@flowdiff/diff-ui', new Set(['@flowdiff/core', '@flowdiff/diff-engine'])],
  ['@flowdiff/test-fixtures', new Set(['@flowdiff/core'])],
  [
    '@flowdiff/extension',
    new Set([
      '@flowdiff/core',
      '@flowdiff/n8n-adapter',
      '@flowdiff/n8n-normalizer',
      '@flowdiff/diff-engine',
      '@flowdiff/snapshot-store',
      '@flowdiff/diff-ui',
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
      if (dependency.startsWith('@flowdiff/') && !allowed.has(dependency)) {
        errors.push(
          `${workspacePackage.name} must not depend on ${dependency}`,
        );
      }
    }
  }

  return errors;
}
