import { MAX_BYTES, type Store } from './core';
export const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
let token: string | undefined;
export async function localApi(path: string, method = 'GET', body?: unknown): Promise<any> {
  if (!token) {
    const r = await fetch('/api/session', { cache: 'no-store' });
    if (!r.ok) throw new Error('请使用 npm run desktop 启动电脑端');
    token = (await r.json()).session;
  }
  const res = await fetch(path, { method, cache: 'no-store', headers: { 'X-Diary-Session': token!, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error ?? '本机服务没有响应');
  return result;
}
export const store: Store = { load: () => localApi('/api/store'), merge: bundle => localApi('/api/store', 'POST', bundle) };
export async function pickBackup(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.diary,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (file.size > MAX_BYTES) throw new Error('备份超过 16 MB');
        resolve(await file.text());
      } catch (e) { reject(e); }
    };
    input.click();
  });
}
export async function download(text: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
