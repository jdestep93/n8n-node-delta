# Privacy policy

Effective: 2026-08-28

FlowDiff processes workflows locally.

Workflow contents and snapshots never leave your browser unless you explicitly
export them. Export is not part of V1.

## Data FlowDiff reads

When enabled for an n8n site and opened on a workflow, FlowDiff reads the current
workflow from that same n8n origin using the browser session that is already
signed in. A workflow can include its name, nodes, parameters, connections,
settings, code, expressions, prompts, and credential references.

FlowDiff may compare credential reference IDs and names that already appear in
workflow JSON. It does not request or read credential secret values and does not
call n8n credential endpoints.

## Data FlowDiff stores

Manual workflow snapshots and their labels, hashes, timestamps, schema version,
instance namespace, and settings are stored locally in browser IndexedDB or
extension storage. Snapshots are isolated by n8n origin/base path and workflow
ID. They remain until the user deletes them, retention removes the oldest
eligible snapshots, browser/extension data is cleared, or the extension is
uninstalled.

FlowDiff does not copy n8n authentication cookies or bearer tokens into extension
storage.

## Data FlowDiff sends

V1 has no FlowDiff backend, account, cloud synchronization, analytics, advertising,
external AI request, or workflow-upload service. Production workflow reads go
only to the n8n origin currently open in the browser. No workflow content is sent
to FlowDiff maintainers or third parties.

The browser, n8n instance, extension store, and GitHub may separately process
ordinary network or account data under their own policies; they are not operated
by FlowDiff.

## Permissions

The extension uses local extension storage and site access to run on n8n pages.
n8n Cloud access is declared for `https://*.app.n8n.cloud/*`. Arbitrary
self-hosted origins use optional `http://*/*` / `https://*/*` host patterns so
the browser can grant only a site the user enables. Host permission paths are a
browser-manifest capability boundary; FlowDiff must request and persist only the
exact origin selected by the user.

The final permission workflow lands in T06. This policy and the README must be
updated if the reviewed manifest changes.

## Security behavior

FlowDiff is a viewer. It does not execute workflow JavaScript, Python, SQL,
expressions, shell strings, prompts, or HTML. It does not write workflows back
to n8n, start executions, evaluate expressions, or inject workflow HTML. Displayed
content is escaped and bundled code is local to the extension.

## User control

Users can rename or delete individual snapshots and configure local retention in
the completed V1 UI. Clearing the extension's site/storage data or uninstalling
the extension removes locally stored FlowDiff data according to the browser's
behavior. Deleting a FlowDiff snapshot does not alter the n8n workflow.

## Changes and contact

Any future analytics or remote processing would require a new, explicit policy
and product decision; it is not authorized by this policy. Report privacy issues
without attaching workflow content, credentials, tokens, or screenshots with
secrets. Follow the private security-reporting route linked by the repository
when available.

FlowDiff is an independent open-source project and is not affiliated with or
endorsed by n8n.
