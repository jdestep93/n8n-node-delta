import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const exceptionsPath = resolve(workspaceRoot, 'config/license-exceptions.json');
const artifactsDirectory = resolve(workspaceRoot, 'artifacts');

// Intentionally narrow. A new expression requires explicit review rather than a
// permissive "open source" wildcard.
const reviewedLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MIT',
]);

function loadPnpmInventory() {
  const raw = execFileSync(
    'pnpm',
    ['licenses', 'list', '--prod', '--json', '--long'],
    { cwd: workspaceRoot, encoding: 'utf8' },
  );
  const grouped = JSON.parse(raw);

  return Object.entries(grouped)
    .flatMap(([expression, packages]) =>
      packages.flatMap((dependency) =>
        dependency.versions.map((version, index) => ({
          name: dependency.name,
          version,
          license: dependency.license ?? expression,
          path: dependency.paths[index] ?? dependency.paths[0],
          homepage: dependency.homepage ?? null,
        })),
      ),
    )
    .sort((left, right) =>
      `${left.name}@${left.version}`.localeCompare(
        `${right.name}@${right.version}`,
      ),
    );
}

function validateExceptions(exceptions) {
  const required = [
    'package',
    'version',
    'license',
    'evidenceUrl',
    'rationale',
    'reviewer',
    'reviewedAt',
  ];

  return exceptions.flatMap((exception, index) =>
    required
      .filter(
        (field) =>
          typeof exception[field] !== 'string' ||
          exception[field].trim() === '',
      )
      .map((field) => `License exception ${index} is missing ${field}.`),
  );
}

async function readLicenseNotice(dependency) {
  const entries = await readdir(dependency.path, { withFileTypes: true });
  const licenseEntry = entries
    .filter((entry) => entry.isFile())
    .sort((left, right) => left.name.localeCompare(right.name))
    .find((entry) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(entry.name));

  if (licenseEntry === undefined) {
    throw new Error(
      `${dependency.name}@${dependency.version} has no installed license notice.`,
    );
  }

  return readFile(resolve(dependency.path, licenseEntry.name), 'utf8');
}

const exceptions = JSON.parse(await readFile(exceptionsPath, 'utf8'));
if (!Array.isArray(exceptions)) {
  throw new TypeError('config/license-exceptions.json must be an array.');
}

const errors = validateExceptions(exceptions);
const inventory = loadPnpmInventory();

if (inventory.length === 0) {
  errors.push('Production dependency inventory is empty.');
}

for (const dependency of inventory) {
  const allowed = reviewedLicenses.has(dependency.license);
  const exception = exceptions.find(
    (candidate) =>
      candidate.package === dependency.name &&
      candidate.version === dependency.version &&
      candidate.license === dependency.license,
  );

  if (!allowed && exception === undefined) {
    errors.push(
      `${dependency.name}@${dependency.version} uses unreviewed license ${dependency.license}.`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

await mkdir(artifactsDirectory, { recursive: true });

const machineInventory = inventory.map(
  ({ name, version, license, homepage }) => ({
    name,
    version,
    license,
    homepage,
  }),
);
await writeFile(
  resolve(artifactsDirectory, 'production-dependency-licenses.json'),
  `${JSON.stringify(machineInventory, null, 2)}\n`,
);

const notices = [];
for (const dependency of inventory) {
  const notice = await readLicenseNotice(dependency);
  notices.push(
    [
      `${dependency.name}@${dependency.version}`,
      `License: ${dependency.license}`,
      dependency.homepage === null ? null : `Homepage: ${dependency.homepage}`,
      '',
      notice.trim(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
  );
}

await writeFile(
  resolve(artifactsDirectory, 'third-party-licenses.txt'),
  `${notices.join('\n\n${' - '.repeat(72)}\n\n')}\n`,
);

const licenseSummary = [...new Set(inventory.map(({ license }) => license))]
  .sort()
  .join(', ');
console.log(
  `Audited ${inventory.length} production dependency packages (${licenseSummary}).`,
);
console.log(
  `Wrote ${basename(artifactsDirectory)}/production-dependency-licenses.json and ${basename(artifactsDirectory)}/third-party-licenses.txt.`,
);
