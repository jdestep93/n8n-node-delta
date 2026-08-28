import { describe, expect, it } from 'vitest';

import {
  classifyTab,
  getExactOriginPattern,
  isSafeActivationRequest,
} from './tab-context.js';

describe('extension tab context', () => {
  it.each([
    ['https://company.app.n8n.cloud/workflow/cloud-id', true, 'workflow'],
    ['https://n8n.example.com/workflow/root-id', false, 'permission-required'],
    ['http://localhost:5678/automation/workflow/prefixed-id', true, 'workflow'],
    ['https://n8n.example.com/automation/home/workflows', true, 'not-workflow'],
    ['chrome://extensions/', true, 'not-workflow'],
  ])('classifies %s', (url, hasPermission, expectedKind) => {
    expect(classifyTab(url, hasPermission).kind).toBe(expectedKind);
  });

  it('creates only an exact HTTP(S) origin permission pattern', () => {
    expect(
      getExactOriginPattern('https://n8n.example.com:8443/n8n/workflow/a'),
    ).toBe('https://n8n.example.com:8443/*');
    expect(getExactOriginPattern('chrome://extensions')).toBeUndefined();
  });

  it('rejects activation requests for a different origin or non-web page', () => {
    expect(
      isSafeActivationRequest(
        'https://n8n.example.com/workflow/a',
        'https://evil.example/*',
      ),
    ).toBe(false);
    expect(
      isSafeActivationRequest(
        'https://n8n.example.com/workflow/a',
        'https://n8n.example.com/*',
      ),
    ).toBe(true);
    expect(isSafeActivationRequest('file:///tmp/workflow/a', 'file:///*')).toBe(
      false,
    );
  });
});
