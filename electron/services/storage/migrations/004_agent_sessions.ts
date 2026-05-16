import type Database from 'better-sqlite3';

export const migration004 = {
  version: 4,
  name: 'agent_sessions',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE agent_sessions (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        title TEXT DEFAULT '',
        model TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        total_cost REAL DEFAULT 0,
        total_turns INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE agent_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        blocks TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        cost REAL,
        duration_ms INTEGER,
        num_turns INTEGER,
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_agent_messages_session ON agent_messages(session_id);
      CREATE INDEX idx_agent_sessions_updated ON agent_sessions(updated_at);
      CREATE INDEX idx_agent_sessions_project ON agent_sessions(project_path);
    `);
  },
};
