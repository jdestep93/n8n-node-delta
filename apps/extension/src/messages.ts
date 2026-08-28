import type { ExtensionTabContext } from './background/tab-context.js';

export type RuntimeRequest =
  | { type: 'NODE_DELTA_GET_TAB_CONTEXT' }
  | { type: 'NODE_DELTA_ACTIVATE'; originPattern: string }
  | { type: 'NODE_DELTA_OPEN' };

export type RuntimeResponse =
  { ok: true; context?: ExtensionTabContext } | { ok: false; error: string };

export type ContentRequest =
  { type: 'NODE_DELTA_GET_CONTENT_STATUS' } | { type: 'NODE_DELTA_OPEN_PANEL' };

export interface ContentStatus {
  workflowId: string | undefined;
  workflowName: string | undefined;
}
