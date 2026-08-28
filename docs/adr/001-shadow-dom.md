# ADR 001: Shadow DOM UI isolation

Status: Accepted

## Context

FlowDiff renders inside n8n pages whose Vue components, CSS, and DOM structure
can change independently. Page styles could break FlowDiff, and extension styles
must not alter n8n.

## Decision

Mount one React application in an open ShadowRoot owned by an isolated content
script. Bundle all UI styles and assets locally inside that boundary. Do not use
n8n frontend components, private stores, or navigation tabs.

## Alternatives

- Render into the page DOM and continuously compensate for CSS collisions.
- Use an iframe, with additional sizing, messaging, accessibility, and extension
  resource complexity.
- Inject into n8n's Vue application or internal tab system.

## Consequences

CSS isolation and maintenance improve, and n8n remains untouched. Portals,
focus, fonts, theme variables, and all overlay styles must be explicitly scoped
to the ShadowRoot and tested in both directions.
