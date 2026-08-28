import type { RawN8nWorkflow } from '@nodedelta/core';
import { useEffect, useRef, useState } from 'react';

import { getFriendlyWorkflowError } from './friendly-error.js';

export interface WorkflowLoader {
  getWorkflow(workflowId: string): Promise<RawN8nWorkflow>;
}

interface NodeDeltaAppProps {
  workflowId: string;
  loader: WorkflowLoader;
  openRequest: number;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; workflow: RawN8nWorkflow }
  | { status: 'error'; message: string };

export function NodeDeltaApp({
  workflowId,
  loader,
  openRequest,
}: NodeDeltaAppProps): React.JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [openState, setOpenState] = useState({
    manual: false,
    dismissedRequest: 0,
  });
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let current = true;
    void loader.getWorkflow(workflowId).then(
      (workflow) => {
        if (current) setLoadState({ status: 'ready', workflow });
      },
      (error: unknown) => {
        if (current) {
          setLoadState({
            status: 'error',
            message: getFriendlyWorkflowError(error),
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [loader, workflowId]);

  const open = openState.manual || openRequest > openState.dismissedRequest;

  const close = (): void => {
    setOpenState({ manual: false, dismissedRequest: openRequest });
    queueMicrotask(() => launcherRef.current?.focus());
  };

  const launcherLabel =
    loadState.status === 'loading'
      ? 'Loading…'
      : loadState.status === 'error'
        ? 'Unavailable'
        : 'Diff';

  return (
    <div className="nodedelta">
      {open ? (
        <section
          aria-label="NodeDelta workflow comparison"
          className="panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
          role="dialog"
        >
          <div className="panel-header">
            <h2>NodeDelta</h2>
            <button
              aria-label="Close NodeDelta"
              className="close"
              onClick={close}
              type="button"
            >
              Close
            </button>
          </div>
          {loadState.status === 'loading' ? (
            <p>Loading current workflow…</p>
          ) : null}
          {loadState.status === 'ready' ? (
            <p>{loadState.workflow.name}</p>
          ) : null}
          {loadState.status === 'error' ? (
            <p role="alert">{loadState.message}</p>
          ) : null}
          <p className="privacy">Workflow data remains in this browser.</p>
        </section>
      ) : null}
      <button
        aria-label={`Open NodeDelta for workflow ${workflowId}`}
        className="launcher"
        onClick={() =>
          open
            ? close()
            : setOpenState({
                manual: true,
                dismissedRequest: openState.dismissedRequest,
              })
        }
        ref={launcherRef}
        type="button"
      >
        {launcherLabel}
      </button>
    </div>
  );
}
