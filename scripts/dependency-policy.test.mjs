import { describe, expect, it } from 'vitest';

import { validateWorkspaceDependencies } from './dependency-policy.mjs';

describe('workspace dependency policy', () => {
  it('allows the documented dependency direction', () => {
    expect(
      validateWorkspaceDependencies([
        { name: '@nodedelta/core', dependencies: [] },
        { name: '@nodedelta/diff-engine', dependencies: ['@nodedelta/core'] },
        {
          name: '@nodedelta/diff-ui',
          dependencies: ['@nodedelta/core', '@nodedelta/diff-engine'],
        },
        {
          name: '@nodedelta/extension',
          dependencies: ['@nodedelta/core', '@nodedelta/diff-ui'],
        },
      ]),
    ).toEqual([]);
  });

  it('rejects core-to-application and engine-to-UI dependencies', () => {
    expect(
      validateWorkspaceDependencies([
        { name: '@nodedelta/core', dependencies: ['@nodedelta/extension'] },
        {
          name: '@nodedelta/diff-engine',
          dependencies: ['@nodedelta/diff-ui'],
        },
      ]),
    ).toEqual([
      '@nodedelta/core must not depend on @nodedelta/extension',
      '@nodedelta/diff-engine must not depend on @nodedelta/diff-ui',
    ]);
  });
});
