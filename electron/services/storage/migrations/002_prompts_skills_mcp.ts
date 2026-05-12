import type Database from 'better-sqlite3';

export const migration002 = {
  version: 2,
  name: 'prompts_skills_mcp',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE prompt_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT NOT NULL DEFAULT 'general',
        content TEXT NOT NULL,
        variables TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        is_favorite INTEGER NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        is_built_in INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX idx_prompt_category ON prompt_templates(category);
      CREATE INDEX idx_prompt_favorite ON prompt_templates(is_favorite);

      CREATE TABLE skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        icon TEXT DEFAULT '',
        category TEXT NOT NULL DEFAULT 'general',
        system_prompt TEXT NOT NULL,
        parameters TEXT NOT NULL DEFAULT '[]',
        model_id TEXT,
        mcp_tools TEXT NOT NULL DEFAULT '[]',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX idx_skills_category ON skills(category);

      CREATE TABLE mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        transport TEXT NOT NULL DEFAULT 'stdio',
        command TEXT,
        args TEXT NOT NULL DEFAULT '[]',
        cwd TEXT,
        env TEXT NOT NULL DEFAULT '{}',
        url TEXT,
        headers TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,
        auto_reconnect INTEGER NOT NULL DEFAULT 0,
        reconnect_interval INTEGER DEFAULT 30,
        timeout INTEGER DEFAULT 60000,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};
