import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'BASELINE_MANIFEST.json'), 'utf8'));
const failures = [];
for (const entry of manifest.files) {
  const candidate = path.resolve(root, entry.path);
  if (!candidate.startsWith(root)) throw new Error('Baseline path is outside the project.');
  try {
    const data = await readFile(candidate);
    const digest = createHash('sha256').update(data).digest('hex');
    if (digest !== entry.sha256) failures.push(entry.path);
  } catch {
    failures.push(entry.path);
  }
}
if (failures.length) {
  console.error('Protected baseline files differ or are missing:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${manifest.files.length} protected game, asset, shell, renderer-input and test files match the imported baseline.`);
}
