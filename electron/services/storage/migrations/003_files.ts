import type Database from 'better-sqlite3';

export const migration003 = {
  version: 3,
  name: 'file_attachments',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE file_attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        conversation_id TEXT,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        preview TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_attachments_message ON file_attachments(message_id);
      CREATE INDEX idx_attachments_conversation ON file_attachments(conversation_id);
    `);
  },
};
