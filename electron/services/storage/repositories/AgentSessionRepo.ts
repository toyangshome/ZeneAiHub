import type Database from 'better-sqlite3';
import { getDatabase } from '../Database';
import type { AgentContentBlock } from '@shared/types/agent';

// ========== 类型 ==========

export interface AgentSessionRow {
  id: string;
  project_path: string;
  title: string;
  model: string | null;
  status: string;
  total_cost: number;
  total_turns: number;
  created_at: number;
  updated_at: number;
}

export interface AgentSessionSummary {
  id: string;
  projectPath: string;
  title: string;
  model: string | null;
  status: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentMessageRow {
  id: string;
  session_id: string;
  role: string;
  blocks: string;
  created_at: number;
  cost: number | null;
  duration_ms: number | null;
  num_turns: number | null;
}

export interface AgentMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  blocks: AgentContentBlock[];
  createdAt: number;
  cost?: number;
  durationMs?: number;
  numTurns?: number;
}

// ========== Repo ==========

export class AgentSessionRepo {
  private get db(): Database.Database {
    return getDatabase();
  }

  /** 列出会话（按项目路径筛选，最近更新的排前面） */
  list(projectPath?: string, limit = 50): AgentSessionSummary[] {
    let sql = `
      SELECT s.*, COUNT(m.id) as msg_count
      FROM agent_sessions s
      LEFT JOIN agent_messages m ON m.session_id = s.id
    `;
    const params: string[] = [];

    if (projectPath) {
      sql += ' WHERE s.project_path = ?';
      params.push(projectPath);
    }

    sql += ' GROUP BY s.id ORDER BY s.updated_at DESC';
    if (limit > 0) {
      sql += ' LIMIT ?';
      params.push(String(limit));
    }

    return this.db.prepare(sql).all(...params).map((row: unknown) => {
      const r = row as AgentSessionRow & { msg_count: number };
      return {
        id: r.id, projectPath: r.project_path, title: r.title,
        model: r.model, status: r.status, messageCount: r.msg_count,
        createdAt: r.created_at, updatedAt: r.updated_at,
      };
    });
  }

  /** 获取单个会话 */
  get(sessionId: string): AgentSessionRow | null {
    return this.db.prepare('SELECT * FROM agent_sessions WHERE id = ?')
      .get(sessionId) as AgentSessionRow | null;
  }

  /** 创建或更新会话 */
  save(session: {
    id: string; projectPath: string; title?: string;
    model?: string; status?: string; totalCost?: number; totalTurns?: number;
  }): void {
    const now = Date.now();
    const existing = this.db.prepare('SELECT id FROM agent_sessions WHERE id = ?').get(session.id);
    if (existing) {
      this.db.prepare(`
        UPDATE agent_sessions
        SET title=COALESCE(?,title), model=COALESCE(?,model), status=COALESCE(?,status),
            total_cost=COALESCE(?,total_cost), total_turns=COALESCE(?,total_turns), updated_at=?
        WHERE id=?
      `).run(
        session.title ?? null, session.model ?? null, session.status ?? null,
        session.totalCost ?? null, session.totalTurns ?? null, now, session.id,
      );
    } else {
      this.db.prepare(`
        INSERT INTO agent_sessions (id, project_path, title, model, status, total_cost, total_turns, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session.id, session.projectPath, session.title || '',
        session.model || null, session.status || 'active',
        session.totalCost || 0, session.totalTurns || 0, now, now,
      );
    }
  }

  /** 更新会话状态 */
  updateStatus(sessionId: string, status: string): void {
    this.db.prepare('UPDATE agent_sessions SET status=?, updated_at=? WHERE id=?')
      .run(status, Date.now(), sessionId);
  }

  /** 删除会话及其消息 */
  delete(sessionId: string): void {
    this.db.prepare('DELETE FROM agent_messages WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM agent_sessions WHERE id = ?').run(sessionId);
  }

  // ========== 消息 ==========

  /** 列出会话的所有消息 */
  listMessages(sessionId: string): AgentMessageRecord[] {
    return this.db.prepare(
      'SELECT * FROM agent_messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId).map((row: unknown) => this.fromMessageRow(row as AgentMessageRow));
  }

  /** 保存一条消息（插入或更新） */
  saveMessage(msg: {
    id: string; sessionId: string; role: 'user' | 'assistant';
    blocks: AgentContentBlock[]; cost?: number; durationMs?: number; numTurns?: number;
  }): void {
    const existing = this.db.prepare('SELECT id FROM agent_messages WHERE id = ?').get(msg.id);
    if (existing) {
      this.db.prepare(`
        UPDATE agent_messages SET blocks=?, cost=?, duration_ms=?, num_turns=? WHERE id=?
      `).run(
        JSON.stringify(msg.blocks), msg.cost ?? null,
        msg.durationMs ?? null, msg.numTurns ?? null, msg.id,
      );
    } else {
      this.db.prepare(`
        INSERT INTO agent_messages (id, session_id, role, blocks, created_at, cost, duration_ms, num_turns)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        msg.id, msg.sessionId, msg.role, JSON.stringify(msg.blocks),
        Date.now(), msg.cost ?? null, msg.durationMs ?? null, msg.numTurns ?? null,
      );
    }
  }

  private fromMessageRow(row: AgentMessageRow): AgentMessageRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role as 'user' | 'assistant',
      blocks: JSON.parse(row.blocks || '[]'),
      createdAt: row.created_at,
      cost: row.cost ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      numTurns: row.num_turns ?? undefined,
    };
  }
}
