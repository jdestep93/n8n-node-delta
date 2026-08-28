import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './popup.css';

export function Popup(): React.JSX.Element {
  return (
    <main>
      <h1>FlowDiff for n8n</h1>
      <p>Open an n8n workflow to start comparing local snapshots.</p>
      <small>Workflow data stays in your browser.</small>
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
