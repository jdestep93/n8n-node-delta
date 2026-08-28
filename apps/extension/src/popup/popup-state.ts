import type { ExtensionTabContext } from '../background/tab-context.js';

export interface PopupPresentation {
  title: string;
  detail: string;
  action?: 'Enable' | 'Open Diff';
}

interface PermissionsRequester {
  request(permissions: { origins: string[] }): Promise<boolean>;
}

export function getPopupPresentation(
  context: ExtensionTabContext,
): PopupPresentation {
  switch (context.kind) {
    case 'permission-required':
      return {
        title: `Enable NodeDelta on ${context.hostname}`,
        detail:
          'This lets NodeDelta read workflow data from your logged-in n8n session. Workflow data remains on this device.',
        action: 'Enable',
      };
    case 'workflow':
      return {
        title: `Connected to ${context.hostname}`,
        detail: `Workflow: ${context.workflowName ?? context.workflowId}`,
        action: 'Open Diff',
      };
    case 'not-workflow':
      return {
        title: 'NodeDelta works inside n8n workflows.',
        detail: 'Open an n8n workflow to begin.',
      };
  }
}

export function requestExactOriginPermission(
  originPattern: string,
  permissions: PermissionsRequester,
): Promise<boolean> {
  return permissions.request({ origins: [originPattern] });
}
