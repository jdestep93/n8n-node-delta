# ADR 002: Session-authenticated editor REST API

Status: Accepted

## Context

V1 must read the workflow currently open in n8n without asking for an API key or
copying authentication material. The documented public API requires an API key,
while the n8n editor already reads workflows with its browser session.

## Decision

Use a read-only adapter in the isolated content-script context to issue a
same-origin credentialed `GET` to the detected editor REST workflow endpoint.
Validate and unwrap the response before it reaches the normalizer. Never expose
write, execution, evaluation, or credential endpoints and never store session
cookies or tokens.

## Alternatives

- Require an n8n public API key.
- Fetch from the extension service worker with broad cross-origin access.
- Read private n8n Vue stores through a main-world bridge.
- Run a NodeDelta proxy/backend.

## Consequences

Setup stays keyless and local and the production adapter remains read-only. The
editor API is internal, so base-path/response capability detection, typed errors,
mocked compatibility tests, and ongoing Cloud/self-hosted release checks are
mandatory.
