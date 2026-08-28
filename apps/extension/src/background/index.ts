import type {
  ContentStatus,
  RuntimeRequest,
  RuntimeResponse,
} from '../messages.js';
import {
  classifyTab,
  getExactOriginPattern,
  isSafeActivationRequest,
  type ExtensionTabContext,
} from './tab-context.js';

const CONTENT_SCRIPT = 'assets/content.js';

function isRuntimeRequest(message: unknown): message is RuntimeRequest {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false;
  }
  const type = message.type;
  if (type === 'NODE_DELTA_GET_TAB_CONTEXT' || type === 'NODE_DELTA_OPEN') {
    return true;
  }
  return (
    type === 'NODE_DELTA_ACTIVATE' &&
    'originPattern' in message &&
    typeof message.originPattern === 'string'
  );
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function permissionFor(tabUrl: string | undefined): Promise<boolean> {
  if (tabUrl === undefined) return false;
  const originPattern = getExactOriginPattern(tabUrl);
  return originPattern === undefined
    ? false
    : chrome.permissions.contains({ origins: [originPattern] });
}

function isContentStatus(value: unknown): value is ContentStatus {
  return (
    typeof value === 'object' &&
    value !== null &&
    'workflowId' in value &&
    (value.workflowId === undefined || typeof value.workflowId === 'string') &&
    'workflowName' in value &&
    (value.workflowName === undefined || typeof value.workflowName === 'string')
  );
}

async function currentTabContext(): Promise<ExtensionTabContext> {
  const tab = await getActiveTab();
  const context = classifyTab(tab?.url, await permissionFor(tab?.url));
  if (context.kind !== 'workflow' || tab?.id === undefined) return context;
  try {
    const status: unknown = await chrome.tabs.sendMessage(tab.id, {
      type: 'NODE_DELTA_GET_CONTENT_STATUS',
    });
    return isContentStatus(status) && status.workflowName !== undefined
      ? { ...context, workflowName: status.workflowName }
      : context;
  } catch {
    return context;
  }
}

function registrationId(originPattern: string): string {
  let hash = 2166136261;
  for (const character of originPattern) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `nodedelta-${(hash >>> 0).toString(16)}`;
}

async function activateCurrentTab(originPattern: string): Promise<void> {
  const tab = await getActiveTab();
  if (
    tab?.id === undefined ||
    tab.url === undefined ||
    !isSafeActivationRequest(tab.url, originPattern) ||
    !(await chrome.permissions.contains({ origins: [originPattern] }))
  ) {
    throw new Error('The requested n8n origin does not match the active tab.');
  }

  const id = registrationId(originPattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [id],
  });
  const registration: chrome.scripting.RegisteredContentScript = {
    id,
    matches: [originPattern],
    js: [CONTENT_SCRIPT],
    allFrames: false,
    persistAcrossSessions: true,
    runAt: 'document_idle',
    world: 'ISOLATED',
  };
  if (existing.length === 0) {
    await chrome.scripting.registerContentScripts([registration]);
  } else {
    await chrome.scripting.updateContentScripts([registration]);
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: false },
    files: [CONTENT_SCRIPT],
    world: 'ISOLATED',
  });
}

async function openCurrentTab(): Promise<void> {
  const tab = await getActiveTab();
  if (tab?.id === undefined)
    throw new Error('No active browser tab was found.');
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'NODE_DELTA_OPEN_PANEL' });
  } catch {
    throw new Error('Reload the n8n workflow page, then open NodeDelta again.');
  }
}

async function handleRequest(
  request: RuntimeRequest,
): Promise<RuntimeResponse> {
  switch (request.type) {
    case 'NODE_DELTA_GET_TAB_CONTEXT':
      return { ok: true, context: await currentTabContext() };
    case 'NODE_DELTA_ACTIVATE':
      await activateCurrentTab(request.originPattern);
      return { ok: true, context: await currentTabContext() };
    case 'NODE_DELTA_OPEN':
      await openCurrentTab();
      return { ok: true };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({ nodeDeltaInstalled: true });
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRuntimeRequest(message)) return false;
    void handleRequest(message).then(sendResponse, (error: unknown) =>
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'NodeDelta could not complete this request.',
      } satisfies RuntimeResponse),
    );
    return true;
  },
);
