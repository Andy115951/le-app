import { DatabaseSync } from 'node:sqlite';
import { mergeBundles, parseBundle, type Bundle, type Store } from '../src/core.ts';

// Only authenticated ciphertext and random identifiers enter SQLite.
export class DesktopStore implements Store {
  private db: DatabaseSync;
  private closed = false;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS vault (id INTEGER PRIMARY KEY CHECK(id=1), bundle TEXT NOT NULL);`);
  }
  private snapshot(): Bundle | null {
    const row = this.db.prepare('SELECT bundle FROM vault WHERE id=1').get() as { bundle: string } | undefined;
    return row ? parseBundle(row.bundle) : null;
  }
  async load(): Promise<Bundle | null> { return this.snapshot(); }
  async merge(incoming: Bundle): Promise<Bundle> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const combined = mergeBundles(this.snapshot(), incoming);
      this.db.prepare('INSERT INTO vault(id,bundle) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET bundle=excluded.bundle').run(JSON.stringify(combined));
      this.db.exec('COMMIT');
      return combined;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { if (!this.closed) { this.db.close(); this.closed = true; } }
}
