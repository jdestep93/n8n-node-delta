# FlowDiff for n8n

FlowDiff is a local-first Chrome/Edge extension for reviewing meaningful n8n
workflow changes. The V1 implementation is in progress.

## Development

Requires Node.js 22 or newer and pnpm 10.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm package:chrome
```

`pnpm build` creates the unpacked extension in `dist/chrome`. The package command
creates a versioned Chrome ZIP in `artifacts`.

FlowDiff processes workflows locally. Workflow contents and snapshots never
leave your browser unless you explicitly export them.
