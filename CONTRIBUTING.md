# Contributing to NodeDelta

Thanks for helping build NodeDelta. The project is pre-release and changes must
preserve its local-only, read-only security model.

## Before you start

- Discuss substantial product or architecture changes in an issue first.
- Do not add a backend, analytics, external AI, workflow writes, credential
  reads, auth persistence, remote scripts, or copied n8n Enterprise code.
- Use original synthetic workflows for fixtures. Remove real hostnames, IDs,
  credentials, customer data, and secrets.
- Keep browser APIs in `apps/extension`; portable packages must remain usable in
  Node.js tests.
- Record an ADR for decisions that change a durable architectural boundary and
  add an entry to `docs/deviations.md` for an intentional spec deviation.

## Setup and checks

Use Node.js 22+ and the pnpm version declared in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm audit:licenses
pnpm audit --prod --audit-level high
```

Run tests that cover the behavior you changed. Normalizer and diff-engine work
must begin with a failing fixture/golden test. A build-only or skipped test does
not demonstrate behavior.

## Pull requests

Keep changes focused and explain:

- the user-visible outcome;
- the tests and exact environment used;
- privacy, permission, compatibility, or dependency changes;
- fixture provenance; and
- any incomplete compatibility evidence or intentional deviation.

Never paste sensitive workflow contents into issues, logs, test output, or pull
requests. The final release gate must run against one commit and one packaged
artifact; see `docs/compatibility.md` for its evidence checklist.
