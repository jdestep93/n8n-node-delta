// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { observeNavigation } from './navigation-observer.js';

describe('SPA navigation observer', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    document.body.replaceChildren();
  });

  it('reports pushState, replaceState, and popstate URL changes once', () => {
    const navigated = vi.fn();
    const stop = observeNavigation(window, navigated);

    window.history.pushState({}, '', '/workflow/one');
    window.history.replaceState({}, '', '/workflow/two');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(navigated.mock.calls.map(([url]) => (url as URL).pathname)).toEqual([
      '/workflow/one',
      '/workflow/two',
    ]);
    stop();
  });

  it('uses DOM mutation as a fallback for page-world history changes', async () => {
    const pagePushState = window.history.pushState.bind(window.history);
    const navigated = vi.fn();
    const stop = observeNavigation(window, navigated);

    pagePushState({}, '', '/automation/workflow/custom');
    document.body.append(document.createElement('div'));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(navigated).toHaveBeenCalledOnce();
    expect((navigated.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/automation/workflow/custom',
    );
    stop();
  });

  it('restores history methods and removes listeners during cleanup', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalPushState = window.history.pushState;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalReplaceState = window.history.replaceState;
    const navigated = vi.fn();
    const stop = observeNavigation(window, navigated);

    stop();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(window.history.pushState).toBe(originalPushState);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(window.history.replaceState).toBe(originalReplaceState);
    window.history.pushState({}, '', '/workflow/after-cleanup');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(navigated).not.toHaveBeenCalled();
  });
});
