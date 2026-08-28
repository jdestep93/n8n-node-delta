import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { ExtensionTabContext } from '../background/tab-context.js';
import type { RuntimeResponse } from '../messages.js';
import {
  getPopupPresentation,
  requestExactOriginPermission,
} from './popup-state.js';
import './popup.css';

type PopupState =
  | { status: 'loading' }
  | { status: 'ready'; context: ExtensionTabContext }
  | { status: 'error'; message: string };

async function send(message: unknown): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message);
}

export function Popup(): React.JSX.Element {
  const [state, setState] = useState<PopupState>({ status: 'loading' });

  const loadContext = async (): Promise<void> => {
    try {
      const response = await send({ type: 'NODE_DELTA_GET_TAB_CONTEXT' });
      setState(
        response.ok && response.context !== undefined
          ? { status: 'ready', context: response.context }
          : {
              status: 'error',
              message: response.ok
                ? 'NodeDelta could not inspect this tab.'
                : response.error,
            },
      );
    } catch {
      setState({
        status: 'error',
        message: 'NodeDelta could not inspect this tab.',
      });
    }
  };

  useEffect(() => {
    let current = true;
    void send({ type: 'NODE_DELTA_GET_TAB_CONTEXT' }).then(
      (response) => {
        if (!current) return;
        setState(
          response.ok && response.context !== undefined
            ? { status: 'ready', context: response.context }
            : {
                status: 'error',
                message: response.ok
                  ? 'NodeDelta could not inspect this tab.'
                  : response.error,
              },
        );
      },
      () => {
        if (current) {
          setState({
            status: 'error',
            message: 'NodeDelta could not inspect this tab.',
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <main>
        <h1>NodeDelta for n8n</h1>
        <p>Checking this tab…</p>
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main>
        <h1>NodeDelta for n8n</h1>
        <p role="alert">{state.message}</p>
      </main>
    );
  }

  const presentation = getPopupPresentation(state.context);
  const runAction = async (): Promise<void> => {
    if (state.context.kind === 'permission-required') {
      const granted = await requestExactOriginPermission(
        state.context.originPattern,
        chrome.permissions,
      );
      if (!granted) {
        setState({
          status: 'error',
          message:
            'NodeDelta was not enabled. You can try again when you are ready.',
        });
        return;
      }
      const response = await send({
        type: 'NODE_DELTA_ACTIVATE',
        originPattern: state.context.originPattern,
      });
      if (!response.ok) {
        setState({ status: 'error', message: response.error });
        return;
      }
      await loadContext();
      return;
    }
    if (state.context.kind === 'workflow') {
      const response = await send({ type: 'NODE_DELTA_OPEN' });
      if (!response.ok) {
        setState({ status: 'error', message: response.error });
        return;
      }
      window.close();
    }
  };

  return (
    <main>
      <h1>NodeDelta for n8n</h1>
      <h2>{presentation.title}</h2>
      <p>{presentation.detail}</p>
      {presentation.action === undefined ? null : (
        <button
          onClick={() =>
            void runAction().catch(() =>
              setState({
                status: 'error',
                message: 'NodeDelta could not complete this request.',
              }),
            )
          }
          type="button"
        >
          {presentation.action}
        </button>
      )}
      <small>See exactly what changed in your n8n workflow.</small>
    </main>
  );
}

const root = document.getElementById('root');
if (root === null) throw new Error('Popup root is missing.');

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
