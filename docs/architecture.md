# Architecture

## Status and goals

This document defines the V1 architecture. The workspace, domain contracts,
editor REST adapter (T02), normalizer with canonicalization and hashing (T03),
and the browser-independent semantic diff engine (T05) are implemented, each
with Node-testable tests, synthetic fixtures, and structural golden diffs for
the full fixture corpus. The snapshot repository, full extension lifecycle,
and review UI are implemented by later tickets. Those tickets must update any
implementation-state notes here when their code lands.

FlowDiff has no backend. It runs at the n8n page/extension boundary, reads the
current workflow from the same n8n origin with the user's existing session,
normalizes it, stores manual snapshots in browser IndexedDB, calculates a
semantic diff locally, and renders the result inside an isolated Shadow DOM.

```text
n8n browser page
      |
      v
isolated content script / Shadow DOM application
      |
      v
@flowdiff/n8n-adapter -- read-only editor REST GET
      |
      v
@flowdiff/n8n-normalizer -- stable semantic representation + hash
      |                              |
      v                              v
@flowdiff/snapshot-store       current workflow
      |                              |
      +--------------+---------------+
                     v
             @flowdiff/diff-engine
                     |
                     v
                @flowdiff/diff-ui
```

## Extension contexts

- **Background service worker:** lifecycle, per-origin permission management,
  registered injection, toolbar behavior, and non-sensitive settings. It does
  not fetch workflows or contain the diff engine.
- **Isolated content script:** detects workflow context and SPA navigation,
  performs same-origin credentialed reads through the adapter, owns the launcher,
  mounts the Shadow DOM app, and cleans up on route exit.
- **Shadow DOM React app:** owns snapshots, comparison state, graph, inspector,
  and escaped read-only presentation. All UI styles stay in this boundary.

The current T01 shell contains a service worker, static Cloud content script,
simple workflow-route detector, Shadow DOM launcher, and popup. T06 replaces the
static lifecycle/permission shell with the complete design above.

## Package responsibilities

| Package                    | Responsibility                               | May depend on                                  |
| -------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `@flowdiff/core`           | Domain models, ports, error contracts        | No workspace package                           |
| `@flowdiff/n8n-adapter`    | Detection and read-only n8n interoperability | `core`                                         |
| `@flowdiff/n8n-normalizer` | Normalize, canonicalize, hash                | `core`                                         |
| `@flowdiff/diff-engine`    | Browser-independent semantic comparison      | `core`                                         |
| `@flowdiff/snapshot-store` | IndexedDB repository and snapshot pipeline   | `core`                                         |
| `@flowdiff/diff-ui`        | Reusable React review UI                     | `core`, `diff-engine`                          |
| `@flowdiff/test-fixtures`  | Original synthetic workflow fixtures         | `core`                                         |
| `@flowdiff/extension`      | Browser contexts and composition root        | All production packages except `test-fixtures` |

`scripts/check-dependencies.mjs` enforces this workspace graph. Browser/Chrome,
React, and IndexedDB implementation details must not leak into the portable core,
normalizer, or diff engine.

## Trust and data boundaries

- Workflow JSON, parameters, code, expressions, names, and snapshots are
  sensitive untrusted input.
- The adapter exposes reads only. It never calls workflow-write, execution,
  evaluation, or credential endpoints and never persists cookies or tokens.
- Workflow strings are rendered as text. They are never evaluated or inserted
  as HTML.
- Snapshots are partitioned by a stable hash of `origin + basePath` and workflow
  ID, preventing collisions between n8n installations.
- No workflow content crosses the n8n origin/extension boundary to a FlowDiff or
  third-party service.

See [privacy.md](privacy.md) for the user-facing policy.

## Diff engine semantics and performance

The semantic diff engine matches nodes deterministically: stable `id` first,
then identical names, then a conservative fuzzy rename that requires
content-identical unmatched nodes on both sides and refuses ambiguous
matches. `NodeChange.kind` is the primary classification, while the summary
counts modifications, renames, and movement independently so movement is
never hidden by other changes. Connection endpoints are remapped through
detected renames, so renaming a node alone does not create connection churn.
Changed text values can be classified for specialized read-only rendering
(JavaScript, Python, SQL, JSON, expressions, plain text) via
`classifyTextParameter`; n8n expressions are inert strings and are never
evaluated.

Golden files for the whole fixture corpus live in
`packages/diff-engine/src/goldens/` and guard against behavioral drift.
Regenerate them deliberately with `UPDATE_GOLDENS=true pnpm test` followed by
`pnpm format`, and review the diff before committing.

Performance: diffing the 300-node `large-workflow` fixture pair completes in
well under 1 ms on current developer hardware (measured 2026-08-28, Node 24);
the test suite enforces a 500 ms guardrail so CI catches regressions long
before the budget documented here is reached.

## Dependency direction and future ports

The browser is an adapter, not the domain. `WorkflowProvider`, normalizer,
snapshot-repository, and differ interfaces let future CLI or Git adapters reuse
the core without importing extension code. Web Workers may later host expensive
normalization/diff work without changing the domain APIs. These are architectural
extension points, not V1 features.

## Decisions

- [ADR 001: Shadow DOM UI isolation](adr/001-shadow-dom.md)
- [ADR 002: Session-authenticated editor REST API](adr/002-editor-rest-api.md)
- [ADR 003: IndexedDB snapshots](adr/003-indexeddb-snapshots.md)
- [ADR 004: Independent semantic diff engine](adr/004-independent-diff-engine.md)

Intentional differences from the specification are recorded in
[deviations.md](deviations.md).
