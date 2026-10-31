import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const stageDirectory = path.resolve(projectRoot, '.build', 'desktop-package');
const builderCli = path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js');
const builderConfig = path.join(projectRoot, 'electron-builder.yml');

const child = spawn(
  process.execPath,
  [builderCli, '--config', builderConfig, ...process.argv.slice(2)],
  {
    cwd: stageDirectory,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  },
);

child.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`electron-builder stopped by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
