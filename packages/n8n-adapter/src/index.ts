export type {
  N8nAdapter,
  N8nAdapterCapabilities,
  N8nAdapterHealth,
  N8nInstanceInfo,
} from '@nodedelta/core';

export {
  detectN8nContext,
  type N8nContext,
  type N8nContextInput,
  type N8nRouteType,
} from './context.js';
export {
  EditorRestN8nAdapter,
  type N8nAdapterEnvironment,
} from './editor-rest-adapter.js';
