/* eslint-disable react-refresh/only-export-components */
import { createRoot, type Root } from 'react-dom/client';
import { SemanticWorkflowDiffer } from '@nodedelta/diff-engine';
import { N8nWorkflowNormalizer } from '@nodedelta/n8n-normalizer';
import { StorageUnavailableError } from '@nodedelta/core';

import { observeNavigation } from './navigation-observer.js';
import { NodeDeltaApp, type WorkflowLoader } from './node-delta-app.js';
import {
  defaultPreferences,
  type PreferenceRepository,
  type WorkspaceServices,
} from './workspace-store.js';
import { contentStyles } from './styles.js';
import { getWorkflowId } from './workflow-route.js';

export { type WorkflowLoader } from './node-delta-app.js';

export const NODE_DELTA_HOST_ID = 'nodedelta-extension-shell';

interface ContentRuntimeOptions {
  targetWindow: Window;
  loader?: WorkflowLoader;
  services?: WorkspaceServices;
  preferences?: PreferenceRepository;
}

interface MountedShell {
  host: HTMLElement;
  root: Root;
}

function createShell(targetDocument: Document): MountedShell {
  const host = targetDocument.createElement('div');
  host.id = NODE_DELTA_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = targetDocument.createElement('style');
  style.textContent = contentStyles;
  const appRoot = targetDocument.createElement('div');
  appRoot.id = 'nodedelta-root';
  shadow.append(style, appRoot);
  targetDocument.documentElement.append(host);
  return { host, root: createRoot(appRoot) };
}

export function startNodeDeltaContent({
  targetWindow,
  loader,
  services,
  preferences,
}: ContentRuntimeOptions): () => void {
  const workspaceServices =
    services ?? createLoaderWorkspaceServices(targetWindow, loader);
  const preferenceRepository = preferences ?? {
    load: defaultPreferences,
    save: () => undefined,
  };
  let mounted: MountedShell | undefined;
  let workflowId: string | undefined;
  let openRequest = 0;
  let stopped = false;

  const unmount = (): void => {
    mounted?.root.unmount();
    mounted?.host.remove();
    mounted = undefined;
    workflowId = undefined;
  };

  const render = (): void => {
    if (mounted === undefined || workflowId === undefined) return;
    mounted.root.render(
      <NodeDeltaApp
        key={workflowId}
        openRequest={openRequest}
        preferences={preferenceRepository}
        services={workspaceServices}
        workflowId={workflowId}
      />,
    );
  };

  const reconcile = (url = new URL(targetWindow.location.href)): void => {
    if (stopped) return;
    const nextWorkflowId = getWorkflowId(url);
    if (nextWorkflowId === undefined) {
      unmount();
      return;
    }

    if (mounted !== undefined && !mounted.host.isConnected) {
      mounted.root.unmount();
      mounted = undefined;
      workflowId = undefined;
    }
    mounted ??= createShell(targetWindow.document);
    if (workflowId === nextWorkflowId) return;
    workflowId = nextWorkflowId;
    openRequest = 0;
    render();
  };

  const openPanel = (): void => {
    if (workflowId === undefined) return;
    openRequest += 1;
    render();
  };

  reconcile();
  targetWindow.addEventListener('nodedelta:open', openPanel);
  const stopObserving = observeNavigation(targetWindow, reconcile, () =>
    reconcile(),
  );

  return (): void => {
    if (stopped) return;
    stopped = true;
    stopObserving();
    targetWindow.removeEventListener('nodedelta:open', openPanel);
    unmount();
  };
}

function createLoaderWorkspaceServices(
  targetWindow: Window,
  loader: WorkflowLoader | undefined,
): WorkspaceServices {
  if (loader === undefined) {
    throw new Error('NodeDelta content requires workspace services.');
  }
  const normalizer = new N8nWorkflowNormalizer();
  const differ = new SemanticWorkflowDiffer();
  return {
    getInstanceId: () => Promise.resolve(targetWindow.location.origin),
    loadCurrent: async (workflowId) =>
      normalizer.normalize(await loader.getWorkflow(workflowId)),
    listSnapshots: () => Promise.resolve([]),
    saveSnapshot: () => Promise.reject(new StorageUnavailableError()),
    renameSnapshot: () => Promise.reject(new StorageUnavailableError()),
    deleteSnapshot: () => Promise.reject(new StorageUnavailableError()),
    diff: (before, after) => differ.diff(before, after),
  };
}
