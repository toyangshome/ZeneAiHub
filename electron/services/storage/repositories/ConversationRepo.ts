import type Database from 'better-sqlite3';
import { getDatabase } from '../Database';
import type { Conversation, ConversationSummary, Message } from '@shared/types';

interface ConversationRow {
  id: string;
  title: string;
  model_id: string;
  system_prompt: string | null;
  pinned: number;
  archived: number;
  tags: string;
  total_tokens: number;
  message_count: number;
  created_at: number;
  updated_at: number;
}

export class ConversationRepo {
  private get db(): Database.Database {
    return getDatabase();
  }

  list(options?: { limit?: number; offset?: number; search?: string }): ConversationSummary[] {
    let sql = 'SELECT * FROM conversations WHERE archived = 0';
    const params: (string | number)[] = [];

    if (options?.search) {
      sql += ' AND title LIKE ?';
      params.push(`%${options.search}%`);
    }

    sql += ' ORDER BY pinned DESC, updated_at DESC';

    if (options?.limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    return this.db.prepare(sql).all(...params).map(this.toSummary);
  }

  get(id: string): Conversation | null {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    return row ? this.fromRow(row) : null;
  }

  save(conv: Conversation): void {
    const existing = this.db.prepare('SELECT id FROM conversations WHERE id = ?').get(conv.id);
    if (existing) {
      this.db.prepare(`
        UPDATE conversations SET title=?, model_id=?, system_prompt=?, pinned=?, archived=?,
        tags=?, total_tokens=?, message_count=?, updated_at=? WHERE id=?
      `).run(
        conv.title, conv.modelId, conv.systemPrompt || null, conv.pinned ? 1 : 0,
        conv.archived ? 1 : 0, JSON.stringify(conv.tags), conv.metadata.totalTokens || 0,
        conv.metadata.messageCount || 0, conv.updatedAt, conv.id,
      );
    } else {
      this.db.prepare(`
        INSERT INTO conversations (id, title, model_id, system_prompt, pinned, archived, tags,
        total_tokens, message_count, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        conv.id, conv.title, conv.modelId, conv.systemPrompt || null, conv.pinned ? 1 : 0,
        conv.archived ? 1 : 0, JSON.stringify(conv.tags), conv.metadata.totalTokens || 0,
        conv.metadata.messageCount || 0, conv.createdAt, conv.updatedAt,
      );
    }
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  updateTitle(id: string, title: string): void {
    this.db.prepare('UPDATE conversations SET title=?, updated_at=? WHERE id=?')
      .run(title, Date.now(), id);
  }

  private toSummary(row: ConversationRow): ConversationSummary {
    return {
      id: row.id, title: row.title, modelId: row.model_id,
      pinned: !!row.pinned, archived: !!row.archived,
      tags: JSON.parse(row.tags || '[]'), messageCount: row.message_count || 0,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  private fromRow(row: ConversationRow): Conversation {
    return {
      id: row.id, title: row.title, modelId: row.model_id,
      systemPrompt: row.system_prompt, pinned: !!row.pinned, archived: !!row.archived,
      tags: JSON.parse(row.tags || '[]'),
      metadata: { totalTokens: row.total_tokens, messageCount: row.message_count },
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }
}
