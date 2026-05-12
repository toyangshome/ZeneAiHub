import type Database from 'better-sqlite3';
import { getDatabase } from '../Database';
import type { Message } from '@shared/types';

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  attachments: string;
  tool_calls: string;
  token_count: number;
  created_at: number;
  parent_message_id: string | null;
}

export class MessageRepo {
  private get db(): Database.Database {
    return getDatabase();
  }

  list(conversationId: string): Message[] {
    return this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conversationId).map(this.fromRow);
  }

  save(conversationId: string, msg: Message): void {
    const existing = this.db.prepare('SELECT id FROM messages WHERE id = ?').get(msg.id);
    if (existing) {
      this.db.prepare(`
        UPDATE messages SET content=?, attachments=?, tool_calls=?, token_count=? WHERE id=?
      `).run(
        msg.content, JSON.stringify(msg.attachments || []),
        JSON.stringify(msg.toolCalls || []), msg.tokenCount || 0, msg.id,
      );
    } else {
      this.db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, attachments, tool_calls,
        token_count, created_at, parent_message_id) VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        msg.id, conversationId, msg.role, msg.content,
        JSON.stringify(msg.attachments || []), JSON.stringify(msg.toolCalls || []),
        msg.tokenCount || 0, msg.createdAt, msg.parentMessageId || null,
      );
    }

    // 更新会话统计
    const count = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ?'
    ).get(conversationId) as { cnt: number } | undefined;
    this.db.prepare(
      'UPDATE conversations SET message_count=?, updated_at=? WHERE id=?'
    ).run(count?.cnt ?? 0, Date.now(), conversationId);
  }

  private fromRow(row: MessageRow): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      attachments: JSON.parse(row.attachments || '[]'),
      toolCalls: JSON.parse(row.tool_calls || '[]'),
      tokenCount: row.token_count,
      createdAt: row.created_at,
      parentMessageId: row.parent_message_id,
    };
  }
}
