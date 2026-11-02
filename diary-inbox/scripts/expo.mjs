import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, EXPO_NO_TELEMETRY: '1' }
});
if (result.error) console.error('Unable to start the Expo CLI. Check the local dependency installation.');
process.exit(result.status ?? 1);
