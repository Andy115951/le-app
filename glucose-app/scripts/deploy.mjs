#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deploymentOptions, validateProjectLink } from './lib/deployment-target.mjs';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = dirname(appRoot);
const stagingName = 'glucose-app';
const cliPath = join(repositoryRoot, 'node_modules/vercel/dist/index.js');
const requiredEntries = ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'src'];
const blockedNames = new Set(['.vercel', '.git', 'node_modules', '.next']);
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };

let stagingRoot;
let child;
let interruptedSignal;

function isBlocked(name) {
  return name.startsWith('.env') || blockedNames.has(name);
}

function checkInterrupted() {
  if (interruptedSignal) throw new Error(`Deployment interrupted (${interruptedSignal}).`);
}

async function readProjectLink(projectName) {
  const linkPath = join(appRoot, '.vercel/project.json');
  const metadata = await lstat(linkPath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error('The application .vercel/project.json must be a regular file.');
  }
  const link = JSON.parse(await readFile(linkPath, 'utf8'));
  return validateProjectLink(link, projectName);
}

async function copyEntry(source, destination) {
  checkInterrupted();
  if (isBlocked(basename(source))) return 0;
  const metadata = await lstat(source);
  // Do not follow links into another app, credentials, or files outside this app.
  if (metadata.isSymbolicLink()) throw new Error('Deployment source contains a symbolic link.');
  if (metadata.isDirectory()) {
    await mkdir(destination, { recursive: true });
    let count = 0;
    for (const name of (await readdir(source)).sort()) {
      count += await copyEntry(join(source, name), join(destination, name));
    }
    return count;
  }
  if (!metadata.isFile()) throw new Error('Deployment source contains an unsupported file type.');
  await copyFile(source, destination);
  return 1;
}

async function verifyStaging(directory) {
  let count = 0;
  for (const name of await readdir(directory)) {
    if (isBlocked(name)) throw new Error('A forbidden path was found in deployment staging.');
    const path = join(directory, name);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) throw new Error('Deployment staging contains a symbolic link.');
    if (metadata.isDirectory()) count += await verifyStaging(path);
    else if (metadata.isFile()) count += 1;
    else throw new Error('Deployment staging contains an unsupported file type.');
  }
  return count;
}

async function runCli(link, target) {
  checkInterrupted();
  const metadata = await lstat(cliPath);
  if (!metadata.isFile()) throw new Error('Install the repository Vercel CLI before deploying.');
  checkInterrupted();
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [
      cliPath, 'deploy', '--yes', `--target=${target}`, '--scope', link.orgId,
    ], {
      cwd: stagingRoot,
      // Inherit the normal CLI login without inspecting or printing credentials.
      // Explicit IDs take precedence over inherited project bindings.
      env: { ...process.env, VERCEL_PROJECT_ID: link.projectId, VERCEL_ORG_ID: link.orgId, CI: '1' },
      stdio: 'inherit',
    });
    child.once('error', () => reject(new Error('Unable to start the repository Vercel CLI.')));
    child.once('close', (code, signal) => {
      child = undefined;
      resolve(code ?? signalExitCodes[signal] ?? 1);
    });
  });
}

const signalHandlers = new Map(Object.keys(signalExitCodes).map((signal) => [signal, () => {
  interruptedSignal = signal;
  if (child) child.kill(signal);
}]));

try {
  const { dryRun, target, projectName } = deploymentOptions(process.argv.slice(2));
  const link = await readProjectLink(projectName);
  for (const [signal, handler] of signalHandlers) process.on(signal, handler);
  stagingRoot = await mkdtemp(join(tmpdir(), 'glucose-app-deploy-'));
  const stagedApp = join(stagingRoot, stagingName);
  await mkdir(stagedApp);
  let copiedFiles = 0;
  for (const name of requiredEntries) {
    copiedFiles += await copyEntry(join(appRoot, name), join(stagedApp, name));
  }
  const publicPath = join(appRoot, 'public');
  const publicMetadata = await lstat(publicPath).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (publicMetadata) copiedFiles += await copyEntry(publicPath, join(stagedApp, 'public'));
  checkInterrupted();
  const stagedFiles = await verifyStaging(stagingRoot);
  if (stagedFiles !== copiedFiles) throw new Error('Deployment staging file count does not match the source.');
  console.log(`Target: ${projectName} / ${target}`);
  console.log(`Source files: ${copiedFiles}; verified staged files: ${stagedFiles}`);
  if (dryRun) console.log('Dry run verified. No deployment was started.');
  else process.exitCode = await runCli(link, target);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Deployment preparation failed.');
  process.exitCode = interruptedSignal ? signalExitCodes[interruptedSignal] : 1;
} finally {
  // Only remove the unique directory created by this invocation.
  if (stagingRoot) {
    try {
      await rm(stagingRoot, { recursive: true, force: true });
    } catch {
      console.error('Unable to clean this invocation\'s temporary deployment directory.');
      process.exitCode ||= 1;
    }
  }
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
  if (interruptedSignal) process.exitCode = signalExitCodes[interruptedSignal];
}
