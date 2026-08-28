# ADR 004: Independent semantic diff engine

Status: Accepted

## Context

A raw JSON diff produces noisy, fragile results and n8n's proprietary or
Enterprise implementations cannot be copied. Future CLI and Git tooling should
reuse the same comparison semantics without a browser or React dependency.

## Decision

Implement a deterministic, independently authored semantic engine in
`@flowdiff/diff-engine`. It consumes normalized FlowDiff domain models, emits a
typed `WorkflowDiff`, treats workflow strings as inert data, and has no Chrome,
React, n8n frontend, storage, or network dependency. Fixture/golden tests define
the behavior.

## Alternatives

- Display a generic JSON patch.
- Embed comparison logic in the content script or React components.
- Depend on private n8n frontend or Enterprise diff code.
- Send workflows to an external comparison or AI service.

## Consequences

The package is portable, testable, local-only, and reusable by future adapters.
FlowDiff owns matching, normalization assumptions, performance, and forward-
compatibility maintenance. Specialized rendering may evolve without changing the
core semantic result.
