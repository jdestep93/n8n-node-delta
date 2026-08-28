# ADR 003: IndexedDB snapshots

Status: Accepted

## Context

Workflow snapshots can be larger and more structured than extension preference
data. They must persist across browser restarts, remain local, and be isolated by
n8n instance and workflow.

## Decision

Store normalized manual snapshots in a versioned IndexedDB database through a
Dexie repository adapter. Namespace records with a stable hash of n8n
`origin + basePath` and workflow ID. Index for newest-first listing and hash
deduplication; default retention is FIFO at 50 snapshots per workflow.

## Alternatives

- `chrome.storage.local`, which is better suited to smaller extension settings.
- `localStorage`, which is synchronous and poorly suited to structured data.
- A FlowDiff backend or cloud-sync account.
- Filesystem/Git persistence from the browser extension.

## Consequences

Snapshots remain local and repository operations can be tested behind a port.
Schema migrations, quota/unavailable errors, retention, deletion, and cross-
instance isolation require explicit tests. Clearing extension data or uninstalling
the extension can remove snapshots.
