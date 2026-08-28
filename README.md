# FlowDiff for n8n

FlowDiff is an independent, local-first Chrome and Edge extension for reviewing
meaningful changes between n8n workflows. It is designed to show node,
connection, parameter, expression, and code changes instead of an undifferentiated
JSON patch.

> **Implementation status:** V1 is under active development. The repository
> currently contains the Manifest V3 extension shell, package contracts, the
> read-only n8n editor adapter, the workflow normalizer (canonicalization and
> hashing), the semantic diff engine with golden tests, build, and baseline
> tests. The snapshot and complete review UI claims below describe the V1
> target and must not be treated as released features until the release
> checklist and [compatibility evidence](docs/compatibility.md) pass.

FlowDiff is an independent open-source project and is not affiliated with or
endorsed by n8n.

## Screenshots

Release screenshots will be added from the exact V1 release candidate after the
complete workflow-review journey passes in Chrome and Edge. This placeholder is
intentional; screenshots of scaffold or unverified states are not product
evidence.

## V1 features

The V1 release is intended to provide:

- manual, per-workflow snapshots stored in browser IndexedDB;
- snapshot-to-current and snapshot-to-snapshot comparisons;
- semantic node, connection, parameter, movement, and workflow-setting changes;
- specialized read-only diffs for JavaScript, Python, SQL, JSON, expressions,
  prompts, and text;
- a searchable changes list, read-only workflow graph, and node inspector;
- n8n Cloud and self-hosted support, including detectable path prefixes; and
- local-only operation with no FlowDiff backend, account, analytics, or AI calls.

See [Compatibility](docs/compatibility.md) for what has actually been tested.

## Installation

### Chrome Web Store

FlowDiff has not been published to the Chrome Web Store. A store link will be
added only after V1 satisfies the release gate.

### Manual installation

1. Run `pnpm install --frozen-lockfile` and `pnpm build` from a clean checkout,
   or obtain a release ZIP from a published GitHub release.
2. If using a ZIP, extract it and confirm `manifest.json` is at the extracted
   directory root.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select `dist/chrome` (or the extracted release
   directory).

The current development build is a shell, not a V1 release candidate.

## Development

Requirements: Node.js 22 or newer and pnpm 10.28.1 (declared by the root
`packageManager` field).

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm audit:licenses
pnpm audit --prod --audit-level high
pnpm package:chrome
```

`pnpm dev` rebuilds the extension in watch mode. `pnpm build` creates the
unpacked extension in `dist/chrome`. `pnpm package:chrome` creates
`artifacts/flowdiff-chrome-v<version>.zip`; release-grade packaging and
unpack/reverification are completed by T12.

More detail is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy and security

FlowDiff processes workflows locally.

Workflow contents and snapshots never leave your browser unless you explicitly
export them. V1 does not include export, a FlowDiff backend, user accounts,
analytics, telemetry containing workflow data, or external AI requests.

The production extension reads the current workflow through the user's existing
n8n browser session. It must not store authentication cookies or tokens, request
credential secrets, execute workflow code or expressions, or write workflows
back to n8n. Full policy and data-lifecycle details are in
[docs/privacy.md](docs/privacy.md).

## Permissions

The current manifest requests `storage`, required Cloud host access for
`https://*.app.n8n.cloud/*`, and optional `http://*/*` / `https://*/*` host
access for user-approved self-hosted sites. T06 will add the final user-gesture
permission and injection flow and must update this section if the reviewed
manifest changes. FlowDiff must never request `<all_urls>` as a required host
permission.

## Architecture

The monorepo keeps browser APIs at the extension edge and portable domain logic
in Node-testable packages:

```text
n8n page -> extension content app -> adapter -> normalizer
                                         |          |
                                         |          +-> snapshot store
                                         +------------> diff engine -> diff UI
```

See [docs/architecture.md](docs/architecture.md), the
[dependency policy](scripts/dependency-policy.mjs), and the
[architecture decisions](docs/adr/).

## Supported n8n and browsers

The intended V1 browsers are current stable Chrome and Edge. n8n compatibility
is capability-based rather than rejected solely by version number. No n8n
version or browser combination has yet completed the release compatibility gate
on this branch. Do not infer support from the extension building successfully.

The evidence matrix and version-bump procedure live in
[docs/compatibility.md](docs/compatibility.md).

## Support

This project is pre-release. Search existing GitHub issues before filing a new
one. Include FlowDiff/browser versions, n8n version when available, deployment
type, and non-sensitive diagnostics. Never attach workflow JSON, parameters,
credentials, authentication material, or screenshots containing secrets.

Security or privacy reports should not include real workflow data. Use the
repository's private security-reporting channel when one is enabled; until then,
open a minimal issue asking maintainers for a private contact path.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), preserve the
read-only/local-only boundaries, and run the complete local verification suite
before opening a pull request.

## Limitations

- V1 is read-only: no rollback, workflow writes, or automatic snapshots.
- V1 has no Git/GitHub/GitLab integration, cloud sync, sharing, accounts, AI,
  Firefox/Safari packaging, or mobile support.
- FlowDiff uses n8n's internal editor REST API because session-based access is a
  product requirement; n8n changes may require adapter updates.
- Path-prefix detection is best-effort and must fail gracefully.
- Unknown community nodes receive generic semantic comparison; specialized
  rendering is not guaranteed.
- The graph is a review aid, not a copy of n8n's editor canvas.
- Compatibility is limited to combinations with recorded evidence in the
  compatibility matrix.

## License

FlowDiff is released under the [MIT License](LICENSE). Production dependency
licenses are checked by `pnpm audit:licenses` and documented in
[docs/dependency-license-audit.md](docs/dependency-license-audit.md).
