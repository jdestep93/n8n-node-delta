# Specification deviations

This is the authoritative log for intentional differences from the V1
specification. A missing feature tracked by a later implementation ticket is not
a deviation.

## Accepted deviations

None as of 2026-08-28.

## Implementation-state notes

- The T01 manifest shell statically injects on n8n Cloud and declares only the
  `storage` extension permission. T06 will implement the specified self-hosted
  user-gesture permission/injection lifecycle and reconcile final
  `activeTab`/`scripting` needs. This is staged implementation, not an accepted
  V1 deviation.
- The architecture references Dexie, semantic diff UI dependencies, Docker n8n,
  and release-grade packaging that are completed by later tickets. Documentation
  describes those as V1 contracts and labels unverified state.
- The specification originally used `FlowDiff` and `n8n-diff-tool` as working
  names. The product was renamed before V1 to `NodeDelta for n8n`, with
  `NodeDelta` as the short name, `n8n-node-delta` as the repository/root package,
  and `@nodedelta/*` as the internal workspace package scope;
  this is permitted by the specification.

## Entry template

Every future accepted deviation must include:

- date and owning issue/PR;
- specification requirement;
- implemented decision and rationale;
- privacy, security, compatibility, and migration impact; and
- approval plus follow-up or expiry, when applicable.
