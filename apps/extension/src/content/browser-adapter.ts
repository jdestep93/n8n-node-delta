import { EditorRestN8nAdapter } from '@nodedelta/n8n-adapter';

type Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function createBrowserWorkflowLoader(
  targetWindow: Window,
  fetchImplementation: Fetch = targetWindow.fetch.bind(targetWindow),
): EditorRestN8nAdapter {
  return new EditorRestN8nAdapter({
    currentUrl: () => new URL(targetWindow.location.href),
    basePathScriptUrls: () =>
      Array.from(targetWindow.document.scripts, (script) => script.src).filter(
        (src) => src !== '',
      ),
    restEndpointContent: () =>
      targetWindow.document
        .querySelector<HTMLMetaElement>('meta[name="n8n:config:rest-endpoint"]')
        ?.getAttribute('content') ?? undefined,
    fetch: fetchImplementation,
  });
}
