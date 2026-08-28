import { describe, expect, it, vi } from 'vitest';

import {
  getPopupPresentation,
  requestExactOriginPermission,
} from './popup-state.js';

describe('toolbar popup states', () => {
  it('explains why permission is needed on a candidate n8n origin', () => {
    expect(
      getPopupPresentation({
        kind: 'permission-required',
        hostname: 'n8n.example.com',
        origin: 'https://n8n.example.com',
        originPattern: 'https://n8n.example.com/*',
      }),
    ).toEqual({
      title: 'Enable NodeDelta on n8n.example.com',
      detail:
        'This lets NodeDelta read workflow data from your logged-in n8n session. Workflow data remains on this device.',
      action: 'Enable',
    });
  });

  it('shows the connected workflow without duplicating the diff UI', () => {
    expect(
      getPopupPresentation({
        kind: 'workflow',
        hostname: 'company.app.n8n.cloud',
        origin: 'https://company.app.n8n.cloud',
        workflowId: 'abc',
        workflowName: 'Customer Support',
      }),
    ).toEqual({
      title: 'Connected to company.app.n8n.cloud',
      detail: 'Workflow: Customer Support',
      action: 'Open Diff',
    });
  });

  it('shows a neutral message away from n8n workflows', () => {
    expect(getPopupPresentation({ kind: 'not-workflow' })).toEqual({
      title: 'NodeDelta works inside n8n workflows.',
      detail: 'Open an n8n workflow to begin.',
    });
  });

  it('requests only the exact origin through the permissions API', async () => {
    const request = vi.fn().mockResolvedValue(true);

    await expect(
      requestExactOriginPermission('https://n8n.example.com/*', { request }),
    ).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({
      origins: ['https://n8n.example.com/*'],
    });
  });
});
