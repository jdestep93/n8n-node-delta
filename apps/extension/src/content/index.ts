import type { ContentRequest, ContentStatus } from '../messages.js';
import { startNodeDeltaContent } from './runtime.js';
import {
  createBrowserWorkspaceServices,
  createLocalStoragePreferenceRepository,
} from './workspace-services.js';
import { getWorkflowId } from './workflow-route.js';

const runtimeWindow = window as Window & {
  __nodeDeltaContentStop__?: () => void;
  __nodeDeltaMessageListenerInstalled__?: boolean;
};

if (runtimeWindow.__nodeDeltaContentStop__ === undefined) {
  const workflowNames = new Map<string, string>();
  const baseServices = createBrowserWorkspaceServices(window);
  const services = {
    ...baseServices,
    loadCurrent: async (workflowId: string) => {
      const workflow = await baseServices.loadCurrent(workflowId);
      workflowNames.set(workflowId, workflow.name);
      return workflow;
    },
  };
  runtimeWindow.__nodeDeltaContentStop__ = startNodeDeltaContent({
    targetWindow: window,
    services,
    preferences: createLocalStoragePreferenceRepository(window.localStorage),
  });

  if (runtimeWindow.__nodeDeltaMessageListenerInstalled__ !== true) {
    chrome.runtime.onMessage.addListener(
      (message: unknown, _sender, sendResponse) => {
        if (
          typeof message !== 'object' ||
          message === null ||
          !('type' in message)
        ) {
          return false;
        }
        const request = message as ContentRequest;
        if (request.type === 'NODE_DELTA_OPEN_PANEL') {
          window.dispatchEvent(new Event('nodedelta:open'));
          sendResponse({ ok: true });
          return false;
        }
        if (request.type === 'NODE_DELTA_GET_CONTENT_STATUS') {
          const workflowId = getWorkflowId(new URL(window.location.href));
          sendResponse({
            workflowId,
            workflowName:
              workflowId === undefined
                ? undefined
                : workflowNames.get(workflowId),
          } satisfies ContentStatus);
          return false;
        }
        return false;
      },
    );
    runtimeWindow.__nodeDeltaMessageListenerInstalled__ = true;
  }
}
