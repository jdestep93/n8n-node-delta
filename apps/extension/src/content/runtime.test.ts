// @vitest-environment jsdom

import type { RawN8nWorkflow } from '@nodedelta/core';
import { N8nAuthenticationError } from '@nodedelta/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NODE_DELTA_HOST_ID,
  startNodeDeltaContent,
  type WorkflowLoader,
} from './runtime.js';

function workflow(id: string, name = `Workflow ${id}`): RawN8nWorkflow {
  return { id, name, nodes: [], connections: {} };
}

async function eventually(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

function shell(): ShadowRoot | undefined {
  return document.getElementById(NODE_DELTA_HOST_ID)?.shadowRoot ?? undefined;
}

describe('NodeDelta content lifecycle', () => {
  const stops: Array<() => void> = [];

  function start(
    options: Parameters<typeof startNodeDeltaContent>[0],
  ): () => void {
    const stop = startNodeDeltaContent(options);
    stops.push(stop);
    return stop;
  }

  beforeEach(() => {
    window.history.replaceState({}, '', '/home/workflows');
    document.documentElement.replaceChildren(
      document.createElement('head'),
      document.createElement('body'),
    );
  });

  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    for (const host of document.querySelectorAll(`#${NODE_DELTA_HOST_ID}`)) {
      host.remove();
    }
  });

  it('appears only on workflows and follows SPA route changes without reload', async () => {
    const loader: WorkflowLoader = {
      getWorkflow: vi.fn((id: string) => Promise.resolve(workflow(id))),
    };
    const stop = start({ targetWindow: window, loader });

    expect(shell()).toBeUndefined();
    window.history.pushState({}, '', '/automation/workflow/one');
    await eventually(() =>
      expect(shell()?.querySelector('button')?.textContent).toBe('Diff'),
    );

    shell()?.querySelector('button')?.click();
    await eventually(() =>
      expect(shell()?.querySelector('[role="dialog"]')?.textContent).toContain(
        'Workflow one',
      ),
    );

    window.history.replaceState({}, '', '/automation/workflow/two/history');
    await eventually(() =>
      expect(shell()?.querySelector('button')?.getAttribute('aria-label')).toBe(
        'Open NodeDelta for workflow two',
      ),
    );
    expect(shell()?.querySelector('[role="dialog"]')).toBeNull();

    window.history.pushState({}, '', '/automation/home/workflows');
    expect(shell()).toBeUndefined();
    stop();
  });

  it('mounts React in an open shadow root and keeps styles inside it', async () => {
    window.history.replaceState({}, '', '/workflow/isolated');
    const stop = start({
      targetWindow: window,
      loader: { getWorkflow: (id) => Promise.resolve(workflow(id)) },
    });

    await eventually(() => expect(shell()).toBeDefined());
    expect(document.querySelector('style')).toBeNull();
    expect(shell()?.querySelector('style')?.textContent).toContain(
      ':host { all: initial;',
    );
    expect(shell()?.mode).toBe('open');
    stop();
  });

  it('discards a stale workflow response after switching workflows', async () => {
    let resolveFirst: ((value: RawN8nWorkflow) => void) | undefined;
    const first = new Promise<RawN8nWorkflow>((resolve) => {
      resolveFirst = resolve;
    });
    const loader: WorkflowLoader = {
      getWorkflow: vi.fn((id: string) =>
        id === 'one' ? first : Promise.resolve(workflow(id)),
      ),
    };
    window.history.replaceState({}, '', '/workflow/one');
    const stop = start({ targetWindow: window, loader });

    window.history.pushState({}, '', '/workflow/two');
    await eventually(() =>
      expect(shell()?.querySelector('button')?.textContent).toBe('Diff'),
    );
    shell()?.querySelector('button')?.click();
    await eventually(() =>
      expect(shell()?.textContent).toContain('Workflow two'),
    );
    resolveFirst?.(workflow('one'));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(shell()?.textContent).not.toContain('Workflow one');
    stop();
  });

  it('shows a friendly unavailable state for adapter failures', async () => {
    window.history.replaceState({}, '', '/workflow/private');
    const stop = start({
      targetWindow: window,
      loader: {
        getWorkflow: () =>
          Promise.reject(
            new N8nAuthenticationError({ diagnostics: { status: 403 } }),
          ),
      },
    });

    await eventually(() =>
      expect(shell()?.querySelector('button')?.textContent).toBe('Unavailable'),
    );
    shell()?.querySelector('button')?.click();
    await eventually(() =>
      expect(shell()?.textContent).toContain(
        "You don't have access to read this workflow in n8n.",
      ),
    );
    stop();
  });

  it('remounts once if an n8n rerender removes its host', async () => {
    window.history.replaceState({}, '', '/workflow/resilient');
    const stop = start({
      targetWindow: window,
      loader: { getWorkflow: (id) => Promise.resolve(workflow(id)) },
    });
    await eventually(() => expect(shell()).toBeDefined());

    document.getElementById(NODE_DELTA_HOST_ID)?.remove();
    await eventually(() => expect(shell()).toBeDefined());
    expect(document.querySelectorAll(`#${NODE_DELTA_HOST_ID}`)).toHaveLength(1);
    stop();
  });

  it('opens the current workflow panel when the toolbar popup requests it', async () => {
    window.history.replaceState({}, '', '/workflow/from-popup');
    const stop = start({
      targetWindow: window,
      loader: { getWorkflow: (id) => Promise.resolve(workflow(id)) },
    });
    await eventually(() =>
      expect(shell()?.querySelector('button')?.textContent).toBe('Diff'),
    );

    window.dispatchEvent(new Event('nodedelta:open'));

    await eventually(() =>
      expect(shell()?.querySelector('[role="dialog"]')).not.toBeNull(),
    );
    stop();
  });
});
