#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const migration = fileURLToPath(new URL('../supabase/migrations/202610190001_glucose_initial.sql', import.meta.url));
const mode = process.argv[2];

if (mode === '--sql') {
  // Safe to paste into this project's Supabase SQL Editor. Contains no credentials.
  process.stdout.write(await readFile(migration, 'utf8'));
} else if (mode === '--apply') {
  const databaseUrl = process.env.GLUCOSE_DATABASE_URL;
  if (!databaseUrl || !/^postgres(?:ql)?:\/\//u.test(databaseUrl)) {
    console.error('Set GLUCOSE_DATABASE_URL to the shared project PostgreSQL connection URL. The URL is never printed.');
    process.exitCode = 1;
  } else {
    // Pass the credential through the environment, never through process arguments.
    const child = spawn('psql', ['-X', '--no-password', '--set', 'ON_ERROR_STOP=1', '--file', migration], {
      env: { ...process.env, PGDATABASE: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', () => {
      console.error('Unable to start psql. Install the PostgreSQL client or use --sql with the Supabase SQL Editor.');
      process.exitCode = 1;
    });
    child.on('close', (code) => {
      if (code === 0) {
        console.log('Glucose additive migration applied. Other apps and project Auth configuration were not modified.');
      } else if (code !== null) {
        // PostgreSQL errors may include connection strings; redact before display.
        const safeOutput = output.replaceAll(databaseUrl, '[database URL redacted]')
          .replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, '[database URL redacted]');
        console.error(`Migration failed; transaction rolled back.\n${safeOutput.trim()}`);
        process.exitCode = code || 1;
      }
    });
  }
} else {
  console.log('Usage:\n  node scripts/cloud-setup.mjs --sql     Print SQL for Supabase SQL Editor\n  node scripts/cloud-setup.mjs --apply   Apply with psql and GLUCOSE_DATABASE_URL');
  if (mode) process.exitCode = 1;
}
