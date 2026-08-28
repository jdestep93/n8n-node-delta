import { getWorkflowId } from './workflow-route.js';

const shellHostId = 'flowdiff-extension-shell';

function mountShell(): void {
  if (document.getElementById(shellHostId) !== null) return;

  const workflowId = getWorkflowId(new URL(window.location.href));
  if (workflowId === undefined) return;

  const host = document.createElement('div');
  host.id = shellHostId;
  host.style.position = 'fixed';
  host.style.right = '20px';
  host.style.bottom = '20px';
  host.style.zIndex = '2147483647';

  const shadow = host.attachShadow({ mode: 'open' });
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.textContent = 'FlowDiff detected this workflow.';
  launcher.title = `Open FlowDiff for workflow ${workflowId}`;
  launcher.style.cssText = [
    'all: initial',
    'background: #171717',
    'border: 1px solid #404040',
    'border-radius: 999px',
    'box-shadow: 0 8px 28px rgb(0 0 0 / 25%)',
    'color: #fafafa',
    'cursor: pointer',
    'font: 600 13px/1.2 system-ui, sans-serif',
    'padding: 12px 16px',
  ].join(';');

  shadow.append(launcher);
  document.documentElement.append(host);
}

mountShell();
