export const diffUiStyles = `
:host { all: initial; color-scheme: light dark; }
*, *::before, *::after { box-sizing: border-box; }
.nd-report { color: #171717; display: flex; flex-direction: column; font: 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; gap: 10px; min-height: 0; }
.nd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.nd-chip { background: #f5f5f5; border: 1px solid #d4d4d4; border-radius: 999px; font-size: 12px; padding: 2px 10px; }
.nd-chip strong { font-weight: 700; }
.nd-summary-nodesAdded { border-color: #22c55e; }
.nd-summary-nodesRemoved { border-color: #ef4444; }
.nd-summary-nodesModified, .nd-summary-nodesRenamed { border-color: #f59e0b; }
.nd-summary-nodesMoved { border-color: #3b82f6; }
.nd-summary-connectionsAdded, .nd-summary-connectionsRemoved { border-color: #a855f7; }
.nd-search { background: #fff; border: 1px solid #d4d4d4; border-radius: 8px; font: inherit; padding: 7px 10px; width: 100%; }
.nd-count { color: #737373; font-size: 12px; margin: 2px 0 0; }
.nd-list { display: flex; flex-direction: column; gap: 4px; list-style: none; margin: 0; max-height: 240px; overflow-y: auto; padding: 0; }
.nd-item { align-items: flex-start; background: transparent; border: 1px solid transparent; border-radius: 8px; cursor: pointer; display: flex; font: inherit; gap: 8px; padding: 7px 8px; text-align: left; width: 100%; }
.nd-item:hover { background: #f5f5f5; }
.nd-item-selected, .nd-item-selected:hover { background: #eef4ff; border-color: #93b4f8; }
.nd-item:focus-visible { outline: 3px solid #60a5fa; outline-offset: 1px; }
.nd-badge { background: #e5e5e5; border-radius: 999px; flex: none; font-size: 11px; font-weight: 600; padding: 2px 8px; text-transform: capitalize; }
.nd-kind-added { background: #dcfce7; color: #14532d; }
.nd-kind-removed { background: #fee2e2; color: #7f1d1d; }
.nd-kind-modified { background: #fef3c7; color: #78350f; }
.nd-kind-renamed { background: #ede9fe; color: #4c1d95; }
.nd-kind-moved { background: #dbeafe; color: #1e3a8a; }
.nd-kind-expression, .nd-kind-javascript, .nd-kind-json, .nd-kind-python, .nd-kind-sql { background: #e0f2fe; color: #0c4a6e; }
.nd-kind-text { background: #e5e5e5; color: #404040; }
.nd-item-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.nd-title { overflow-wrap: anywhere; }
.nd-item-detail { color: #737373; font-size: 12px; overflow-wrap: anywhere; }
.nd-detail-pane { border-top: 1px solid #d4d4d4; display: flex; flex-direction: column; gap: 10px; padding-top: 10px; }
.nd-inspector-section { display: flex; flex-direction: column; gap: 8px; }
.nd-inspector-heading { font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: .04em; }
.nd-values { display: flex; flex-direction: column; gap: 10px; list-style: none; margin: 0; padding: 0; }
.nd-value { display: flex; flex-direction: column; gap: 4px; }
.nd-value-head { align-items: center; display: flex; gap: 8px; justify-content: space-between; }
.nd-path { color: #525252; font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.nd-code { background: #f5f5f5; border: 1px solid #d4d4d4; border-radius: 8px; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; overflow-x: auto; overflow-wrap: anywhere; padding: 8px 10px; white-space: pre-wrap; }
.nd-line { display: inline; }
.nd-add { background: #dcfce7; }
.nd-del { background: #fee2e2; }
.nd-marker { color: #737373; user-select: none; }
.nd-gap { color: #737373; display: block; font-style: italic; padding: 2px 0; }
.nd-label { color: #737373; font-weight: 600; }
.nd-mark-add { background: #bbf7d0; border-radius: 3px; }
.nd-mark-del { background: #fecaca; border-radius: 3px; text-decoration: line-through; }
.nd-node-type { color: #525252; font-size: 12px; margin: 0; }
.nd-node-type code { background: #f5f5f5; border-radius: 6px; padding: 2px 6px; }
.nd-connection { font-weight: 600; margin: 0; overflow-wrap: anywhere; }
.nd-connection-ports { color: #737373; font-size: 12px; margin: 0; }
.nd-empty { color: #525252; margin: 0; }
@media (prefers-color-scheme: dark) {
  .nd-report { color: #fafafa; }
  .nd-chip { background: #262626; border-color: #404040; }
  .nd-search { background: #171717; border-color: #404040; color: #fafafa; }
  .nd-item:hover { background: #262626; }
  .nd-item-selected, .nd-item-selected:hover { background: #1e293b; border-color: #3b82f6; }
  .nd-item-detail, .nd-count, .nd-marker, .nd-gap { color: #a3a3a3; }
  .nd-badge { background: #262626; color: #d4d4d4; }
  .nd-kind-added { background: #14532d; color: #dcfce7; }
  .nd-kind-removed { background: #7f1d1d; color: #fee2e2; }
  .nd-kind-modified { background: #78350f; color: #fef3c7; }
  .nd-kind-renamed { background: #4c1d95; color: #ede9fe; }
  .nd-kind-moved { background: #1e3a8a; color: #dbeafe; }
  .nd-kind-expression, .nd-kind-javascript, .nd-kind-json, .nd-kind-python, .nd-kind-sql { background: #0c4a6e; color: #e0f2fe; }
  .nd-kind-text { background: #262626; color: #d4d4d4; }
  .nd-code { background: #262626; border-color: #404040; }
  .nd-add { background: #14532d; }
  .nd-del { background: #7f1d1d; }
  .nd-mark-add { background: #166534; }
  .nd-mark-del { background: #991b1b; }
  .nd-node-type code { background: #262626; }
  .nd-detail-pane { border-top-color: #404040; }
}
`;
