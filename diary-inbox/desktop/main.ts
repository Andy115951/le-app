import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DesktopStore } from './storage.ts';
import { createDiaryServer } from './server.ts';

const dir = process.env.DIARY_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'diary-inbox');
await mkdir(dir, { recursive: true, mode: 0o700 });
const store = new DesktopStore(join(dir, 'diary.sqlite'));
const server = createDiaryServer(store, fileURLToPath(new URL('../dist', import.meta.url)));
const lan = process.argv.includes('--lan');
server.listen(47831, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log('Diary Inbox: http://127.0.0.1:47831');
  console.log(lan ? 'LAN sync enabled. Pairing must be opened in the local UI; each code expires in 5 minutes.' : 'Loopback only. Use npm run desktop:lan to enable LAN sync.');
});
const shutdown = () => server.close(() => { store.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
