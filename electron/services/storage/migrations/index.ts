import type Database from 'better-sqlite3';
import { migration001 } from './001_init';
import { migration002 } from './002_prompts_skills_mcp';
import { migration003 } from './003_files';
import { migration004 } from './004_agent_sessions';

type Migration = { version: number; name: string; up: (db: Database.Database) => void };

const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set<number>(
    db.prepare('SELECT version FROM _migrations').all().map((r: unknown) => (r as { version: number }).version)
  );

  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    const txn = db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(m.version, m.name, Date.now());
    });
    txn();
    console.log(`[DB] Migration ${m.version}: ${m.name} applied`);
  }
}
