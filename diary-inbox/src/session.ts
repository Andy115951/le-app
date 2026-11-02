import { append, createVault, entries, mergeBundles, readRevisions, unlock, type Bundle, type Content, type Random, type Store } from './core.ts';

export class Session {
  private constructor(public bundle: Bundle, private key: Uint8Array, private store: Store, private random: Random) {}
  static async create(password: string, store: Store, random: Random) {
    const { bundle, key } = await createVault(password, random);
    try { return new Session(await store.merge(bundle), key, store, random); }
    catch (e) { key.fill(0); throw e; }
  }
  static async open(bundle: Bundle, password: string, store: Store, random: Random) {
    const key = await unlock(bundle, password);
    try {
      const combined = mergeBundles(await store.load(), bundle);
      readRevisions(combined, key);
      return new Session(await store.merge(combined), key, store, random);
    } catch (e) { key.fill(0); throw e; }
  }
  get entries() { return entries(this.bundle, this.key); }
  async refresh() {
    const disk = await this.store.load();
    if (disk) {
      const combined = mergeBundles(this.bundle, disk);
      readRevisions(combined, this.key);
      this.bundle = combined;
    }
  }
  async save(content: Content, id?: string, parents: string[] = []) {
    await this.refresh();
    const next = append(this.bundle, this.key, this.random, content, id, parents);
    const r = next.revisions[next.revisions.length - 1];
    this.bundle = await this.store.merge(next);
    return r;
  }
  async import(incoming: Bundle) {
    const next = mergeBundles(this.bundle, incoming);
    // Authenticate every revision before the SQLite transaction, including duplicates.
    readRevisions(next, this.key);
    this.bundle = await this.store.merge(next);
  }
  markdown() {
    return this.entries.flatMap(e => e.heads.filter(h => !h.content.deleted).map((h, i) =>
      `# ${h.content.date}${e.heads.length > 1 ? ` (conflict ${i + 1})` : ''}\n\n${h.content.text}\n`
    )).join('\n---\n\n');
  }
  lock() { this.key.fill(0); }
}
