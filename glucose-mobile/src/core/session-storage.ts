export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Manifest = { generation: string; count: number };
const CHUNK = 480;
function parseManifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Manifest;
  if (!/^[a-zA-Z0-9-]+$/.test(parsed.generation) || !Number.isInteger(parsed.count) || parsed.count < 1 || parsed.count > 256)
    throw new Error("登录存储损坏，请重新登录。");
  return parsed;
}
/** Commit a new manifest only after all encrypted chunks were written. */
export function chunkedStorage(store: KeyValueStorage, id: () => string): KeyValueStorage {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work); queue = next.catch(() => {}); return next;
  }
  const partKey = (key: string, manifest: Manifest, index: number) => `${key}.${manifest.generation}.${index}`;
  async function clean(key: string, manifest: Manifest | null) {
    if (manifest) await Promise.all(Array.from({ length: manifest.count }, (_, index) => store.removeItem(partKey(key, manifest, index))));
  }
  return {
    getItem: key => serial(async () => {
      const manifest = parseManifest(await store.getItem(key));
      if (!manifest) return null;
      const parts = await Promise.all(Array.from({ length: manifest.count }, (_, index) => store.getItem(partKey(key, manifest, index))));
      if (parts.some(part => part === null)) throw new Error("登录存储不完整，请重新登录。");
      return parts.join("");
    }),
    setItem: (key, value) => serial(async () => {
      const previous = parseManifest(await store.getItem(key));
      const codepoints = Array.from(value);
      const manifest = { generation: id(), count: Math.max(1, Math.ceil(codepoints.length / CHUNK)) };
      if (manifest.count > 256) throw new Error("登录信息过长，无法安全保存在设备中。");
      try {
        for (let index = 0; index < manifest.count; index++) await store.setItem(partKey(key, manifest, index), codepoints.slice(index * CHUNK, (index + 1) * CHUNK).join(""));
        await store.setItem(key, JSON.stringify(manifest));
      } catch (error) { await clean(key, manifest).catch(() => {}); throw error; }
      // Old ciphertext has no active pointer after commit; a cleanup failure must not undo the new session.
      await clean(key, previous).catch(() => {});
    }),
    removeItem: key => serial(async () => {
      const previous = parseManifest(await store.getItem(key));
      await store.removeItem(key);
      await clean(key, previous);
    }),
  };
}
