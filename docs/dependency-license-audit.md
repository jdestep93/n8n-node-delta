# Production dependency license audit

Audit date: 2026-08-28

Scope: the production dependency closure reported by
`pnpm licenses list --prod --json --long` for lockfile/base commit
`244a8cfaac0f3a525d9f64e028530fda349ccd97`. Development-only build, lint,
test, and packaging tools are excluded from this production-distribution review.

## Result

Pass. The installed production closure contains only MIT and Apache-2.0 packages,
both reviewed as compatible with distribution of this MIT-licensed extension.
No exception is active. `pnpm audit --prod --audit-level high` reported no known
vulnerabilities on the audit date.

| Package        | Resolved version | License    | Role                                                    |
| -------------- | ---------------- | ---------- | ------------------------------------------------------- |
| `@types/react` | 19.2.18          | MIT        | Installed production peer/type closure reported by pnpm |
| `csstype`      | 3.2.3            | MIT        | React type dependency reported by pnpm                  |
| `dexie`        | 4.4.5            | Apache-2.0 | IndexedDB abstraction                                   |
| `react`        | 19.2.8           | MIT        | Extension and review UI                                 |
| `react-dom`    | 19.2.8           | MIT        | React DOM renderer                                      |
| `scheduler`    | 0.27.0           | MIT        | React runtime dependency                                |
| `zod`          | 4.4.3            | MIT        | Runtime workflow-response validation                    |
| `zustand`      | 5.0.15           | MIT        | Extension UI state                                      |

Package manifests use compatible semver ranges; the resolved versions above are
the auditable lockfile/install result and can change only with a lockfile update.

## Enforced audit

Run:

```bash
pnpm install --frozen-lockfile
pnpm audit:licenses
pnpm audit --prod --audit-level high
```

`scripts/audit-licenses.mjs` fails closed on an empty inventory, missing/unknown
or unreviewed license expression, malformed exception, or missing installed
license notice. It writes machine-readable
`artifacts/production-dependency-licenses.json` and distributable
`artifacts/third-party-licenses.txt`. Generated artifacts are intentionally
ignored by Git and must be regenerated from the exact release install.

Any exception must be added to `config/license-exceptions.json` with exact
package/version/license, evidence URL, rationale, reviewer, and review date. A
vulnerability exception additionally requires a tracking issue, affected surface,
mitigation, owner, and expiry; advisories must not be silently ignored.

## Source and fixture provenance

NodeDelta's architecture and documentation are independently authored from the
project specification and public interoperability research. No n8n proprietary
or Enterprise workflow-diff implementation was copied. n8n workflow JSON is used
only as an interoperability format.

At this audit commit, `@nodedelta/test-fixtures` is an empty package shell and no
workflow JSON fixtures exist. T03 must add only original synthetic fixtures and
update [fixture-provenance.md](fixture-provenance.md). T12 must repeat this audit
against the exact production bundle dependency closure and packaged artifact.
