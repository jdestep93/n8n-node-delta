import { describe, expect, it } from 'vitest';

import { validateWorkspaceDependencies } from './dependency-policy.mjs';

describe('workspace dependency policy', () => {
  it('allows the documented dependency direction', () => {
    expect(
      validateWorkspaceDependencies([
        { name: '@flowdiff/core', dependencies: [] },
        { name: '@flowdiff/diff-engine', dependencies: ['@flowdiff/core'] },
        {
          name: '@flowdiff/diff-ui',
          dependencies: ['@flowdiff/core', '@flowdiff/diff-engine'],
        },
        {
          name: '@flowdiff/extension',
          dependencies: ['@flowdiff/core', '@flowdiff/diff-ui'],
        },
      ]),
    ).toEqual([]);
  });

  it('rejects core-to-application and engine-to-UI dependencies', () => {
    expect(
      validateWorkspaceDependencies([
        { name: '@flowdiff/core', dependencies: ['@flowdiff/extension'] },
        { name: '@flowdiff/diff-engine', dependencies: ['@flowdiff/diff-ui'] },
      ]),
    ).toEqual([
      '@flowdiff/core must not depend on @flowdiff/extension',
      '@flowdiff/diff-engine must not depend on @flowdiff/diff-ui',
    ]);
  });
});
