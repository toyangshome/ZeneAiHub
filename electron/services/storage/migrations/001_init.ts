import type Database from 'better-sqlite3';

export const migration001 = {
  version: 1,
  name: 'init_conversations_messages',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '新对话',
        model_id TEXT NOT NULL,
        system_prompt TEXT,
        pinned INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]',
        total_tokens INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        attachments TEXT DEFAULT '[]',
        tool_calls TEXT DEFAULT '[]',
        token_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        parent_message_id TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_messages_conv ON messages(conversation_id);
      CREATE INDEX idx_messages_created ON messages(created_at);
      CREATE INDEX idx_conversations_updated ON conversations(updated_at);
    `);
  },
};
