import { diffUiStyles } from '@nodedelta/diff-ui';

export const contentStyles = `
:host { all: initial; color-scheme: light dark; }
*, *::before, *::after { box-sizing: border-box; }
.nodedelta {
  --nd-bg: #ffffff; --nd-raised: #f5f5f5; --nd-border: #d4d4d4;
  --nd-text: #171717; --nd-muted: #525252; --nd-accent: #2563eb;
  color: var(--nd-text); font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.nodedelta.theme-dark { --nd-bg: #171717; --nd-raised: #262626; --nd-border: #404040; --nd-text: #fafafa; --nd-muted: #d4d4d4; --nd-accent: #60a5fa; color-scheme: dark; }
.launcher { all: unset; background: #171717; border: 1px solid #404040; border-radius: 999px; box-shadow: 0 8px 28px rgb(0 0 0 / 25%); color: #fafafa; cursor: pointer; font: 600 13px/1.2 system-ui, sans-serif; padding: 12px 16px; position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; }
button, select, input { font: inherit; }
button { cursor: pointer; }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid #60a5fa; outline-offset: 2px; }
.panel { background: var(--nd-bg); border: 1px solid var(--nd-border); box-shadow: -12px 0 48px rgb(0 0 0 / 24%); color: var(--nd-text); display: flex; flex-direction: column; height: 100vh; padding: 0; position: fixed; right: 0; top: 0; width: 80vw; z-index: 2147483000; }
.panel-header { align-items: center; border-bottom: 1px solid var(--nd-border); display: flex; gap: 12px; justify-content: space-between; padding: 16px 20px; }
.panel h2 { font: 700 18px/1.2 system-ui, sans-serif; margin: 0; }
.workflow-name { color: var(--nd-muted); margin: 4px 0 0; }
.close { background: transparent; border: 0; border-radius: 6px; color: var(--nd-muted); font-weight: 600; padding: 8px; }
.tabs { border-bottom: 1px solid var(--nd-border); display: flex; gap: 4px; padding: 8px 20px; }
.tabs button, .filters button, .snapshot-actions button, .refresh-row button { background: transparent; border: 1px solid var(--nd-border); border-radius: 7px; color: var(--nd-text); padding: 6px 10px; }
.tabs button[aria-current="page"], .filters button[aria-pressed="true"] { background: var(--nd-raised); border-color: var(--nd-accent); }
.panel-body { flex: 1; min-height: 0; overflow: auto; padding: 20px; }
.compare-view, .settings-view { display: flex; flex-direction: column; gap: 16px; }
.selectors { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
label { color: var(--nd-muted); display: flex; flex-direction: column; font-size: 12px; font-weight: 600; gap: 5px; }
select, input[type="search"] { background: var(--nd-bg); border: 1px solid var(--nd-border); border-radius: 8px; color: var(--nd-text); padding: 8px 10px; }
.refresh-row { align-items: center; color: var(--nd-muted); display: flex; flex-wrap: wrap; font-size: 12px; gap: 8px; }
.refresh-row span { margin-right: auto; }
.filters { display: flex; flex-wrap: wrap; gap: 6px; }
.empty-state { margin: 10vh auto; max-width: 430px; text-align: center; }
.empty-state h3 { margin: 0 0 8px; }
.primary { background: var(--nd-accent); border: 0; border-radius: 8px; color: #fff; font-weight: 700; padding: 9px 14px; }
.privacy { color: var(--nd-muted); font-size: 12px; }
.notice { background: var(--nd-raised); border: 1px solid var(--nd-border); border-radius: 8px; padding: 8px 10px; }
.snapshot-list { display: flex; flex-direction: column; gap: 8px; list-style: none; margin: 0; padding: 0; }
.snapshot-list li { align-items: center; border: 1px solid var(--nd-border); border-radius: 9px; display: flex; gap: 12px; justify-content: space-between; padding: 12px; }
.snapshot-list li > div:first-child { display: flex; flex-direction: column; }
.snapshot-list span { color: var(--nd-muted); font-size: 12px; }
.snapshot-actions { display: flex; gap: 6px; }
.settings-view { max-width: 520px; }
.checkbox-row { align-items: center; flex-direction: row; }
@media (prefers-color-scheme: dark) {
  .nodedelta.theme-auto { --nd-bg: #171717; --nd-raised: #262626; --nd-border: #404040; --nd-text: #fafafa; --nd-muted: #d4d4d4; --nd-accent: #60a5fa; color-scheme: dark; }
}
@media (max-width: 800px) {
  .panel { width: min(100vw, 100%); }
  .selectors { grid-template-columns: 1fr; }
  .snapshot-list li { align-items: stretch; flex-direction: column; }
}
${diffUiStyles}
.nodedelta.theme-light .nd-report { color: #171717; }
.nodedelta.theme-light .nd-chip, .nodedelta.theme-light .nd-code, .nodedelta.theme-light .nd-node-type code { background: #f5f5f5; border-color: #d4d4d4; }
.nodedelta.theme-light .nd-search { background: #fff; border-color: #d4d4d4; color: #171717; }
.nodedelta.theme-light .nd-item-selected { background: #eef4ff; border-color: #93b4f8; }
.nodedelta.theme-light .nd-item-detail, .nodedelta.theme-light .nd-count, .nodedelta.theme-light .nd-marker, .nodedelta.theme-light .nd-gap { color: #737373; }
.nodedelta.theme-light .nd-badge { background: #e5e5e5; color: #171717; }
.nodedelta.theme-light .nd-kind-added { background: #dcfce7; color: #14532d; }
.nodedelta.theme-light .nd-kind-removed { background: #fee2e2; color: #7f1d1d; }
.nodedelta.theme-light .nd-kind-modified { background: #fef3c7; color: #78350f; }
.nodedelta.theme-light .nd-kind-renamed { background: #ede9fe; color: #4c1d95; }
.nodedelta.theme-light .nd-kind-moved { background: #dbeafe; color: #1e3a8a; }
.nodedelta.theme-light .nd-kind-expression, .nodedelta.theme-light .nd-kind-javascript, .nodedelta.theme-light .nd-kind-json, .nodedelta.theme-light .nd-kind-python, .nodedelta.theme-light .nd-kind-sql { background: #e0f2fe; color: #0c4a6e; }
.nodedelta.theme-light .nd-kind-text { background: #e5e5e5; color: #404040; }
.nodedelta.theme-light .nd-add { background: #dcfce7; }
.nodedelta.theme-light .nd-del { background: #fee2e2; }
.nodedelta.theme-light .nd-mark-add { background: #bbf7d0; }
.nodedelta.theme-light .nd-mark-del { background: #fecaca; }
.nodedelta.theme-light .nd-detail-pane { border-top-color: #d4d4d4; }
.nodedelta.theme-dark .nd-report { color: #fafafa; }
.nodedelta.theme-dark .nd-chip, .nodedelta.theme-dark .nd-code, .nodedelta.theme-dark .nd-node-type code { background: #262626; border-color: #404040; }
.nodedelta.theme-dark .nd-search { background: #171717; border-color: #404040; color: #fafafa; }
.nodedelta.theme-dark .nd-item:hover { background: #262626; }
.nodedelta.theme-dark .nd-item-selected { background: #1e293b; border-color: #3b82f6; }
.nodedelta.theme-dark .nd-item-detail, .nodedelta.theme-dark .nd-count, .nodedelta.theme-dark .nd-marker, .nodedelta.theme-dark .nd-gap { color: #a3a3a3; }
.nodedelta.theme-dark .nd-badge { background: #262626; color: #d4d4d4; }
.nodedelta.theme-dark .nd-kind-added { background: #14532d; color: #dcfce7; }
.nodedelta.theme-dark .nd-kind-removed { background: #7f1d1d; color: #fee2e2; }
.nodedelta.theme-dark .nd-kind-modified { background: #78350f; color: #fef3c7; }
.nodedelta.theme-dark .nd-kind-renamed { background: #4c1d95; color: #ede9fe; }
.nodedelta.theme-dark .nd-kind-moved { background: #1e3a8a; color: #dbeafe; }
.nodedelta.theme-dark .nd-kind-expression, .nodedelta.theme-dark .nd-kind-javascript, .nodedelta.theme-dark .nd-kind-json, .nodedelta.theme-dark .nd-kind-python, .nodedelta.theme-dark .nd-kind-sql { background: #0c4a6e; color: #e0f2fe; }
.nodedelta.theme-dark .nd-kind-text { background: #262626; color: #d4d4d4; }
.nodedelta.theme-dark .nd-add { background: #14532d; }
.nodedelta.theme-dark .nd-del { background: #7f1d1d; }
.nodedelta.theme-dark .nd-mark-add { background: #166534; }
.nodedelta.theme-dark .nd-mark-del { background: #991b1b; }
.nodedelta.theme-dark .nd-detail-pane { border-top-color: #404040; }
`;
