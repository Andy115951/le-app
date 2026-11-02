import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { mergeBundles, parseBundle, MAX_BYTES, type Store, type Bundle } from './core';

export const random = (n: number) => Crypto.getRandomBytes(n);
let db: Promise<SQLite.SQLiteDatabase> | undefined;
async function database() {
  db ??= SQLite.openDatabaseAsync('diary.sqlite').then(async d => {
    await d.execAsync('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS vault (id INTEGER PRIMARY KEY CHECK(id=1), bundle TEXT NOT NULL);');
    return d;
  });
  return db;
}
export const store: Store = {
  async load() {
    const row = await (await database()).getFirstAsync<{ bundle: string }>('SELECT bundle FROM vault WHERE id=1');
    return row ? parseBundle(row.bundle) : null;
  },
  async merge(bundle) {
    const d = await database();
    let result!: Bundle;
    await d.withExclusiveTransactionAsync(async tx => {
      await tx.runAsync('INSERT OR IGNORE INTO vault(id,bundle) VALUES(1,?)', JSON.stringify(bundle));
      const row = await tx.getFirstAsync<{ bundle: string }>('SELECT bundle FROM vault WHERE id=1');
      result = mergeBundles(row ? parseBundle(row.bundle) : null, bundle);
      await tx.runAsync('UPDATE vault SET bundle=? WHERE id=1', JSON.stringify(result));
    });
    return result;
  }
};
export async function pickBackup(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  try {
    if (file.size > MAX_BYTES) throw new Error('备份超过 16 MB');
    return await file.text();
  } finally { file.delete(); }
}
export async function download(text: string, name: string, mime: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error('当前设备不能分享文件');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  try { await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: '保存到你自己的位置' }); }
  finally { file.delete(); }
}
export async function localApi(_path: string, _method = 'GET'): Promise<any> { throw new Error('请在电脑端开启配对'); }
