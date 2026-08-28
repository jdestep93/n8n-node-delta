import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import archiver from 'archiver';

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(
  await readFile(resolve(workspaceRoot, 'package.json'), 'utf8'),
);
const artifactsDirectory = resolve(workspaceRoot, 'artifacts');
const archivePath = resolve(
  artifactsDirectory,
  `flowdiff-chrome-v${packageJson.version}.zip`,
);

await mkdir(artifactsDirectory, { recursive: true });

await new Promise((resolveArchive, rejectArchive) => {
  const output = createWriteStream(archivePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', resolveArchive);
  output.on('error', rejectArchive);
  archive.on('error', rejectArchive);
  archive.pipe(output);
  archive.directory(resolve(workspaceRoot, 'dist/chrome'), false);
  void archive.finalize();
});

console.log(`Created ${archivePath}`);
