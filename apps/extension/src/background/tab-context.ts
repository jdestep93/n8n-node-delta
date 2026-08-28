import { getWorkflowId } from '../content/workflow-route.js';

export interface NotWorkflowTab {
  kind: 'not-workflow';
}

export interface PermissionRequiredTab {
  kind: 'permission-required';
  hostname: string;
  origin: string;
  originPattern: string;
}

export interface WorkflowTab {
  kind: 'workflow';
  hostname: string;
  origin: string;
  workflowId: string;
  workflowName?: string;
}

export type ExtensionTabContext =
  NotWorkflowTab | PermissionRequiredTab | WorkflowTab;

export function getExactOriginPattern(tabUrl: string): string | undefined {
  try {
    const url = new URL(tabUrl);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? `${url.origin}/*`
      : undefined;
  } catch {
    return undefined;
  }
}

export function classifyTab(
  tabUrl: string | undefined,
  hasPermission: boolean,
): ExtensionTabContext {
  if (tabUrl === undefined) return { kind: 'not-workflow' };

  try {
    const url = new URL(tabUrl);
    const workflowId = getWorkflowId(url);
    const originPattern = getExactOriginPattern(tabUrl);
    if (workflowId === undefined || originPattern === undefined) {
      return { kind: 'not-workflow' };
    }
    if (!hasPermission) {
      return {
        kind: 'permission-required',
        hostname: url.host,
        origin: url.origin,
        originPattern,
      };
    }
    return {
      kind: 'workflow',
      hostname: url.host,
      origin: url.origin,
      workflowId,
    };
  } catch {
    return { kind: 'not-workflow' };
  }
}

export function isSafeActivationRequest(
  tabUrl: string,
  requestedOriginPattern: string,
): boolean {
  return getExactOriginPattern(tabUrl) === requestedOriginPattern;
}
