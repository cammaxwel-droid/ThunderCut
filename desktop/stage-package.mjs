import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = path.join(projectRoot, 'desktop-app');
const stageDirectory = path.resolve(projectRoot, '.build', 'desktop-package');
const expectedParent = path.resolve(projectRoot, '.build');

if (
  path.dirname(stageDirectory) !== expectedParent ||
  path.basename(stageDirectory) !== 'desktop-package'
) {
  throw new Error(`Refusing to stage outside the expected build directory: ${stageDirectory}`);
}

await rm(stageDirectory, { recursive: true, force: true });
await mkdir(stageDirectory, { recursive: true });
// Keep pnpm/electron-builder from treating the parent development workspace's
// dependencies as runtime dependencies of this already-bundled application.
await writeFile(path.join(stageDirectory, 'pnpm-workspace.yaml'), 'packages:\n  - "."\n');

for (const fileName of [
  'main.cjs',
  'game-storage.cjs',
  'preload.cjs',
  'package.json',
  'pnpm-lock.yaml',
  'hub-manifest.json',
  'icon.png',
  'icon.ico',
]) {
  await copyFile(path.join(sourceDirectory, fileName), path.join(stageDirectory, fileName));
}

await cp(path.join(sourceDirectory, 'renderer'), path.join(stageDirectory, 'renderer'), { recursive: true });

for (const notice of ['LICENSE', 'ASSET_LICENSE.md', 'THIRD_PARTY_NOTICES.md']) {
  await copyFile(path.join(projectRoot, notice), path.join(stageDirectory, notice));
}
await cp(path.join(projectRoot, 'licenses'), path.join(stageDirectory, 'licenses'), { recursive: true });

console.log(`Thunder Cut desktop package staged at ${stageDirectory}`);
