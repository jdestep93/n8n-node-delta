# Compatibility and version updates

## Current evidence

FlowDiff is pre-release. A successful build or mocked adapter test is not
compatibility evidence. The release gate requires the exact packaged artifact to
complete the user journey and privacy/network review.

| Target                  | Version/build                              | Date | Evidence                           | Status  |
| ----------------------- | ------------------------------------------ | ---- | ---------------------------------- | ------- |
| Playwright Chromium     | Not yet pinned/tested for full MV3 journey | —    | T10 E2E                            | Pending |
| Google Chrome stable    | Not yet recorded                           | —    | Manual release-candidate checklist | Pending |
| Microsoft Edge stable   | Not yet recorded                           | —    | Manual release-candidate checklist | Pending |
| Self-hosted n8n         | Docker image not yet added                 | —    | Pinned Docker DoD journey          | Pending |
| n8n Cloud               | Build/version not yet recorded             | —    | Disposable Cloud smoke test        | Pending |
| Self-hosted path prefix | Reverse-proxy fixture not yet added        | —    | Automated prefix journey           | Pending |

T10 must replace pending rows with exact versions, dates, tester/CI links, and
results. T12 must confirm Chrome and Edge against the exact release ZIP. Until
then this table makes no support claim.

## Compatibility policy

- V1 targets current stable Chrome and Edge and approximately 1–300 workflow
  nodes.
- FlowDiff detects required adapter capabilities and response shape. It does not
  reject an n8n instance merely because its version is newer.
- n8n Cloud, root-hosted self-hosted n8n, custom domains, and technically
  detectable path prefixes are in scope.
- The n8n editor REST API is internal and may change. Unknown additive fields are
  tolerated where safe; an unrecognized required shape produces a friendly
  unsupported response without deleting snapshots.
- Firefox, Safari, mobile browsers, and branded-browser automation through
  Playwright are outside the V1 automated packaging scope. Chrome/Edge require
  manual release smoke checks because current branded browsers do not support the
  extension sideload flags used by Playwright's persistent Chromium context.

## Release-candidate checklist

Record evidence for the exact commit, unpacked build, and ZIP:

1. Run the pinned Docker n8n environment and the full E2E suite from a clean
   volume, including save/modify/refresh/diff, persistence after browser restart,
   SPA lifecycle, errors, permissions, and custom-prefix routing.
2. Install that artifact in clean current-stable Chrome and Edge profiles.
3. On a disposable n8n Cloud instance, enable only its exact origin; exercise an
   existing and a new workflow route, save/reload a snapshot, modify/save in n8n,
   refresh, inspect a code diff, and verify persistence.
4. Inspect DevTools Network: workflow data stays on the n8n origin/inside the
   extension; there are no credential, analytics, AI, FlowDiff backend, or other
   workflow-upload requests.
5. Record browser versions, n8n image tag or Cloud build, operating system, date,
   tester/CI run, commit, ZIP checksum, and pass/fail result in the table or an
   attached dated evidence section.

## Bumping the self-hosted n8n test version

The Docker environment is implemented in T10. When it exists, keep its exact n8n
image tag in one documented location and use this procedure:

1. Open a dedicated dependency-update pull request and change only the pinned
   image reference plus necessary test-adapter fixes.
2. Start from a clean test volume; never reuse production n8n data.
3. Run the complete E2E matrix, not only container readiness.
4. Re-run the source/network privacy audit and all adapter response/error tests.
5. Update the self-hosted matrix row with the exact tag, date, commit/run, and
   result. Preserve prior tested-version history below the active matrix.
6. If behavior differs, update the adapter behind its existing interface and
   document an intentional deviation; do not weaken package boundaries or add an
   API key requirement.

For an n8n Cloud change, repeat the manual Cloud checklist and record any exposed
build/version. Cloud evidence cannot be inferred from the self-hosted test.

## Bumping FlowDiff or browser dependencies

Keep root and extension versions equal. A version or production-dependency bump
requires frozen install, formatting, lint, typecheck, tests, build, extension
verification, `pnpm audit:licenses`, `pnpm audit --prod --audit-level high`, full
E2E, packaging, unzip/reverification, and refreshed Chrome/Edge evidence. Update
the dependency-license audit when the production closure changes.
