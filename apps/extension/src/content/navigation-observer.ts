export type NavigationListener = (url: URL) => void;

export function observeNavigation(
  targetWindow: Window,
  listener: NavigationListener,
  onDocumentMutation?: () => void,
): () => void {
  const history = targetWindow.history;
  // Preserve the exact methods so cleanup composes with other observers.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalPushState = history.pushState;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalReplaceState = history.replaceState;
  let lastHref = targetWindow.location.href;
  let stopped = false;

  const reportIfChanged = (): void => {
    if (stopped || targetWindow.location.href === lastHref) return;
    lastHref = targetWindow.location.href;
    listener(new URL(lastHref));
  };

  history.pushState = function pushState(
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ): void {
    originalPushState.call(history, data, unused, url);
    reportIfChanged();
  };
  history.replaceState = function replaceState(
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ): void {
    originalReplaceState.call(history, data, unused, url);
    reportIfChanged();
  };

  targetWindow.addEventListener('popstate', reportIfChanged);
  const MutationObserverConstructor = (
    targetWindow as Window & { MutationObserver: typeof MutationObserver }
  ).MutationObserver;
  const mutationObserver = new MutationObserverConstructor(() => {
    const previousHref = lastHref;
    reportIfChanged();
    if (targetWindow.location.href === previousHref) onDocumentMutation?.();
  });
  mutationObserver.observe(targetWindow.document.documentElement, {
    childList: true,
    subtree: true,
  });

  return (): void => {
    if (stopped) return;
    stopped = true;
    mutationObserver.disconnect();
    targetWindow.removeEventListener('popstate', reportIfChanged);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
}
